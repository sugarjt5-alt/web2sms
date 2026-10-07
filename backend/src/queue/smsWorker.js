// SMS Worker — Redis Queue-с job-уудыг авч, sms.service ашиглан жинхэнэ (эсвэл mock)
// илгээлт хийж, PostgreSQL дэх message_recipients / messages status-ыг шинэчилнэ.
// Бүх хүлээн авагч дуусахад амжилтгүй болсон SMS-ийн кредитийг байгууллагад буцаана.
//
// Тусад нь ажиллуулна: `npm run worker`
const { Worker } = require('bullmq');
const connection = require('../config/redis');
const pool = require('../config/db');
const { sendSms } = require('../services/sms.service');
const { addCredits } = require('../services/credits');

// Хуваарьт мессежийн эхний job ажиллахад 'processing' болгоно.
// Цуцлагдсан бол false буцаана — тэр job-ийг илгээхгүй.
async function startIfScheduled(messageId) {
  await pool.query(
    `UPDATE messages SET status = 'processing' WHERE id = $1 AND status = 'scheduled'`,
    [messageId]
  );
  const result = await pool.query('SELECT status FROM messages WHERE id = $1', [messageId]);
  return result.rows[0]?.status === 'processing';
}

// Мессежийн бүх хүлээн авагч дууссан бол эцсийн status тавьж, failed-ийн кредитийг буцаана.
// "status = 'processing'" нөхцөл нь олон worker зэрэг дуудсан ч зөвхөн нэг удаа ажиллуулна.
async function finalizeIfDone(messageId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE messages SET status = CASE
           WHEN failed_count = 0 THEN 'sent'
           WHEN sent_count = 0 THEN 'failed'
           ELSE 'partial' END
       WHERE id = $1 AND status = 'processing' AND sent_count + failed_count >= total
       RETURNING organization_id, failed_count, cost`,
      [messageId]
    );

    // cost = 0 (admin-ий кредитгүй илгээлт) бол буцаах зүйлгүй
    const msg = result.rows[0];
    if (msg && msg.failed_count > 0 && msg.cost > 0) {
      // Хүн бүрийн SMS-ийн тоо өөр байж болох тул failed хүмүүсийнхийг нэмж буцаана
      const refund = await client.query(
        `SELECT COALESCE(SUM(segments), 0)::int AS amount FROM message_recipients
         WHERE message_id = $1 AND status = 'failed'`,
        [messageId]
      );
      await addCredits(client, {
        organizationId: msg.organization_id,
        amount: refund.rows[0].amount,
        type: 'refund',
        messageId,
        note: `${msg.failed_count} амжилтгүй SMS-ийн буцаалт`,
      });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const worker = new Worker(
  'sms-queue',
  async (job) => {
    const { recipientId, phone, content, messageId } = job.data;

    if (!(await startIfScheduled(messageId))) {
      return { skipped: true }; // цуцлагдсан эсвэл аль хэдийн дууссан
    }

    // Давхар илгээхээс сэргийлж: зөвхөн pending recipient-ийг илгээнэ
    const pending = await pool.query(
      `SELECT 1 FROM message_recipients WHERE id = $1 AND status = 'pending'`,
      [recipientId]
    );
    if (pending.rows.length === 0) return { skipped: true };

    // Provider алдаа шидвэл failed гэж тэмдэглэнэ — мессеж "processing"-д гацахгүй
    let error = null;
    try {
      await sendSms(phone, content);
    } catch (err) {
      error = err.message || 'Тодорхойгүй алдаа';
    }

    const updated = error
      ? await pool.query(
          `UPDATE message_recipients SET status = 'failed', error = $2
           WHERE id = $1 AND status = 'pending' RETURNING id`,
          [recipientId, error]
        )
      : await pool.query(
          `UPDATE message_recipients SET status = 'sent', sent_at = NOW(), error = NULL
           WHERE id = $1 AND status = 'pending' RETURNING id`,
          [recipientId]
        );

    if (updated.rows.length > 0) {
      await pool.query(
        error
          ? `UPDATE messages SET failed_count = failed_count + 1 WHERE id = $1`
          : `UPDATE messages SET sent_count = sent_count + 1 WHERE id = $1`,
        [messageId]
      );
    }

    await finalizeIfDone(messageId);

    return { success: !error, error };
  },
  { connection, concurrency: 5 } // зэрэг 5 SMS хүртэл боловсруулна
);

worker.on('completed', (job, result) => {
  if (result?.skipped) return;
  const status = result?.success ? '✅ илгээгдлээ' : `⚠️ амжилтгүй (${result?.error})`;
  console.log(`Job ${job.id}: ${status} (recipient ${job.data.recipientId})`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} алдаатай:`, err.message);
});

console.log('📡 SMS Worker ажиллаж эхэллээ, job хүлээж байна...');
