const pool = require('../config/db');
const smsQueue = require('../queue/smsQueue');

// Bulk SMS илгээх: contactIds шууд эсвэл groupId-аар дамжуулж болно
async function sendMessage(req, res) {
  const client = await pool.connect();
  try {
    const { content, contactIds, groupId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Мессежийн агуулга шаардлагатай' });
    }

    let recipients = []; // [{ contact_id, phone }]

    if (groupId) {
      const result = await pool.query(
        `SELECT c.id AS contact_id, c.phone FROM contacts c
         JOIN group_contacts gc ON gc.contact_id = c.id
         JOIN contact_groups g ON g.id = gc.group_id
         WHERE gc.group_id = $1 AND g.user_id = $2`,
        [groupId, req.user.id]
      );
      recipients = result.rows;
    } else if (Array.isArray(contactIds) && contactIds.length > 0) {
      const result = await pool.query(
        `SELECT id AS contact_id, phone FROM contacts WHERE id = ANY($1) AND user_id = $2`,
        [contactIds, req.user.id]
      );
      recipients = result.rows;
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'Хүлээн авагч олдсонгүй' });
    }

    await client.query('BEGIN');

    const messageResult = await client.query(
      `INSERT INTO messages (user_id, content, status, total)
       VALUES ($1, $2, 'processing', $3) RETURNING *`,
      [req.user.id, content, recipients.length]
    );
    const message = messageResult.rows[0];

    // Хүлээн авагч бүрд message_recipients мөр үүсгээд, дараа нь queue-д job push хийнэ
    const insertedRecipients = [];
    for (const r of recipients) {
      const rec = await client.query(
        `INSERT INTO message_recipients (message_id, contact_id, phone, status)
         VALUES ($1, $2, $3, 'pending') RETURNING id, phone`,
        [message.id, r.contact_id, r.phone]
      );
      insertedRecipients.push(rec.rows[0]);
    }

    await client.query('COMMIT');

    // Queue-д ажлуудыг тавих (transaction-оос гадуур, DB бичигдсэний дараа)
    for (const rec of insertedRecipients) {
      await smsQueue.add('send-sms', {
        recipientId: rec.id,
        phone: rec.phone,
        content,
        messageId: message.id,
      });
    }

    res.status(201).json({ message: 'SMS илгээх дараалалд орлоо', data: message });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  } finally {
    client.release();
  }
}

// SMS түүх харах
async function getMessages(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Нэг мессежийн дэлгэрэнгүй + хүлээн авагч тус бүрийн sent/failed status
async function getMessageById(req, res) {
  try {
    const { id } = req.params;

    const message = await pool.query(
      'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (message.rows.length === 0) {
      return res.status(404).json({ message: 'Мессеж олдсонгүй' });
    }

    const recipients = await pool.query(
      `SELECT mr.id, mr.phone, mr.status, mr.error, mr.sent_at, c.name AS contact_name
       FROM message_recipients mr
       LEFT JOIN contacts c ON c.id = mr.contact_id
       WHERE mr.message_id = $1`,
      [id]
    );

    res.json({ ...message.rows[0], recipients: recipients.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = { sendMessage, getMessages, getMessageById };
