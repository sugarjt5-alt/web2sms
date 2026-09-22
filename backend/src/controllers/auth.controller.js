const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Анхны хэрэглэгч бүртгэх
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Бүх талбарыг бөглөнө үү' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Энэ имэйл бүртгэлтэй байна' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Систем дэх хамгийн эхний хэрэглэгчийг автоматаар admin болгоно (bootstrap)
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const isFirstUser = Number(countResult.rows[0].count) === 0;
    const role = isFirstUser ? 'admin' : 'user';

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, role]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Нэвтрэх
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Имэйл эсвэл нууц үг буруу байна' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Имэйл эсвэл нууц үг буруу байна' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Нэвтэрсэн хэрэглэгчийн мэдээлэл авах
async function me(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
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

module.exports = { register, login, me };
