const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const migrate = require('./db/migrate');
const { apiLimiter } = require('./middleware/rateLimit.middleware');

// Сул эсвэл анхдагч JWT_SECRET-тэй асвал хэн ч admin токен хуурамчаар үүсгэж чадна
const secret = process.env.JWT_SECRET || '';
if (secret.length < 32 || secret === 'supersecretkey_change_me') {
  console.error('❌ JWT_SECRET хэт богино эсвэл анхдагч утгатай байна (дор хаяж 32 тэмдэгт). Server асахгүй.');
  process.exit(1);
}

const app = express();

// CORS_ORIGIN: таслалаар тусгаарласан зөвшөөрөгдсөн frontend хаягууд
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001,http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiLimiter);

// ---- Routes ----
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/org', require('./routes/org.routes'));
app.use('/api/messages', require('./routes/messages.routes'));
app.use('/api/templates', require('./routes/templates.routes'));
app.use('/api/billing', require('./routes/billing.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/v1', require('./routes/api.routes')); // гадны системд зориулсан API

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route олдсонгүй' });
});

// Алдааг HTML биш JSON-оор буцаана (буруу JSON body, CSV upload алдаа гэх мэт)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Хүсэлтийн JSON буруу байна' });
  }
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Хүсэлт/файл хэт том байна' });
  }
  if (err.name === 'MulterError' || err.message?.includes('.csv')) {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: 'Серверийн алдаа' });
});

const PORT = process.env.PORT || 5000;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ DB migration амжилтгүй:', err.message);
    process.exit(1);
  });
