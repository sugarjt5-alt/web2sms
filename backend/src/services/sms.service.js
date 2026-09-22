// SMS илгээх provider-уудыг нэг интерфэйс дор нэгтгэсэн service.
// .env дэх SMS_PROVIDER утгаас хамааран mock эсвэл mobicom-ийг ашиглана.
require('dotenv').config();

// --- 1. MOCK PROVIDER ---
// Жинхэнэ SMS явуулахгүй, зүгээр л амжилттай/амжилтгүйг санамсаргүйгээр simulate хийнэ.
// Тест хийхэд болон Mobicom API-тай хараахан холбогдоогүй үед ашиглана.
async function sendViaMock(phone, message) {
  // Сүлжээний хоцролтыг дуурайлган бага зэрэг хүлээе
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

  // ~90% амжилттай, ~10% амжилтгүй гэж тохируулав (test-д тохиромжтой)
  const isSuccess = Math.random() > 0.1;

  if (isSuccess) {
    return { success: true, providerMessageId: `mock-${Date.now()}` };
  }
  return { success: false, error: 'Mock provider: илгээхэд алдаа гарлаа (simulated)' };
}

// --- 2. MOBICOM API (ирээдүйд бодит харилцагчаар солих газар) ---
// Mobicom-ийн албан ёсны SMS Gateway API холбогдох үед энд бичнэ.
// Одоогоор бүтэц нь бэлэн, гэхдээ бодит дуудлага хийхгүй (stub).
async function sendViaMobicom(phone, message) {
  const apiUrl = process.env.MOBICOM_API_URL;
  const apiKey = process.env.MOBICOM_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('MOBICOM_API_URL / MOBICOM_API_KEY тохируулаагүй байна');
  }

  // Жишээ бодит дуудлагын хэлбэр (Mobicom-ийн жинхэнэ API-ийн spec-ээр солино):
  //
  // const response = await fetch(apiUrl, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `Bearer ${apiKey}`,
  //   },
  //   body: JSON.stringify({ to: phone, text: message }),
  // });
  // const data = await response.json();
  // if (!response.ok) return { success: false, error: data.message };
  // return { success: true, providerMessageId: data.id };

  throw new Error('Mobicom provider хараахан холбогдоогүй байна');
}

// Гадагшаа гарах цорын ганц функц — worker үүнийг л дуудна
async function sendSms(phone, message) {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'mobicom') {
    return sendViaMobicom(phone, message);
  }
  return sendViaMock(phone, message);
}

module.exports = { sendSms };
