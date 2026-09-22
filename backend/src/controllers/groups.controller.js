const pool = require('../config/db');

// Бүх group-уудыг contact тоотой нь авах
async function getGroups(req, res) {
  try {
    const result = await pool.query(
      `SELECT g.*, COUNT(gc.contact_id)::int AS contact_count
       FROM contact_groups g
       LEFT JOIN group_contacts gc ON gc.group_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Нэг group-ийн дэлгэрэнгүй (доторх contact-уудын хамт)
async function getGroupById(req, res) {
  try {
    const { id } = req.params;

    const group = await pool.query(
      'SELECT * FROM contact_groups WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (group.rows.length === 0) {
      return res.status(404).json({ message: 'Group олдсонгүй' });
    }

    const contacts = await pool.query(
      `SELECT c.* FROM contacts c
       JOIN group_contacts gc ON gc.contact_id = c.id
       WHERE gc.group_id = $1`,
      [id]
    );

    res.json({ ...group.rows[0], contacts: contacts.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Group үүсгэх
async function createGroup(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Group нэр шаардлагатай' });

    const result = await pool.query(
      'INSERT INTO contact_groups (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.id, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Group-д contact нэмэх (олноор нь)
async function addContactsToGroup(req, res) {
  try {
    const { id } = req.params; // group id
    const { contactIds } = req.body; // [1, 2, 3]

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'contactIds массив дамжуулна уу' });
    }

    // group нь энэ хэрэглэгчийнх мөн эсэхийг шалгах
    const group = await pool.query(
      'SELECT id FROM contact_groups WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (group.rows.length === 0) {
      return res.status(404).json({ message: 'Group олдсонгүй' });
    }

    const values = contactIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    await pool.query(
      `INSERT INTO group_contacts (group_id, contact_id) VALUES ${values}
       ON CONFLICT (group_id, contact_id) DO NOTHING`,
      [id, ...contactIds]
    );

    res.json({ message: 'Contact-ууд group-д нэмэгдлээ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Group устгах
async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM contact_groups WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Group олдсонгүй' });
    }
    res.json({ message: 'Устгагдлаа' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = {
  getGroups,
  getGroupById,
  createGroup,
  addContactsToGroup,
  deleteGroup,
};
