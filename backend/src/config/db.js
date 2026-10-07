// PostgreSQL холболт (connection pool)
const { Pool } = require('pg');
require('dotenv').config();

// DB-ийн TIMESTAMP баганууд цагийн бүсгүй, NOW() нь UTC. Node-г ч UTC-ээр ажиллуулж
// хуваарийн цаг, огноо аль ч компьютер дээр зөрөхгүй байлгана. (Frontend өөрийн бүсээр харуулна.)
process.env.TZ = 'UTC';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => console.log('✅ PostgreSQL холбогдлоо'));
pool.on('error', (err) => console.error('❌ PostgreSQL алдаа:', err));

module.exports = pool;
