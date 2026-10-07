// Жинхэнэ CSV стандартыг дэмждэг энгийн parser (quoted утгатай ч ажиллана).
// Гадны library (csv-parse гэх мэт) нэмэлт dependency болгохгүйн тулд
// contacts import шиг энгийн 2 баганатай (нэр, утас) хэрэглээнд зориулж бичсэн.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Windows (\r\n) болон Unix (\n) мөр таслалтыг аль алиныг дэмжинэ
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ',') { row.push(field); field = ''; }
      else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  // Сүүлийн мөрийг (newline-гүйгээр төгссөн бол) бас нэмнэ
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows
    .map((r) => r.map((cell) => cell.trim()))
    .filter((r) => r.some((cell) => cell.length > 0)); // хоосон мөрийг хасна
}

// Утасны дугаарыг цэвэрлэж, хүчинтэй эсэхийг шалгана
function normalizePhone(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-()]/g, '');
  const digitsOnly = cleaned.replace(/^\+/, '');
  if (!/^\d{6,15}$/.test(digitsOnly)) return null;
  return cleaned;
}

// Эхний мөр толгой (header) мөн эсэхийг таамаглана
function looksLikeHeader(row) {
  const joined = row.join(' ').toLowerCase();
  const headerWords = ['name', 'нэр', 'phone', 'утас', 'дугаар'];
  const hasHeaderWord = headerWords.some((w) => joined.includes(w));
  const secondCol = row[1] || row[0] || '';
  const looksLikePhone = normalizePhone(secondCol) !== null;
  return hasHeaderWord && !looksLikePhone;
}

module.exports = { parseCsv, normalizePhone, looksLikeHeader };