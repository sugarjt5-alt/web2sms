// Байгууллагын кредитийн үлдэгдлийг өөрчилж, гүйлгээг credit_transactions-д бүртгэнэ.
// Заавал transaction доторх client-ээр дуудна (BEGIN ... COMMIT).

// Кредит хасах. Үлдэгдэл хүрэлцэхгүй бол null буцаана (юу ч өөрчлөхгүй).
async function chargeCredits(client, { organizationId, amount, messageId = null, userId = null, note = null }) {
  const result = await client.query(
    `UPDATE organizations SET credits = credits - $1
     WHERE id = $2 AND credits >= $1
     RETURNING credits`,
    [amount, organizationId]
  );
  if (result.rows.length === 0) return null;

  const balance = result.rows[0].credits;
  await client.query(
    `INSERT INTO credit_transactions (organization_id, amount, balance_after, type, message_id, note, created_by)
     VALUES ($1, $2, $3, 'sms', $4, $5, $6)`,
    [organizationId, -amount, balance, messageId, note, userId]
  );
  return balance;
}

// Кредит нэмэх (цэнэглэлт, буцаалт) эсвэл гараар засах (сөрөг amount).
// Үлдэгдэл 0-ээс доош орох бол null буцаана.
async function addCredits(client, { organizationId, amount, type, messageId = null, userId = null, note = null }) {
  const result = await client.query(
    `UPDATE organizations SET credits = credits + $1
     WHERE id = $2 AND credits + $1 >= 0
     RETURNING credits`,
    [amount, organizationId]
  );
  if (result.rows.length === 0) return null;

  const balance = result.rows[0].credits;
  await client.query(
    `INSERT INTO credit_transactions (organization_id, amount, balance_after, type, message_id, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [organizationId, amount, balance, type, messageId, note, userId]
  );
  return balance;
}

module.exports = { chargeCredits, addCredits };
