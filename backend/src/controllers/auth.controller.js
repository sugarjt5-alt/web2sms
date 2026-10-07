const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { normalizeEmail, validateNewUser } = require('../services/validate');
const { normalizePhone } = require('../services/csv.util');
require('dotenv').config();

// Шинэ байгууллагад өгөх үнэгүй туршилтын кредит (анхдагч 0)
const SIGNUP_FREE_CREDITS = Math.max(0, Number(process.env.SIGNUP_FREE_CREDITS) || 0);

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Frontend-д буцаах хэрэглэгчийн мэдээлэл (нууц үгийн hash-гүй)
function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    org_role: row.org_role,
    organization_id: row.organization_id,
    organization_name: row.organization_name,
    organization_type: row.organization_type,
  };
}

// Бүртгүүлэх: хувь хүн эсвэл байгууллага.
// Хоёулаа дотооддоо "байгууллага" (кредит, харилцагч эзэмших нэгж) үүсгэж, бүртгүүлсэн хүнийг эзэн болгоно.
// Хувь хүний хувьд байгууллагын нэр = тухайн хүний нэр, ажилтан нэмэх боломжгүй.
async function register(req, res) {
  const client = await pool.connect();
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const type = req.body.accountType === 'individual' ? 'individual' : 'organization';
    const phone = normalizePhone(String(req.body.phone || ''));
    const registrationNo = String(req.body.registrationNo || '').trim();
    const organizationName = type === 'individual'
      ? String(name || '').trim()
      : String(req.body.organizationName || '').trim();

    const invalid = validateNewUser({ name, email, password });
    if (invalid) return res.status(400).json({ message: invalid });
    if (!phone) return res.status(400).json({ message: 'Утасны дугаар буруу байна (жишээ: 99112233)' });
    if (type === 'organization') {
      if (!organizationName) return res.status(400).json({ message: 'Байгууллагын нэр шаардлагатай' });
      if (!/^\d{7}$/.test(registrationNo)) {
        return res.status(400).json({ message: 'Байгууллагын регистрийн дугаар 7 оронтой тоо байна' });
      }
    }

    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Энэ имэйл бүртгэлтэй байна' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    // Систем дэх хамгийн эхний хэрэглэгчийг автоматаар admin болгоно (bootstrap)
    const countResult = await client.query('SELECT COUNT(*) FROM users');
    const role = Number(countResult.rows[0].count) === 0 ? 'admin' : 'user';

    const org = await client.query(
      `INSERT INTO organizations (name, credits, type, registration_no, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, type`,
      [organizationName.slice(0, 150), SIGNUP_FREE_CREDITS, type,
        type === 'organization' ? registrationNo : null, phone]
    );
    const orgId = org.rows[0].id;

    if (SIGNUP_FREE_CREDITS > 0) {
      await client.query(
        `INSERT INTO credit_transactions (organization_id, amount, balance_after, type, note)
         VALUES ($1, $2, $2, 'topup', 'Бүртгэлийн үнэгүй кредит')`,
        [orgId, SIGNUP_FREE_CREDITS]
      );
    }

    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, org_role)
       VALUES ($1, $2, $3, $4, $5, 'owner')
       RETURNING id, name, email, role, organization_id, org_role`,
      [String(name).trim(), email, passwordHash, role, orgId]
    );

    await client.query('COMMIT');

    const user = { ...result.rows[0], organization_name: org.rows[0].name, organization_type: org.rows[0].type };
    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  } finally {
    client.release();
  }
}

// Нэвтрэх — requiredRole өгвөл зөвхөн тэр role-той хэрэглэгч нэвтэрнэ
async function loginWithRole(req, res, requiredRole) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Имэйл болон нууц үгээ оруулна уу' });
    }

    const result = await pool.query(
      `SELECT u.*, o.name AS organization_name, o.type AS organization_type, o.is_active
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE LOWER(u.email) = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Имэйл эсвэл нууц үг буруу байна' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Имэйл эсвэл нууц үг буруу байна' });
    }

    // Admin болон хэрэглэгчийн нэвтрэлт тусдаа: admin зөвхөн /admin/login-оор, бусад нь зөвхөн /login-оор
    if (requiredRole === 'admin' && user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin эрхгүй хэрэглэгч байна' });
    }
    if (!requiredRole && user.role === 'admin') {
      return res.status(403).json({ message: 'Admin бүртгэл. Admin нэвтрэх хуудсаар нэвтэрнэ үү', admin: true });
    }
    if (!user.is_active && user.role !== 'admin') {
      return res.status(403).json({ message: 'Байгууллагын эрх түр хаагдсан байна' });
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Энгийн нэвтрэлт (бүх хэрэглэгч)
function login(req, res) {
  return loginWithRole(req, res, null);
}

// Admin нэвтрэлт (зөвхөн admin role)
function adminLogin(req, res) {
  return loginWithRole(req, res, 'admin');
}

// Нэвтэрсэн хэрэглэгчийн мэдээлэл авах
async function me(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.org_role, u.organization_id, u.created_at,
              o.name AS organization_name, o.type AS organization_type, o.credits
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Хэрэглэгч олдсонгүй' });
    }
    const row = result.rows[0];
    res.json({ ...publicUser(row), credits: row.credits, created_at: row.created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = { register, login, adminLogin, me };
