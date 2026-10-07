// Хэрэглэгчийн талын төлбөр: багц сонгох, захиалах (нэхэмжлэх), захиалгаа цуцлах
const pool = require('../config/db');
const { parseId } = require('../services/validate');

const MAX_PENDING_ORDERS = 5;

async function getPackages(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, credits, price, description FROM packages
       WHERE is_active ORDER BY sort_order, price`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Төлбөрийн заавар (банк, данс) — admin тохиргооноос
async function getPaymentInfo(req, res) {
  try {
    const result = await pool.query(`SELECT value FROM settings WHERE key = 'payment_instructions'`);
    res.json({ payment_instructions: result.rows[0]?.value || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

async function getOrders(req, res) {
  try {
    const result = await pool.query(
      `SELECT o.*, u.name AS created_by_name FROM credit_orders o
       LEFT JOIN users u ON u.id = o.created_by
       WHERE o.organization_id = $1
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [req.user.organizationId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

// Багц захиалах — нэхэмжлэх үүснэ. Admin төлбөрийг шалгаад батлахад кредит орно.
async function createOrder(req, res) {
  const packageId = parseId(req.body.packageId);
  if (!packageId) return res.status(400).json({ message: 'Багц сонгоно уу' });

  const client = await pool.connect();
  try {
    const pkg = await client.query(
      'SELECT id, name, credits, price FROM packages WHERE id = $1 AND is_active',
      [packageId]
    );
    if (pkg.rows.length === 0) return res.status(404).json({ message: 'Багц олдсонгүй' });

    const pending = await client.query(
      `SELECT COUNT(*)::int AS n FROM credit_orders WHERE organization_id = $1 AND status = 'pending'`,
      [req.user.organizationId]
    );
    if (pending.rows[0].n >= MAX_PENDING_ORDERS) {
      return res.status(400).json({
        message: `Төлбөр хүлээгдэж буй ${MAX_PENDING_ORDERS} захиалга байна. Эхлээд тэдгээрийг төлөх эсвэл цуцлана уу`,
      });
    }

    const p = pkg.rows[0];
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO credit_orders (organization_id, package_id, package_name, credits, price, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.organizationId, p.id, p.name, p.credits, p.price, req.user.id]
    );
    // Нэхэмжлэхийн дугаар: W2S000012 — гүйлгээний утгад бичүүлнэ
    const order = await client.query(
      `UPDATE credit_orders SET invoice_no = 'W2S' || LPAD(id::text, 6, '0')
       WHERE id = $1 RETURNING *`,
      [inserted.rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json(order.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  } finally {
    client.release();
  }
}

async function cancelOrder(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Захиалга олдсонгүй' });
    const result = await pool.query(
      `UPDATE credit_orders SET status = 'cancelled', decided_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND status = 'pending' RETURNING *`,
      [id, req.user.organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ message: 'Зөвхөн төлбөр хүлээгдэж буй захиалгыг цуцална' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

module.exports = { getPackages, getPaymentInfo, getOrders, createOrder, cancelOrder };
