// Admin: CSV файлаас олон хэрэглэгч (болон шаардлагатай бол байгууллага) нэг дор оруулах.
// Багана: байгууллага (хоосон бол хувь хүн), нэр, имэйл, нууц үг (заавал биш),
//         эрх (эзэн/ажилтан/харилцагч, хоосон бол харилцагч), утас (заавал биш)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { parseCsv } = require('../services/csv.util');
const { normalizeEmail, validateNewUser } = require('../services/validate');
const { normalizePhone } = require('../services/csv.util');

const MAX_ROWS = 300; // bcrypt удаан тул нэг файлд хязгаартай

function generatePassword() {
  // Андуурагдах тэмдэгтгүй (0/O, 1/l/I) 10 тэмдэгт
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function parseRole(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['owner', 'эзэн'].includes(v)) return 'owner';
  if (['member', 'ажилтан'].includes(v)) return 'member';
  if (['client', 'харилцагч'].includes(v)) return 'client';
  return null; // өгөөгүй — харилцагч болно
}

function isHeader(row) {
  const joined = row.join(' ').toLowerCase();
  return ['имэйл', 'email', 'байгууллага', 'organization'].some((w) => joined.includes(w));
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

  const results = []; // { row, email, status: 'created'|'skipped', reason?, password?, organization }
  const seenEmails = new Set();
  const valid = [];

  // 1) Мөр бүрийг шалгах
  const emailsInFile = rows.map((r) => normalizeEmail(r[2]));
  const existing = await pool.query('SELECT LOWER(email) AS email FROM users WHERE LOWER(email) = ANY($1)', [emailsInFile]);
  const existingEmails = new Set(existing.rows.map((r) => r.email));

  rows.forEach((r, i) => {
    const rowNo = i + 1;
    const orgName = (r[0] || '').trim();
    const name = (r[1] || '').trim();
    const email = normalizeEmail(r[2]);
    const givenPassword = (r[3] || '').trim();
    const role = parseRole(r[4]);
    const rawPhone = (r[5] || '').trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const skip = (reason) => results.push({ row: rowNo, email: email || r[2] || '', organization: orgName, status: 'skipped', reason });

    if (seenEmails.has(email)) return skip('Файл дотор давхардсан имэйл');
    if (rawPhone && !phone) return skip('Утасны дугаар буруу');
    if (existingEmails.has(email)) return skip('Имэйл системд бүртгэлтэй');
    const password = givenPassword || generatePassword();
    const invalid = validateNewUser({ name, email, password });
    if (invalid) return skip(invalid);
    if (r[4] && String(r[4]).trim() && !role) return skip('Эрх буруу (эзэн, ажилтан эсвэл харилцагч)');

    seenEmails.add(email);
    valid.push({ rowNo, orgName: orgName.slice(0, 150), name, email, password, generated: !givenPassword, role, phone });
  });

  if (valid.length === 0) {
    return res.json({ created: 0, skipped: results.length, new_organizations: 0, new_individuals: 0, results });
  }

  // 2) Нууц үгийн hash (удаан хэсэг — transaction-оос гадуур)
  for (const v of valid) v.hash = await bcrypt.hash(v.password, 10);

  // 3) Нэг transaction-д бичих
  const client = await pool.connect();
  let newOrgs = 0;
  let newIndividuals = 0;
  try {
    await client.query('BEGIN');
    const orgCache = new Map(); // нэр(жижиг үсгээр) -> { id, isNew }

    for (const v of valid) {
      let org;
      let orgRole;

      if (!v.orgName) {
        // Байгууллагагүй мөр = хувь хүний бүртгэл (өөрийн нэртэй, ганцаараа)
        const created = await client.query(
          `INSERT INTO organizations (name, type, phone) VALUES ($1, 'individual', $2) RETURNING id`,
          [v.name, v.phone]
        );
        org = { id: created.rows[0].id, isNew: true };
        orgRole = 'owner';
        newIndividuals++;
      } else {
        const key = v.orgName.toLowerCase();
        org = orgCache.get(key);
        if (!org) {
          // Зөвхөн байгууллага төрлийнхтэй тулгана (хувь хүний бүртгэлд хүн нэмэхгүй)
          const found = await client.query(
            `SELECT id FROM organizations WHERE LOWER(name) = $1 AND type = 'organization' ORDER BY id LIMIT 1`,
            [key]
          );
          if (found.rows.length > 0) {
            org = { id: found.rows[0].id, isNew: false };
          } else {
            const created = await client.query(
              `INSERT INTO organizations (name, type, phone) VALUES ($1, 'organization', $2) RETURNING id`,
              [v.orgName, v.phone]
            );
            org = { id: created.rows[0].id, isNew: true };
            newOrgs++;
          }
          orgCache.set(key, org);
        }
        // Эрх өгөөгүй бол харилцагч (хэнийг ч автоматаар эзэн болгохгүй)
        orgRole = v.role || 'client';
      }

      await client.query(
        `INSERT INTO users (name, email, password_hash, role, organization_id, org_role, created_via)
         VALUES ($1, $2, $3, 'user', $4, $5, 'import')`,
        [v.name, v.email, v.hash, org.id, orgRole]
      );
      results.push({
        row: v.rowNo, email: v.email, name: v.name, organization: v.orgName, org_role: orgRole,
        individual: !v.orgName,
        status: 'created', new_organization: org.isNew,
        // Автоматаар үүсгэсэн нууц үгийг admin-д нэг удаа буцаана (хэрэглэгчдэд тараах)
        password: v.generated ? v.password : undefined,
      });
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
    skipped: results.length - valid.length,
    new_organizations: newOrgs,
    new_individuals: newIndividuals,
    results,
  });
}

module.exports = { importUsers, MAX_ROWS };
