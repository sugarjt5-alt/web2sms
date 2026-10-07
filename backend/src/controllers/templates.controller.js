const pool = require('../config/db');
const { parseId } = require('../services/validate');

// Мессежийн загварууд — байгууллагын бүх ажилтан хуваалцана

function cleanTemplate(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!name || !content) return { error: 'Загварын нэр болон агуулга шаардлагатай' };
  if (content.length > 2000) return { error: 'Агуулга хэт урт байна' };
  return { name: name.slice(0, 150), content };
}

async function getTemplates(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.*, u.name AS user_name FROM message_templates t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.organization_id = $1 ORDER BY t.name`,
      [req.user.organizationId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

async function createTemplate(req, res) {
  try {
    const t = cleanTemplate(req.body);
    if (t.error) return res.status(400).json({ message: t.error });
    const result = await pool.query(
      `INSERT INTO message_templates (organization_id, user_id, name, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.organizationId, req.user.id, t.name, t.content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

async function updateTemplate(req, res) {
  try {
    const id = parseId(req.params.id);
    const t = cleanTemplate(req.body);
    if (!id) return res.status(404).json({ message: 'Загвар олдсонгүй' });
    if (t.error) return res.status(400).json({ message: t.error });
    const result = await pool.query(
      `UPDATE message_templates SET name = $1, content = $2
       WHERE id = $3 AND organization_id = $4 RETURNING *`,
      [t.name, t.content, id, req.user.organizationId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Загвар олдсонгүй' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

async function deleteTemplate(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Загвар олдсонгүй' });
    const result = await pool.query(
      'DELETE FROM message_templates WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user.organizationId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Загвар олдсонгүй' });
    res.json({ message: 'Устгагдлаа' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate };
