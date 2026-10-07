// API түлхүүр үүсгэх, hash хийх
const crypto = require('crypto');

const KEY_PREFIX = 'w2s_';

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Шинэ түлхүүр: w2s_ + 40 тэмдэгт. Хэрэглэгчид зөвхөн нэг удаа харагдана.
function generateKey() {
  const key = KEY_PREFIX + crypto.randomBytes(30).toString('base64url');
  return { key, prefix: key.slice(0, 12), hash: hashKey(key) };
}

module.exports = { KEY_PREFIX, hashKey, generateKey };
