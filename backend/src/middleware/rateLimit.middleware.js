// Хэт олон хүсэлтээс хамгаалах (нууц үг таах, SMS spam гэх мэт)
const { rateLimit } = require('express-rate-limit');

function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
  });
}

// Login/register: 15 минутад IP бүрээс 20 оролдлого
const authLimiter = limiter(15 * 60 * 1000, 20, 'Хэт олон оролдлого. 15 минутын дараа дахин оролдоно уу');

// SMS илгээх: минутад 20 удаа
const sendLimiter = limiter(60 * 1000, 20, 'Хэт олон илгээлт. Түр хүлээгээд дахин оролдоно уу');

// Бусад бүх API: минутад 300 хүсэлт
const apiLimiter = limiter(60 * 1000, 300, 'Хэт олон хүсэлт. Түр хүлээнэ үү');

module.exports = { authLimiter, sendLimiter, apiLimiter };
