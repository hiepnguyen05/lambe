export function redactForGemini(text: string): string {
  const normalized = text
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  // An unlabelled street address cannot be reliably separated from surrounding free text.
  // Drop that turn rather than guess which fragments are safe to send externally.
  if (
    /(?:\b\d{1,5}(?:\/\d+){0,3}\s+(?:[Đđ]ường|[Pp]hố|[Dd]uong|[Pp]ho|[Ss]treet)\b|\b\d{1,5}(?:\/\d+){0,3}\s+\p{Lu}[\p{L}]+\s+\p{Lu}[\p{L}]+|(?:[Cc]ăn hộ|[Cc]an ho|[Ss]ố nhà|[Ss]o nha)\s*[:：]?\s*\d)/u.test(
      normalized,
    )
  )
    return '[Thong tin dia chi rieng tu da duoc luoc bo. Dung chuc nang chon dia chi trong ung dung.]';
  return normalized
    .replace(/https?:\/\/[^\s<>]+/giu, '[lien ket]')
    .replace(
      /\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/giu,
      '[dinh danh]',
    )
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){9,10}\b/g, '[so dien thoai]')
    .replace(/\b\d{6,19}\b/g, '[so rieng tu]')
    .replace(/-?\d{1,2}(?:\.\d+)?\s*[,;]\s*-?\d{1,3}\.\d+/g, '[toa do]')
    .replace(
      /(?:latitude|longitude|lat|lng|lon|vĩ độ|vi do|kinh độ|kinh do)["']?\s*[:=]?\s*-?\d+(?:\.\d+)?/giu,
      '[toa do]',
    )
    .replace(
      /(?:địa chỉ|dia chi|address(?:Line)?|nhà tôi ở|nhà mình ở)["']?\s*[:：=]?\s*[^!?\n]+/giu,
      '[dia chi]',
    )
    .replace(
      /(?:họ tên|ho ten|tên tôi là|tên mình là|fullName|ngày sinh|ngay sinh|CCCD|CMND|hộ chiếu|ho chieu|mật khẩu|mat khau|password|OTP|tài khoản ngân hàng|tai khoan ngan hang)["']?\s*[:：=]?\s*[^!?\n]+/giu,
      '[thong tin rieng tu]',
    );
}

export function explicitlyWantsProvider(text: string): boolean {
  return /(?:tìm|kiếm|gợi ý|giới thiệu|chọn)\s+(?:giúp\s+)?(?:thợ|chuyên viên|salon)|(?:đặt|book)\s+(?:lịch|dịch vụ|thợ)|(?:ai|thợ nào|có thợ nào)\s+(?:làm|cắt|trang điểm)/iu.test(
    text,
  );
}

export function isAffirmativeReply(text: string): boolean {
  const normalized = text
    .normalize('NFC')
    .toLocaleLowerCase('vi-VN')
    .replace(/[.!?…,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(?:ok(?:ay)?|được|đc|dc|ừ|ừm|uh|uhm|đồng ý|được nhé|được nha|tìm đi|tìm giúp(?: mình| tôi)?|xem đi|có)$/.test(
    normalized,
  );
}

export function isClearlyOutOfScope(text: string): boolean {
  return (
    /(?:nuôi mèo|nuôi chó|ăn gì|món ăn|thời tiết|dự báo mưa|lập trình|điện thoại nào)/iu.test(
      text,
    ) &&
    !/(?:tóc|nail|makeup|trang điểm|làm đẹp|massage|chăm sóc da|spa)/iu.test(
      text,
    )
  );
}

export function containsUnsupportedClaim(text: string): boolean {
  const normalized = text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  return /\d[\d.,]*\s*(?:k\b|nghìn\b|ngàn\b|đồng\b|vnd\b|₫|đ\b|km\b)|(?:giá|chi phí|miễn phí|voucher|coupon|mã giảm|khuyến mãi|khuyến mại|ưu đãi|giảm giá|nghìn đồng|ngàn đồng|triệu đồng|lịch trống|còn lịch|đặt lịch|thợ|chuyên viên|salon|hotline|khoảng cách|kil[oô]m[eé]t)/iu.test(
    normalized,
  );
}

export function isPriceInquiry(text: string): boolean {
  return /(?:giá|chi phí|bao nhiêu tiền|bao nhieu tien|báo giá|bao gia)/iu.test(
    text,
  );
}

export function safeConsultationAdvice(text: string): string {
  return text
    .split(/(?<=[.!?])\s+|\n/u)
    .filter(
      (sentence) =>
        !containsUnsupportedClaim(sentence) &&
        redactForGemini(sentence) === sentence,
    )
    .join(' ')
    .trim();
}
