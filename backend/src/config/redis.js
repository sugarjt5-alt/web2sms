// Redis холболт (BullMQ-д ашиглана)
const IORedis = require('ioredis');
require('dotenv').config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // BullMQ-ийн шаардлага
});

connection.on('connect', () => console.log('✅ Redis холбогдлоо'));

module.exports = connection;
