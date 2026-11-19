# ربات تحلیلگر Pagezy

## Zernio (زرینو = Zernio)

- کلید: `ZERNIO_API_KEY` — `Authorization: Bearer` — پایه: `https://zernio.com/api/v1`
- تحلیل پیج **خودتان** (متصل در Zernio): `ZERNIO_INSTAGRAM_ACCOUNT_ID` + `/v1/analytics`
- **رقیب اینستاگرام:** Meta Business Discovery (`META_IG_USER_ID` + `META_ACCESS_TOKEN`)؛ بازدید معمولاً نیست — لایک/کامنت
- جایگزین Zernio: `GET /v1/accounts/{accountId}/instagram/business-discovery` (حساب متصل: `6af6e7b664a67632e57fced8`)
- تبلیغات Meta/Instagram رقیب: `GET /v1/ads/library?platform=meta&q=…`

## مدل‌های رایگان OpenRouter

زنجیره پیش‌فرض: gemma-4-31b → gemma-4-26b → nemotron-3-ultra → lightning → ernie-5.5 → ling-3.2؛ به‌روزرسانی دوره‌ای در KV.

## دیپلوی

`cd worker && npm run deploy` — جزئیات در README.md