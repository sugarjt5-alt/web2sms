// JWT токен шалгах middleware
// Токен хүчинтэй байсан ч хэрэглэгчийг DB-ээс дахин уншина — устгагдсан хэрэглэгч,
// хаагдсан байгууллага, өөрчлөгдсөн role шууд хүчинтэй болно.
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization; // "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Токен байхгүй байна' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Токен хүчингүй байна' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, u.organization_id, u.org_role, o.is_active
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Хэрэглэгч олдсонгүй' });
    }
    if (!user.is_active && user.role !== 'admin') {
      return res.status(403).json({ message: 'Байгууллагын эрх түр хаагдсан байна' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,               // платформын эрх: 'user' | 'admin'
      organizationId: user.organization_id,
      orgRole: user.org_role,        // байгууллага доторх эрх: 'owner' | 'member'
    };
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = authMiddleware;
