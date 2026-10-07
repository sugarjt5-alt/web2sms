// SMS илгээх provider-уудын интерфэйс.
// SMS_PROVIDER орчны хувьсагчаар аль provider ашиглахаа сонгоно: mock | mobicom

async function sendViaMock(phone, content) {
  // Сүлжээний саатлыг дуурайх жижиг хүлээлт
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 500));

  // ~90% магадлалтай амжилттай, бусад нь санамсаргүй failure дуурайна
  const success = Math.random() < 0.9;
  if (!success) {
    throw new Error('Mock provider: sim out of coverage area');
  }
  return { provider: 'mock', messageId: `mock_${Date.now()}_${Math.floor(Math.random() * 10000)}` };
}

async function sendViaMobicom(phone, content) {
  // TODO: Mobicom-ийн бодит API spec-ээр бөглөнө
  // Жишээ нь:
  // const res = await fetch(process.env.MOBICOM_API_URL, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.MOBICOM_API_KEY}` },
  //   body: JSON.stringify({ to: phone, text: content }),
  // });
  // if (!res.ok) throw new Error('Mobicom API алдаа');
  // return await res.json();
  throw new Error('Mobicom provider хараахан тохируулагдаагүй байна');
}

async function sendSms(phone, content) {
  const provider = process.env.SMS_PROVIDER || 'mock';
  if (provider === 'mobicom') {
    return sendViaMobicom(phone, content);
  }
  return sendViaMock(phone, content);
}

module.exports = { sendSms };