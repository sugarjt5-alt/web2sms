// SMS Worker — Redis Queue-с job-уудыг авч, sms.service ашиглан жинхэнэ (эсвэл mock)
// илгээлт хийж, PostgreSQL дэх message_recipients / messages status-ыг шинэчилнэ.
//
// Тусад нь ажиллуулна: `npm run worker`
const { Worker } = require('bullmq');
const connection = require('../config/redis');
const pool = require('../config/db');
const { sendSms } = require('../services/sms.service');

const worker = new Worker(
  'sms-queue',
  async (job) => {
    const { recipientId, phone, content, messageId } = job.data;

    const result = await sendSms(phone, content);

    if (result.success) {
      await pool.query(
        `UPDATE message_recipients SET status = 'sent', sent_at = NOW(), error = NULL WHERE id = $1`,
        [recipientId]
      );
      await pool.query(
        `UPDATE messages SET sent_count = sent_count + 1 WHERE id = $1`,
        [messageId]
      );
    } else {
      await pool.query(
        `UPDATE message_recipients SET status = 'failed', error = $2 WHERE id = $1`,
        [recipientId, result.error]
      );
      await pool.query(
        `UPDATE messages SET failed_count = failed_count + 1 WHERE id = $1`,
        [messageId]
      );
    }

    // Тухайн message-ийн бүх recipient дууссан эсэхийг шалгаад эцсийн status тавих
    const totals = await pool.query(
      `SELECT total, sent_count, failed_count FROM messages WHERE id = $1`,
      [messageId]
    );
    const { total, sent_count, failed_count } = totals.rows[0];

    if (sent_count + failed_count >= total) {
      let finalStatus = 'sent';
      if (failed_count > 0 && sent_count > 0) finalStatus = 'partial';
      else if (failed_count === total) finalStatus = 'failed';

      await pool.query(`UPDATE messages SET status = $2 WHERE id = $1`, [messageId, finalStatus]);
    }

    return result;
  },
  { connection, concurrency: 5 } // зэрэг 5 SMS хүртэл боловсруулна
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} дууслаа (recipient ${job.data.recipientId})`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} алдаатай:`, err.message);
});

console.log('📡 SMS Worker ажиллаж эхэллээ, job хүлээж байна...');
