// Admin талын төлбөр: багц тохируулах, захиалга батлах/татгалзах, төлбөрийн заавар
const pool = require('../config/db');
const { addCredits } = require('../services/credits');
const { parseId } = require('../services/validate');

// ---- Багцууд ----

function cleanPackage(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const credits = Number(body.credits);
  const price = Number(body.price);
  if (!name) return { error: 'Багцын нэр шаардлагатай' };
  if (!Number.isInteger(credits) || credits <= 0) return { error: 'Кредит эерэг бүхэл тоо байна' };
  if (!Number.isInteger(price) || price < 0) return { error: 'Үнэ 0 эсвэл эерэг бүхэл тоо байна' };
  return {
    name: name.slice(0, 100),
    credits,
    price,
    description: typeof body.description === 'string' ? body.description.trim().slice(0, 300) : null,
    sort_order: Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    is_active: body.is_active !== false,
  };
}

async function getAllPackages(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM credit_orders o WHERE o.package_id = p.id AND o.status = 'paid')::int AS sold
       FROM packages p ORDER BY p.sort_order, p.price`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

async function createPackage(req, res) {
  try {
    const p = cleanPackage(req.body);
    if (p.error) return res.status(400).json({ message: p.error });
    const result = await pool.query(
      `INSERT INTO packages (name, credits, price, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [p.name, p.credits, p.price, p.description, p.sort_order, p.is_active]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Үнэ өөрчлөхөд хуучин захиалгууд нөлөөлөхгүй (захиалга үнээ өөртөө хадгалдаг)
async function updatePackage(req, res) {
  try {
    const id = parseId(req.params.id);
    const p = cleanPackage(req.body);
    if (!id) return res.status(404).json({ message: 'Багц олдсонгүй' });
    if (p.error) return res.status(400).json({ message: p.error });
    const result = await pool.query(
      `UPDATE packages SET name = $1, credits = $2, price = $3, description = $4, sort_order = $5, is_active = $6
       WHERE id = $7 RETURNING *`,
      [p.name, p.credits, p.price, p.description, p.sort_order, p.is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Багц олдсонгүй' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// ---- Захиалгууд ----

async function getAllOrders(req, res) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const result = await pool.query(
      `SELECT o.*, org.name AS organization_name, u.name AS created_by_name, u.email AS created_by_email,
              d.name AS decided_by_name
       FROM credit_orders o
       JOIN organizations org ON org.id = o.organization_id
       LEFT JOIN users u ON u.id = o.created_by
       LEFT JOIN users d ON d.id = o.decided_by
       WHERE ($1::text IS NULL OR o.status = $1)
       ORDER BY (o.status = 'pending') DESC, o.created_at DESC
       LIMIT 300`,
      [status]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Төлбөр орсныг шалгаад батлах — кредит байгууллагад орно (нэг л удаа)
async function approveOrder(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Захиалга олдсонгүй' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE credit_orders SET status = 'paid', decided_by = $2, decided_at = NOW(), admin_note = $3
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id, req.user.id, typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) || null : null]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Захиалга аль хэдийн шийдвэрлэгдсэн эсвэл олдсонгүй' });
    }
    const order = result.rows[0];
    const balance = await addCredits(client, {
      organizationId: order.organization_id,
      amount: order.credits,
      type: 'topup',
      userId: req.user.id,
      note: `${order.package_name} багц (${order.invoice_no})`,
    });
    await client.query('COMMIT');
    res.json({ ...order, credits_balance: balance });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  } finally {
    client.release();
  }
}

async function rejectOrder(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Захиалга олдсонгүй' });
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
    if (!note) return res.status(400).json({ message: 'Татгалзсан шалтгаанаа бичнэ үү' });
    const result = await pool.query(
      `UPDATE credit_orders SET status = 'rejected', decided_by = $2, decided_at = NOW(), admin_note = $3
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id, req.user.id, note]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ message: 'Захиалга аль хэдийн шийдвэрлэгдсэн эсвэл олдсонгүй' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// ---- Тохиргоо ----

const EDITABLE_SETTINGS = ['payment_instructions'];

async function getSettings(req, res) {
  try {
    const result = await pool.query('SELECT key, value, updated_at FROM settings WHERE key = ANY($1)', [EDITABLE_SETTINGS]);
    res.json(Object.fromEntries(result.rows.map((r) => [r.key, r.value])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

async function updateSettings(req, res) {
  try {
    for (const key of EDITABLE_SETTINGS) {
      if (typeof req.body[key] !== 'string') continue;
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, req.body[key].slice(0, 2000)]
      );
    }
    return getSettings(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = {
  getAllPackages, createPackage, updatePackage,
  getAllOrders, approveOrder, rejectOrder,
  getSettings, updateSettings,
};
