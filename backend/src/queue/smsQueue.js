// BullMQ Queue — API-аас "SMS илгээ" гэсэн job-уудыг Redis-д тавина.
// Жинхэнэ илгээх ажлыг queue/smsWorker.js дахь Worker гүйцэтгэнэ.
const { Queue } = require('bullmq');
const connection = require('../config/redis');

const smsQueue = new Queue('sms-queue', {
  connection,
  // Дууссан job-уудыг Redis-д үүрд хадгалахгүй (санах ой дүүрэхээс сэргийлнэ)
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 10000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

module.exports = smsQueue;
