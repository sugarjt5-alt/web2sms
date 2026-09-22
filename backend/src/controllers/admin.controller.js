const pool = require('../config/db');

// Зөвхөн admin эрхтэй хэрэглэгч дуудна: бүх хэрэглэгчийн жагсаалт
async function getAllUsers(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Хэрэглэгчийн role өөрчлөх (жишээ: user -> admin)
async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'role нь user эсвэл admin байх ёстой' });
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

module.exports = { getAllUsers, updateUserRole };
