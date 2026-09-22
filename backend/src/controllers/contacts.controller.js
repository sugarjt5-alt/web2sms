const pool = require('../config/db');

// Хэрэглэгчийн бүх contact-уудыг авах
async function getContacts(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Contact нэмэх
async function createContact(req, res) {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: 'Нэр болон утасны дугаар шаардлагатай' });
    }

    const result = await pool.query(
      `INSERT INTO contacts (user_id, name, phone) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, name, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Contact засах
async function updateContact(req, res) {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    const result = await pool.query(
      `UPDATE contacts SET name = $1, phone = $2
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [name, phone, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contact олдсонгүй' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Contact устгах
async function deleteContact(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contact олдсонгүй' });
    }
    res.json({ message: 'Устгагдлаа' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = { getContacts, createContact, updateContact, deleteContact };
