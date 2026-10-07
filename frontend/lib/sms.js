// SMS-ийн хэсгийн (segment) тоо тооцох.
// backend/src/services/smsSegments.js-тэй ижил логик — нэгийг нь өөрчилбөл нөгөөг нь бас өөрчилнө.

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€';

export const MAX_SEGMENTS = 10;

// {нэр} / {name}-ийг хүлээн авагчийн нэрээр орлуулна
// (backend/src/services/messageService.js-ийн personalize-тэй ижил)
const PLACEHOLDER_RE = /\{\s*(нэр|name)\s*\}/gi;
export function personalize(content, name) {
  return content
    .replace(PLACEHOLDER_RE, (name || '').trim())
    .replace(/ +([,.!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function hasPlaceholder(content) {
  return /\{\s*(нэр|name)\s*\}/i.test(content);
}

export function countSms(text) {
  let gsmLength = 0;
  let isGsm = true;
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) gsmLength += 1;
    else if (GSM7_EXTENDED.includes(ch)) gsmLength += 2;
    else { isGsm = false; break; }
  }

  if (isGsm) {
    const segments = gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
    const perSegment = gsmLength <= 160 ? 160 : 153;
    return { encoding: 'GSM-7', length: gsmLength, segments, perSegment };
  }

  const length = text.length;
  const segments = length <= 70 ? 1 : Math.ceil(length / 67);
  const perSegment = length <= 70 ? 70 : 67;
  return { encoding: 'UCS-2', length, segments, perSegment };
}
