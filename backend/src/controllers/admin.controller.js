const pool = require('../config/db');
const { addCredits } = require('../services/credits');
const { parseId } = require('../services/validate');

// Зөвхөн admin эрхтэй хэрэглэгч дуудна: бүх хэрэглэгчийн жагсаалт.
// Кредит, утас, төлөв нь хэрэглэгчийн бүртгэл (organizations мөр)-д хадгалагддаг.
async function getAllUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.org_role, u.created_at, u.created_via,
              o.id AS organization_id, o.name AS organization_name, o.type AS organization_type,
              o.credits, o.is_active, o.phone,
              (SELECT COUNT(*) FROM message_recipients mr WHERE mr.recipient_org_id = o.id)::int AS received_count,
              (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id)::int AS message_count
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Хэрэглэгчийн платформын role өөрчлөх (жишээ: user -> admin)
async function updateUserRole(req, res) {
  try {
    const id = parseId(req.params.id);
    const { role } = req.body;
    if (!id) return res.status(400).json({ message: 'Буруу id' });

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'role нь user эсвэл admin байх ёстой' });
    }

    // Admin өөрийгөө user болгож системийг admin-гүй үлдээхээс сэргийлнэ
    if (id === req.user.id && role !== 'admin') {
      return res.status(400).json({ message: 'Өөрийн admin эрхийг хасах боломжгүй' });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Хэрэглэгч олдсонгүй' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Хэрэглэгч устгах. Байгууллагын сүүлийн хэрэглэгч бол байгууллагыг бүх өгөгдөлтэй нь устгана.
async function deleteUser(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Буруу id' });
  if (id === req.user.id) {
    return res.status(400).json({ message: 'Өөрийгөө устгах боломжгүй' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(
      'DELETE FROM users WHERE id = $1 RETURNING organization_id',
      [id]
    );
    if (user.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Хэрэглэгч олдсонгүй' });
    }

    const orgId = user.rows[0].organization_id;
    const remaining = await client.query(
      'SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1',
      [orgId]
    );
    const orgDeleted = remaining.rows[0].n === 0;
    if (orgDeleted) {
      await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }

    await client.query('COMMIT');
    res.json({
      message: orgDeleted ? 'Хэрэглэгч болон түүний байгууллага устгагдлаа' : 'Хэрэглэгч устгагдлаа',
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  } finally {
    client.release();
  }
}

// Бүх байгууллага, кредит, хэрэглээний хамт
async function getOrganizations(req, res) {
  try {
    const result = await pool.query(
      `SELECT o.id, o.name, o.credits, o.is_active, o.created_at, o.type, o.registration_no, o.phone,
              (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id)::int AS member_count,
              (SELECT COALESCE(SUM(m.sent_count), 0) FROM messages m WHERE m.organization_id = o.id)::int AS sent_count,
              (SELECT u.email FROM users u WHERE u.organization_id = o.id AND u.org_role = 'owner'
               ORDER BY u.created_at LIMIT 1) AS owner_email
       FROM organizations o
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Байгууллагын кредит цэнэглэх (эерэг) эсвэл засах (сөрөг)
async function adjustCredits(req, res) {
  const id = parseId(req.params.id);
  const amount = Number(req.body.amount);
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : null;

  if (!id) return res.status(400).json({ message: 'Буруу id' });
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) {
    return res.status(400).json({ message: 'Кредитийн хэмжээ 0-ээс ялгаатай бүхэл тоо байх ёстой' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balance = await addCredits(client, {
      organizationId: id,
      amount,
      type: amount > 0 ? 'topup' : 'adjust',
      userId: req.user.id,
      note,
    });
    if (balance === null) {
      await client.query('ROLLBACK');
      const exists = await pool.query('SELECT 1 FROM organizations WHERE id = $1', [id]);
      return exists.rows.length === 0
        ? res.status(404).json({ message: 'Байгууллага олдсонгүй' })
        : res.status(400).json({ message: 'Үлдэгдэл 0-ээс доош орох боломжгүй' });
    }
    await client.query('COMMIT');
    res.json({ id, credits: balance });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  } finally {
    client.release();
  }
}

// Байгууллагыг идэвхжүүлэх / түр хаах
async function setOrganizationActive(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Буруу id' });
    if (typeof req.body.is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active нь true/false байх ёстой' });
    }
    if (id === req.user.organizationId && !req.body.is_active) {
      return res.status(400).json({ message: 'Өөрийн байгууллагыг хаах боломжгүй' });
    }

    const result = await pool.query(
      'UPDATE organizations SET is_active = $1 WHERE id = $2 RETURNING id, name, is_active',
      [req.body.is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Байгууллага олдсонгүй' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// SMS илгээх боломжтой бүртгэлтэй хэрэглэгчид (утастай, идэвхтэй) — admin-ий илгээх хуудсанд
async function getRecipients(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, type, phone FROM organizations
       WHERE phone IS NOT NULL AND is_active AND id <> $1
       ORDER BY type, name`,
      [req.user.organizationId]
    );
    const noPhone = await pool.query(
      `SELECT COUNT(*)::int AS n FROM organizations WHERE phone IS NULL AND id <> $1`,
      [req.user.organizationId]
    );
    res.json({ accounts: result.rows, without_phone: noPhone.rows[0].n });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Системийн нийт статистик
async function getStats(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role <> 'admin')::int AS customers,
         (SELECT COUNT(*) FROM users)::int AS users,
         (SELECT COUNT(*) FROM users WHERE role = 'admin')::int AS admins,
         (SELECT COUNT(*) FROM messages)::int AS messages,
         (SELECT COALESCE(SUM(sent_count), 0) FROM messages)::int AS sent,
         (SELECT COALESCE(SUM(failed_count), 0) FROM messages)::int AS failed,
         (SELECT COALESCE(SUM(credits), 0) FROM organizations)::int AS outstanding_credits,
         (SELECT COUNT(*) FROM credit_orders WHERE status = 'pending')::int AS pending_orders,
         (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS new_users,
         (SELECT COALESCE(SUM(price), 0) FROM credit_orders
          WHERE status = 'paid' AND decided_at >= date_trunc('month', NOW()))::int AS revenue_month`
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = {
  getAllUsers, updateUserRole, deleteUser,
  getOrganizations, adjustCredits, setOrganizationActive,
  getRecipients, getStats,
};
