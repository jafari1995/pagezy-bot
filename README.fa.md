# ربات تحلیلگر Pagezy

## Zernio (زرینو = Zernio)

- کلید: `ZERNIO_API_KEY` — `Authorization: Bearer` — پایه: `https://zernio.com/api/v1`
- تحلیل پیج **خودتان** (متصل در Zernio): `ZERNIO_INSTAGRAM_ACCOUNT_ID` + `/v1/analytics`
- **رقیب اینستاگرام:** Zernio پست‌های پیج رقبا را نمی‌دهد — فقط Apify/scraper اختیاری
- تبلیغات Meta/Instagram رقیب: `GET /v1/ads/library?platform=meta&q=…`

## مدل‌های رایگان OpenRouter

زنجیره پیش‌فرض: gemma-4-31b → gemma-4-26b → nemotron-3-ultra → lightning → ernie-5.5 → ling-3.2؛ به‌روزرسانی دوره‌ای در KV.

## دیپلوی

`cd worker && npm run deploy` — جزئیات در README.md