// BullMQ Queue — API-аас "SMS илгээ" гэсэн job-уудыг Redis-д тавина.
// Жинхэнэ илгээх ажлыг queue/smsWorker.js дахь Worker гүйцэтгэнэ.
const { Queue } = require('bullmq');
const connection = require('../config/redis');

const smsQueue = new Queue('sms-queue', { connection });

module.exports = smsQueue;
