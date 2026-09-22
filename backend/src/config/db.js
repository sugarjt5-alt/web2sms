// PostgreSQL холболт (connection pool)
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => console.log('✅ PostgreSQL холбогдлоо'));
pool.on('error', (err) => console.error('❌ PostgreSQL алдаа:', err));

module.exports = pool;
