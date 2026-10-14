// Admin: CSV файлаас олон хэрэглэгч нэг дор оруулах.
// Багана: нэр, имэйл, нууц үг (заавал биш — хоосон бол систем үүсгэнэ), утас (заавал биш)
// Мөр бүр бүртгүүлсэн хэрэглэгчтэй ижил: өөрийн бүртгэл (кредит, утас) үүснэ.
// Имэйл нь аль хэдийн бүртгэлтэй бол шинэ хэрэглэгч үүсгэхгүй, зөвхөн утсыг нь шинэчилнэ.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { parseCsv, normalizePhone } = require('../services/csv.util');
const { normalizeEmail, validateNewUser } = require('../services/validate');

const MAX_ROWS = 300; // bcrypt удаан тул нэг файлд хязгаартай

function generatePassword() {
  // Андуурагдах тэмдэгтгүй (0/O, 1/l/I) 10 тэмдэгт
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function isHeader(row) {
  const joined = row.join(' ').toLowerCase();
  return ['имэйл', 'email', 'нэр', 'name'].some((w) => joined.includes(w));
}

// Express 4 async алдааг өөрөө барьдаггүй тул бүхэлд нь хамгаална
async function importUsers(req, res) {
  try {
    await runImport(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ message: 'Серверийн алдаа' });
  }
}

async function runImport(req, res) {
  if (!req.file) return res.status(400).json({ message: 'CSV файл олдсонгүй' });

  let rows = parseCsv(req.file.buffer.toString('utf-8').replace(/^﻿/, ''));
  if (rows.length > 0 && isHeader(rows[0])) rows = rows.slice(1);
  if (rows.length === 0) return res.status(400).json({ message: 'Файл хоосон байна' });
  if (rows.length > MAX_ROWS) {
    return res.status(400).json({ message: `Нэг файлд дээд тал нь ${MAX_ROWS} мөр. Файлаа хуваана уу` });
  }

  const results = []; // { row, email, name, status: 'created'|'updated'|'skipped', reason?, password? }
  const seenEmails = new Set();
  const valid = [];
  const phoneUpdates = []; // бүртгэлтэй имэйл + утас өгсөн мөр → тэр хэрэглэгчийн утсыг шинэчилнэ

  // 1) Мөр бүрийг шалгах
  const emailsInFile = rows.map((r) => normalizeEmail(r[1]));
  const existing = await pool.query('SELECT LOWER(email) AS email FROM users WHERE LOWER(email) = ANY($1)', [emailsInFile]);
  const existingEmails = new Set(existing.rows.map((r) => r.email));

  rows.forEach((r, i) => {
    const rowNo = i + 1;
    const name = (r[0] || '').trim();
    const email = normalizeEmail(r[1]);
    const givenPassword = (r[2] || '').trim();
    const rawPhone = (r[3] || '').trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const skip = (reason) => results.push({ row: rowNo, email: email || r[1] || '', name, status: 'skipped', reason });

    if (seenEmails.has(email)) return skip('Файл дотор давхардсан имэйл');
    if (rawPhone && !phone) return skip('Утасны дугаар буруу');
    if (existingEmails.has(email)) {
      // Бүртгэлтэй хэрэглэгч: утас өгсөн бол шинэчилнэ, үгүй бол алгасна
      if (!phone) return skip('Имэйл системд бүртгэлтэй (утас өгөөгүй)');
      seenEmails.add(email);
      phoneUpdates.push({ rowNo, name, email, phone });
      return undefined;
    }
    const password = givenPassword || generatePassword();
    const invalid = validateNewUser({ name, email, password });
    if (invalid) return skip(invalid);

    seenEmails.add(email);
    valid.push({ rowNo, name, email, password, generated: !givenPassword, phone });
  });

  if (valid.length === 0 && phoneUpdates.length === 0) {
    return res.json({ created: 0, updated: 0, skipped: results.length, results });
  }

  // 2) Нууц үгийн hash (удаан хэсэг — transaction-оос гадуур)
  for (const v of valid) v.hash = await bcrypt.hash(v.password, 10);

  // 3) Нэг transaction-д бичих: хэрэглэгч бүрт өөрийн бүртгэл
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const v of valid) {
      const account = await client.query(
        `INSERT INTO organizations (name, type, phone) VALUES ($1, 'individual', $2) RETURNING id`,
        [v.name.slice(0, 150), v.phone]
      );
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, organization_id, org_role, created_via, phone)
         VALUES ($1, $2, $3, 'user', $4, 'owner', 'import', $5)`,
        [v.name, v.email, v.hash, account.rows[0].id, v.phone]
      );
      results.push({
        row: v.rowNo, email: v.email, name: v.name, phone: v.phone, status: 'created',
        // Автоматаар үүсгэсэн нууц үгийг admin-д нэг удаа буцаана (хэрэглэгчдэд тараах)
        password: v.generated ? v.password : undefined,
      });
    }
    for (const p of phoneUpdates) {
      await client.query('UPDATE users SET phone = $1 WHERE LOWER(email) = $2', [p.phone, p.email]);
      results.push({ row: p.rowNo, email: p.email, name: p.name, phone: p.phone, status: 'updated' });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    return res.status(500).json({ message: 'Импорт амжилтгүй, юу ч өөрчлөгдсөнгүй' });
  } finally {
    client.release();
  }

  results.sort((a, b) => a.row - b.row);
  res.json({
    created: valid.length,
    updated: phoneUpdates.length,
    skipped: results.length - valid.length - phoneUpdates.length,
    results,
  });
}

module.exports = { importUsers, MAX_ROWS };
