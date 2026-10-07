// Гадны системд зориулсан нийтийн API (v1). API түлхүүрээр нэвтэрнэ.
// Хариу нь тогтвортой, англи түлхүүртэй JSON — бусад програм хангамжид хялбар.
const pool = require('../config/db');
const { normalizePhone } = require('../services/csv.util');
const { parseId } = require('../services/validate');
const {
  MessageError, parseSchedule, createMessage, cancelMessage, MAX_RECIPIENTS,
} = require('../services/messageService');

function apiError(res, err) {
  if (err instanceof MessageError) {
    const codes = { 400: 'invalid_request', 402: 'insufficient_credits', 404: 'not_found', 409: 'conflict', 503: 'unavailable' };
    return res.status(err.status).json({ error: codes[err.status] || 'error', message: err.message, ...err.extra });
  }
  console.error(err);
  return res.status(500).json({ error: 'server_error', message: 'Серверийн алдаа' });
}

function formatMessage(m) {
  return {
    id: m.id,
    status: m.status,
    recipients: m.total,
    sent: m.sent_count,
    failed: m.failed_count,
    cost: m.cost,
    scheduled_at: m.scheduled_at,
    created_at: m.created_at,
  };
}

// POST /api/v1/sms  { "to": "99112233" | ["99112233", ...], "message": "...", "schedule_at": "ISO огноо" }
async function sendSms(req, res) {
  const orgId = req.apiKey.organizationId;
  try {
    const { message, schedule_at: scheduleAt } = req.body;
    let { to } = req.body;
    if (typeof to === 'string') to = to.split(',');
    if (!Array.isArray(to) || to.length === 0) {
      throw new MessageError(400, '"to" талбарт утасны дугаар (эсвэл массив) өгнө үү');
    }
    if (to.length > MAX_RECIPIENTS) {
      throw new MessageError(400, `Нэг хүсэлтэд дээд тал нь ${MAX_RECIPIENTS} дугаар`);
    }

    const phones = [];
    const invalid = [];
    for (const raw of to) {
      const phone = normalizePhone(String(raw));
      if (phone) phones.push(phone);
      else invalid.push(raw);
    }
    if (invalid.length > 0) {
      throw new MessageError(400, 'Буруу утасны дугаар байна', { invalid_numbers: invalid.slice(0, 50) });
    }

    // Байгууллагын харилцагч мөн бол нэрийг нь {нэр}-д ашиглана
    const known = await pool.query(
      'SELECT id, phone, name FROM contacts WHERE organization_id = $1 AND phone = ANY($2::text[])',
      [orgId, phones]
    );
    const byPhone = new Map(known.rows.map((c) => [c.phone, c]));
    const recipients = phones.map((phone) => ({
      phone,
      contact_id: byPhone.get(phone)?.id ?? null,
      name: byPhone.get(phone)?.name ?? '',
    }));

    const created = await createMessage({
      organizationId: orgId,
      userId: req.apiKey.createdBy,
      apiKeyId: req.apiKey.id,
      source: 'api',
      content: message,
      recipients,
      scheduledAt: parseSchedule(scheduleAt),
    });

    const balance = await pool.query('SELECT credits FROM organizations WHERE id = $1', [orgId]);
    res.status(201).json({ ...formatMessage(created), credits_remaining: balance.rows[0].credits });
  } catch (err) {
    apiError(res, err);
  }
}

// GET /api/v1/sms/:id — илгээлтийн төлөв, хүлээн авагч бүрийн хамт
async function getSms(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new MessageError(404, 'Мессеж олдсонгүй');
    const result = await pool.query(
      'SELECT * FROM messages WHERE id = $1 AND organization_id = $2',
      [id, req.apiKey.organizationId]
    );
    if (result.rows.length === 0) throw new MessageError(404, 'Мессеж олдсонгүй');

    const recipients = await pool.query(
      `SELECT phone, status, error, sent_at FROM message_recipients WHERE message_id = $1 ORDER BY id`,
      [id]
    );
    res.json({ ...formatMessage(result.rows[0]), details: recipients.rows });
  } catch (err) {
    apiError(res, err);
  }
}

// POST /api/v1/sms/:id/cancel — хуваарьт илгээлтийг цуцлах
async function cancelSms(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw new MessageError(404, 'Мессеж олдсонгүй');
    const message = await cancelMessage({ organizationId: req.apiKey.organizationId, messageId: id });
    res.json(formatMessage(message));
  } catch (err) {
    apiError(res, err);
  }
}

// GET /api/v1/balance — кредитийн үлдэгдэл
async function getBalance(req, res) {
  try {
    const result = await pool.query(
      'SELECT name, credits FROM organizations WHERE id = $1',
      [req.apiKey.organizationId]
    );
    res.json({ organization: result.rows[0].name, credits: result.rows[0].credits });
  } catch (err) {
    apiError(res, err);
  }
}

module.exports = { sendSms, getSms, cancelSms, getBalance };
