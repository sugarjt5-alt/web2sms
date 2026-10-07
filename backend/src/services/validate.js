// Оролтын өгөгдөл шалгах туслах функцууд

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Алдааны мессеж буцаана, зөв бол null
function validateNewUser({ name, email, password }) {
  if (!name || !String(name).trim() || !email || !password) {
    return 'Бүх талбарыг бөглөнө үү';
  }
  if (String(name).trim().length > 100) return 'Нэр хэт урт байна';
  if (!EMAIL_RE.test(normalizeEmail(email))) return 'Имэйл хаяг буруу байна';
  if (String(password).length < MIN_PASSWORD) {
    return `Нууц үг дор хаяж ${MIN_PASSWORD} тэмдэгт байх ёстой`;
  }
  return null;
}

// Route-ийн :id параметрийг эерэг бүхэл тоо болгоно, буруу бол null
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Байгууллага доторх эрх: owner (эзэн) | member (ажилтан) | client (харилцагч)
const ORG_ROLES = ['owner', 'member', 'client'];
function parseOrgRole(value, fallback = 'member') {
  return ORG_ROLES.includes(value) ? value : fallback;
}

module.exports = { normalizeEmail, validateNewUser, parseId, ORG_ROLES, parseOrgRole };
