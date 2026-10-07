const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { normalizeEmail, validateNewUser, parseId, ORG_ROLES, parseOrgRole } = require('../services/validate');
const { generateKey } = require('../services/apiKeys');

// Өөрийн байгууллагын мэдээлэл + ажилтнууд
async function getOrganization(req, res) {
  try {
    const org = await pool.query(
      `SELECT id, name, credits, is_active, created_at, type, registration_no, phone
       FROM organizations WHERE id = $1`,
      [req.user.organizationId]
    );
    const members = await pool.query(
      `SELECT id, name, email, org_role, created_at FROM users
       WHERE organization_id = $1 ORDER BY created_at`,
      [req.user.organizationId]
    );
    res.json({ ...org.rows[0], members: members.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Байгууллагын нэр солих (owner)
async function updateOrganization(req, res) {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ message: 'Байгууллагын нэр шаардлагатай' });

    const result = await pool.query(
      'UPDATE organizations SET name = $1 WHERE id = $2 RETURNING id, name, credits, is_active',
      [name.slice(0, 150), req.user.organizationId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Кредитийн гүйлгээний түүх (сүүлийн 100)
async function getTransactions(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.id, t.amount, t.balance_after, t.type, t.message_id, t.note, t.created_at,
              u.name AS created_by_name
       FROM credit_transactions t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.organization_id = $1
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT 100`,
      [req.user.organizationId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Шинэ ажилтан нэмэх (owner). Анхны нууц үгийг owner өгч, ажилтанд өөрөө дамжуулна.
async function addMember(req, res) {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const orgRole = parseOrgRole(req.body.org_role, 'member');

    const invalid = validateNewUser({ name, email, password });
    if (invalid) return res.status(400).json({ message: invalid });

    const org = await pool.query('SELECT type FROM organizations WHERE id = $1', [req.user.organizationId]);
    if (org.rows[0]?.type === 'individual') {
      return res.status(400).json({ message: 'Хувь хүний бүртгэлд ажилтан нэмэх боломжгүй. Байгууллагаар бүртгүүлнэ үү' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Энэ имэйл бүртгэлтэй байна' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, org_role, created_via)
       VALUES ($1, $2, $3, 'user', $4, $5, 'team')
       RETURNING id, name, email, org_role, created_at`,
      [String(name).trim(), email, passwordHash, req.user.organizationId, orgRole]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Ажилтны эрх солих: owner <-> member (owner)
async function updateMemberRole(req, res) {
  try {
    const id = parseId(req.params.id);
    const { org_role } = req.body;
    if (!id) return res.status(400).json({ message: 'Буруу id' });
    if (!ORG_ROLES.includes(org_role)) {
      return res.status(400).json({ message: 'Эрх нь эзэн, ажилтан эсвэл харилцагч байх ёстой' });
    }
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Өөрийн эрхийг өөрчлөх боломжгүй' });
    }

    const result = await pool.query(
      `UPDATE users SET org_role = $1 WHERE id = $2 AND organization_id = $3
       RETURNING id, name, email, org_role`,
      [org_role, id, req.user.organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Ажилтан хасах (owner). Түүний үүсгэсэн contact, мессеж байгууллагад үлдэнэ.
async function removeMember(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Буруу id' });
    if (id === req.user.id) {
      return res.status(400).json({ message: 'Өөрийгөө хасах боломжгүй' });
    }

    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 AND organization_id = $2 AND role <> 'admin' RETURNING id`,
      [id, req.user.organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ажилтан олдсонгүй' });
    }
    res.json({ message: 'Ажилтан хасагдлаа' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// ---- API түлхүүрүүд (owner) ----

async function getApiKeys(req, res) {
  try {
    const result = await pool.query(
      `SELECT k.id, k.name, k.key_prefix, k.created_at, k.last_used_at, k.revoked_at,
              u.name AS created_by_name
       FROM api_keys k LEFT JOIN users u ON u.id = k.created_by
       WHERE k.organization_id = $1
       ORDER BY k.revoked_at IS NOT NULL, k.created_at DESC`,
      [req.user.organizationId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Шинэ түлхүүр үүсгэх. Бүтэн түлхүүрийг зөвхөн энэ хариунд нэг удаа буцаана.
async function createApiKey(req, res) {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ message: 'Түлхүүрийн нэр шаардлагатай' });

    const active = await pool.query(
      'SELECT COUNT(*)::int AS n FROM api_keys WHERE organization_id = $1 AND revoked_at IS NULL',
      [req.user.organizationId]
    );
    if (active.rows[0].n >= 10) {
      return res.status(400).json({ message: 'Идэвхтэй түлхүүр 10-аас хэтрэхгүй. Хэрэглээгүйгээ хаана уу' });
    }

    const { key, prefix, hash } = generateKey();
    const result = await pool.query(
      `INSERT INTO api_keys (organization_id, name, key_prefix, key_hash, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, key_prefix, created_at`,
      [req.user.organizationId, name.slice(0, 100), prefix, hash, req.user.id]
    );
    res.status(201).json({ ...result.rows[0], key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Түлхүүрийг хаах (буцаах боломжгүй — шинээр үүсгэнэ)
async function revokeApiKey(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Түлхүүр олдсонгүй' });
    const result = await pool.query(
      `UPDATE api_keys SET revoked_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL RETURNING id`,
      [id, req.user.organizationId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Түлхүүр олдсонгүй' });
    res.json({ message: 'Түлхүүр хаагдлаа' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = {
  getOrganization, updateOrganization, getTransactions,
  addMember, updateMemberRole, removeMember,
  getApiKeys, createApiKey, revokeApiKey,
};
