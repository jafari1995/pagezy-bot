const PROMO_PATTERNS = [
  /اسپانسور|تبلیغ|همکاری\s*در\s*فروش|sponsored|#ad/i,
  /تخفیف|کد\s*تخفیف|discount|promo\s*code/i,
  /لینک\s*ربات|t\.me\/|@\w+_bot/i,
  /حمایت\s*شده|paid\s*partnership/i,
];

export function detectPromotional(text: string): { isPromo: boolean; reason?: string } {
  if (!text?.trim()) return { isPromo: false };
  for (const pat of PROMO_PATTERNS) {
    if (pat.test(text)) return { isPromo: true, reason: pat.source.slice(0, 40) };
  }
  if (/[A-Z0-9]{5,}30|[A-Z]{4,}\d+/.test(text)) {
    return { isPromo: true, reason: "کد تخفیف احتمالی" };
  }
  return { isPromo: false };
}