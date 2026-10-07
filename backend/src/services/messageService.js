// SMS илгээлт үүсгэх, цуцлах нийтлэг логик — вэб (messages.controller) болон
// гадны API (api.controller) хоёулаа үүнийг ашиглана.
const pool = require('../config/db');
const smsQueue = require('../queue/smsQueue');
const { countSms, MAX_SEGMENTS } = require('./smsSegments');
const { chargeCredits, addCredits } = require('./credits');

const MAX_RECIPIENTS = 10000;
const MAX_SCHEDULE_DAYS = 90;

// HTTP статустай алдаа — controller-ууд шууд хариу болгон буцаана
class MessageError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// {нэр} / {name}-ийг хүлээн авагчийн нэрээр орлуулна. Нэргүй бол хоосон болно.
const PLACEHOLDER_RE = /\{\s*(нэр|name)\s*\}/gi;
function personalize(content, name) {
  return content
    .replace(PLACEHOLDER_RE, (name || '').trim())
    .replace(/ +([,.!?])/g, '$1') // "Сайн байна уу ," -> "Сайн байна уу,"
    .replace(/ {2,}/g, ' ')
    .trim();
}

// Хуваарийн огноог шалгана. Хоосон бол null (шууд илгээнэ).
function parseSchedule(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MessageError(400, 'Хуваарийн огноо буруу байна');
  }
  if (date.getTime() < Date.now() + 60 * 1000) {
    throw new MessageError(400, 'Хуваарийн цаг одоогоос дор хаяж 1 минутын дараа байх ёстой');
  }
  if (date.getTime() > Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
    throw new MessageError(400, `Хуваарийг ${MAX_SCHEDULE_DAYS} хоногоос хол тавих боломжгүй`);
  }
  return date;
}

// recipients: [{ phone, name, contact_id?, recipient_org_id?, recipient_type? }]
//   recipient_org_id / recipient_type — бүртгэлтэй хэрэглэгч рүү илгээх үед (байгууллага эсвэл хувь хүн)
// unlimited: true бол кредит хасахгүй (системийн admin илгээхэд). cost = 0 гэж хадгалагдана.
async function createMessage({
  organizationId, userId = null, apiKeyId = null, source = 'web',
  content, recipients, scheduledAt = null, unlimited = false,
}) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) throw new MessageError(400, 'Мессежийн агуулга шаардлагатай');

  // Нэг дугаар руу давхар илгээхгүй
  const seen = new Set();
  const unique = recipients.filter((r) => (seen.has(r.phone) ? false : seen.add(r.phone)));
  if (unique.length === 0) throw new MessageError(400, 'Хүлээн авагч олдсонгүй');
  if (unique.length > MAX_RECIPIENTS) {
    throw new MessageError(400, `Нэг удаад дээд тал нь ${MAX_RECIPIENTS} хүн рүү илгээнэ`);
  }

  // Хүн бүрийн бодит текст, SMS-ийн тоо (нэрийн уртаас хамаарч өөр байж болно)
  const rows = unique.map((r) => {
    const body = personalize(text, r.name);
    return { ...r, body, segments: countSms(body).segments };
  });
  const maxSegments = Math.max(...rows.map((r) => r.segments));
  if (maxSegments > MAX_SEGMENTS) {
    throw new MessageError(400, `Мессеж хэт урт байна (дээд тал нь ${MAX_SEGMENTS} SMS)`);
  }
  const cost = unlimited ? 0 : rows.reduce((sum, r) => sum + r.segments, 0);

  const client = await pool.connect();
  let message;
  let inserted;
  try {
    await client.query('BEGIN');

    const msg = await client.query(
      `INSERT INTO messages
         (organization_id, user_id, content, status, total, segments, cost, scheduled_at, source, api_key_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [organizationId, userId, text, scheduledAt ? 'scheduled' : 'processing', rows.length,
        maxSegments, cost, scheduledAt, source, apiKeyId]
    );
    message = msg.rows[0];

    const balance = unlimited ? 0 : await chargeCredits(client, {
      organizationId, amount: cost, messageId: message.id, userId,
      note: scheduledAt ? 'Хуваарьт илгээлт' : null,
    });
    if (balance === null) {
      await client.query('ROLLBACK');
      const org = await pool.query('SELECT credits FROM organizations WHERE id = $1', [organizationId]);
      const credits = org.rows[0]?.credits ?? 0;
      throw new MessageError(402, `Кредит хүрэлцэхгүй байна. Шаардлагатай: ${cost}, үлдэгдэл: ${credits}`, {
        required: cost, credits,
      });
    }

    const rec = await client.query(
      `INSERT INTO message_recipients
         (message_id, contact_id, phone, content, segments, status, recipient_org_id, recipient_type, recipient_name)
       SELECT $1, cid, ph, body, seg, 'pending', roid, rtype, rname
       FROM unnest($2::int[], $3::text[], $4::text[], $5::int[], $6::int[], $7::text[], $8::text[])
         AS t(cid, ph, body, seg, roid, rtype, rname)
       RETURNING id, phone, content`,
      [message.id, rows.map((r) => r.contact_id ?? null), rows.map((r) => r.phone),
        rows.map((r) => r.body), rows.map((r) => r.segments),
        rows.map((r) => r.recipient_org_id ?? null), rows.map((r) => r.recipient_type ?? null),
        rows.map((r) => (r.recipient_org_id ? String(r.name || '').slice(0, 150) : null))]
    );
    inserted = rec.rows;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Queue-д тавих. Хуваарьт бол BullMQ delay-ээр тухайн цагт ажиллана.
  const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
  try {
    await smsQueue.addBulk(
      inserted.map((r) => ({
        name: 'send-sms',
        data: { recipientId: r.id, phone: r.phone, content: r.content, messageId: message.id },
        opts: { jobId: `r${r.id}`, delay },
      }))
    );
  } catch (err) {
    console.error('Queue алдаа:', err);
    await failAndRefund(message, userId, 'Queue алдааны улмаас буцаалт');
    throw new MessageError(503, 'SMS дараалал ажиллахгүй байна. Кредит буцаагдлаа, дахин оролдоно уу');
  }

  return message;
}

// Мессежийг бүхэлд нь failed болгож, кредитийг бүтэн буцаана (queue ажиллахгүй үед)
async function failAndRefund(message, userId, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE messages SET status = 'failed', failed_count = total WHERE id = $1`, [message.id]);
    await client.query(
      `UPDATE message_recipients SET status = 'failed', error = 'Queue алдаа' WHERE message_id = $1`,
      [message.id]
    );
    if (message.cost > 0) {
      await addCredits(client, {
        organizationId: message.organization_id, amount: message.cost, type: 'refund',
        messageId: message.id, userId, note,
      });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Буцаалт амжилтгүй:', err);
  } finally {
    client.release();
  }
}

// Хуваарьт, хараахан эхлээгүй илгээлтийг цуцалж, кредитийг бүтэн буцаана
async function cancelMessage({ organizationId, messageId, userId = null }) {
  const client = await pool.connect();
  let message;
  let recipientIds;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE messages SET status = 'cancelled'
       WHERE id = $1 AND organization_id = $2 AND status = 'scheduled' RETURNING *`,
      [messageId, organizationId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      const exists = await pool.query(
        'SELECT status FROM messages WHERE id = $1 AND organization_id = $2',
        [messageId, organizationId]
      );
      if (exists.rows.length === 0) throw new MessageError(404, 'Мессеж олдсонгүй');
      throw new MessageError(409, 'Зөвхөн эхлээгүй хуваарьт илгээлтийг цуцлах боломжтой');
    }
    message = result.rows[0];

    const rec = await client.query(
      `UPDATE message_recipients SET status = 'cancelled'
       WHERE message_id = $1 AND status = 'pending' RETURNING id`,
      [messageId]
    );
    recipientIds = rec.rows.map((r) => r.id);

    if (message.cost > 0) {
      await addCredits(client, {
        organizationId, amount: message.cost, type: 'refund', messageId, userId,
        note: 'Хуваарьт илгээлт цуцлагдсан',
      });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Redis дэх хүлээгдэж буй job-уудыг устгана. Үлдсэн ч worker "pending биш" гэж алгасна.
  await Promise.allSettled(recipientIds.map((id) => smsQueue.remove(`r${id}`)));
  return message;
}

module.exports = {
  MessageError, personalize, parseSchedule, createMessage, cancelMessage, MAX_RECIPIENTS,
};
