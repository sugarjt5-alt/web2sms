// Гадны системийн API түлхүүрийг шалгана.
// Header: "Authorization: Bearer w2s_..." эсвэл "X-API-Key: w2s_..."
const pool = require('../config/db');
const { KEY_PREFIX, hashKey } = require('../services/apiKeys');

async function apiKeyAuth(req, res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const key = (req.headers['x-api-key'] || bearer || '').trim();

  if (!key.startsWith(KEY_PREFIX)) {
    return res.status(401).json({ error: 'unauthorized', message: 'API түлхүүр байхгүй эсвэл буруу байна' });
  }

  try {
    const result = await pool.query(
      `SELECT k.id, k.organization_id, k.created_by, o.is_active
       FROM api_keys k JOIN organizations o ON o.id = k.organization_id
       WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
      [hashKey(key)]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: 'unauthorized', message: 'API түлхүүр хүчингүй байна' });
    }
    if (!row.is_active) {
      return res.status(403).json({ error: 'forbidden', message: 'Байгууллагын эрх түр хаагдсан байна' });
    }

    req.apiKey = { id: row.id, organizationId: row.organization_id, createdBy: row.created_by };
    pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]).catch(() => {});
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error', message: 'Серверийн алдаа' });
  }
}

module.exports = apiKeyAuth;
