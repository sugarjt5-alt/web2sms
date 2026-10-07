const pool = require('../config/db');
const {
  MessageError, parseSchedule, createMessage, cancelMessage,
} = require('../services/messageService');
const { parseId } = require('../services/validate');
const { RECIPIENT_SUMMARY_JOIN, RECIPIENT_SUMMARY_COLUMNS } = require('../services/recipientSummary');

function sendError(res, err) {
  if (err instanceof MessageError) {
    return res.status(err.status).json({ message: err.message, ...err.extra });
  }
  console.error(err);
  return res.status(500).json({ message: 'Серверийн алдаа' });
}

// Bulk SMS илгээх (зөвхөн системийн admin) — бүртгэлтэй хэрэглэгчдийн утас руу:
//   audience: 'individuals' | 'organizations' | 'all', эсвэл
//   organizationIds — сонгосон хувь хэрэглэгч/байгууллагууд.
// Утасгүй, хаагдсан бүртгэл орохгүй. scheduledAt өгвөл тухайн цагт илгээнэ.
// Мессеж дэх {нэр} нь хувь хүний / байгууллагын нэрээр солигдоно. Admin-аас кредит хасагдахгүй.
async function sendMessage(req, res) {
  const orgId = req.user.organizationId;
  const { content, audience, organizationIds } = req.body;

  try {
    const scheduledAt = parseSchedule(req.body.scheduledAt);
    if (!audience && !Array.isArray(organizationIds)) {
      throw new MessageError(400, 'Хүлээн авагч сонгоно уу');
    }

    const types = audience === 'individuals' ? ['individual']
      : audience === 'organizations' ? ['organization'] : ['individual', 'organization'];
    const ids = Array.isArray(organizationIds)
      ? organizationIds.map(Number).filter((n) => Number.isInteger(n) && n > 0) : null;
    const result = await pool.query(
      `SELECT id AS recipient_org_id, type AS recipient_type, phone, name FROM organizations
       WHERE phone IS NOT NULL AND is_active AND id <> $1
         AND ($2::int[] IS NULL OR id = ANY($2::int[]))
         AND ($2::int[] IS NOT NULL OR type = ANY($3::text[]))`,
      [orgId, ids, types]
    );
    const recipients = result.rows;

    const message = await createMessage({
      organizationId: orgId, userId: req.user.id, source: 'web',
      content, recipients, scheduledAt, unlimited: req.user.role === 'admin',
    });

    res.status(201).json({
      message: scheduledAt ? 'SMS хуваарьт орлоо' : 'SMS илгээх дараалалд орлоо',
      data: message,
    });
  } catch (err) {
    sendError(res, err);
  }
}

// Хуваарьт илгээлтийг цуцлах
async function cancelScheduled(req, res) {
  const messageId = parseId(req.params.id);
  if (!messageId) return res.status(404).json({ message: 'Мессеж олдсонгүй' });
  try {
    const message = await cancelMessage({
      organizationId: req.user.organizationId,
      messageId,
      userId: req.user.id,
    });
    res.json({ message: 'Илгээлт цуцлагдаж, кредит буцаагдлаа', data: message });
  } catch (err) {
    sendError(res, err);
  }
}

// SMS түүх харах. Илгээлт бүрт хүлээн авагчдыг төрлөөр нь (байгууллага / харилцагч)
// тоолж, эхний 3 нэрийг буцаана.
async function getMessages(req, res) {
  try {
    const result = await pool.query(
      `SELECT m.*, u.name AS user_name, k.name AS api_key_name, ${RECIPIENT_SUMMARY_COLUMNS}
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN api_keys k ON k.id = m.api_key_id
       ${RECIPIENT_SUMMARY_JOIN}
       WHERE m.organization_id = $1
       ORDER BY COALESCE(m.scheduled_at, m.created_at) DESC`,
      [req.user.organizationId]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
}

// Нэг мессежийн дэлгэрэнгүй + хүлээн авагч тус бүрийн sent/failed status
// Нэг мессежийн дэлгэрэнгүй + хүлээн авагч тус бүрийн sent/failed status
async function getMessageById(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Мессеж олдсонгүй' });

    const message = await pool.query(
      `SELECT m.*, u.name AS user_name, k.name AS api_key_name FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN api_keys k ON k.id = m.api_key_id
       WHERE m.id = $1 AND m.organization_id = $2`,
      [id, req.user.organizationId]
    );
    if (message.rows.length === 0) {
      return res.status(404).json({ message: 'Мессеж олдсонгүй' });
    }

    const recipients = await pool.query(
      `SELECT mr.id, mr.phone, mr.status, mr.error, mr.sent_at, mr.segments, mr.content,
              mr.recipient_type, mr.recipient_org_id,
              COALESCE(mr.recipient_name, c.name) AS recipient_name
       FROM message_recipients mr
       LEFT JOIN contacts c ON c.id = mr.contact_id
       WHERE mr.message_id = $1
       ORDER BY mr.id`,
      [id]
    );

    res.json({ ...message.rows[0], recipients: recipients.rows });
  } catch (err) {
    sendError(res, err);
  }
}

module.exports = { sendMessage, cancelScheduled, getMessages, getMessageById, sendError };
