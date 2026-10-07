// Гадны системд зориулсан нийтийн API: /api/v1/...
const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const apiKeyAuth = require('../middleware/apiKey.middleware');
const { sendSms, getSms, cancelSms, getBalance } = require('../controllers/api.controller');

// API түлхүүр бүрт минутад 120 хүсэлт
const keyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `apikey:${req.apiKey.id}`,
  message: { error: 'rate_limited', message: 'Хэт олон хүсэлт. Түр хүлээнэ үү' },
});

// Хэрэглэгчдийн SMS илгээх эрх хаалттай тул гадны API-г бүхэлд нь хаана.
// Дахин нээх бол API_ENABLED=true тохируулна.
router.use((req, res, next) => {
  if (process.env.API_ENABLED === 'true') return next();
  res.status(403).json({ error: 'forbidden', message: 'API-аар SMS илгээх үйлчилгээ хаалттай байна' });
});

router.use(apiKeyAuth, keyLimiter);

router.post('/sms', sendSms);
router.get('/sms/:id', getSms);
router.post('/sms/:id/cancel', cancelSms);
router.get('/balance', getBalance);

module.exports = router;
