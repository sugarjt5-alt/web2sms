// SMS-ийн хэсгийн (segment) тоо тооцох.
// Латин (GSM-7): 1 хэсэг = 160 тэмдэгт, олон хэсэгтэй бол 153.
// Кирилл гэх мэт бусад (UCS-2): 1 хэсэг = 70 тэмдэгт, олон хэсэгтэй бол 67.
// frontend/lib/sms.js-д ижил логик бий — нэгийг нь өөрчилбөл нөгөөг нь бас өөрчилнө.

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€';

const MAX_SEGMENTS = 10;

function countSms(text) {
  let gsmLength = 0;
  let isGsm = true;
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) gsmLength += 1;
    else if (GSM7_EXTENDED.includes(ch)) gsmLength += 2;
    else { isGsm = false; break; }
  }

  if (isGsm) {
    const segments = gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
    return { encoding: 'GSM-7', length: gsmLength, segments };
  }

  const length = text.length; // UCS-2: UTF-16 code unit-ээр тоолно
  const segments = length <= 70 ? 1 : Math.ceil(length / 67);
  return { encoding: 'UCS-2', length, segments };
}

module.exports = { countSms, MAX_SEGMENTS };
