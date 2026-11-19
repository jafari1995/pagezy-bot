# ربات تحلیلگر Pagezy

ربات تلگرام با **وب‌هوک** روی **Cloudflare Workers** (D1، KV، R2، Cron، Durable Object).

## دیپلوی (Wrangler)

```bash
cd worker && npm install
npx wrangler d1 migrations apply pagezy-analyst --remote
npm run deploy
```

سکرت‌ها: `TELEGRAM_BOT_TOKEN`, `ALLOWED_USER_IDS`, `OPENROUTER_API_KEY`, `ZARINO_API_KEY`, `ZARINO_API_BASE_URL`, `YOUTUBE_API_KEY`, `TG_API_ID`, `TG_API_HASH`, `TG_SESSION_STRING`.

## تلگرام MTProto

**پیش‌فرض:** GramJS داخل Durable Object (`MtprotoCollector`).  
Telethon فقط برای تست محلی پایتون.  
Container در `services/mtproto-collector` فقط اگر GramJS روی اکانت شما bundle نشود.

## اینستاگرام — Zarino

کلید: `ZARINO_API_KEY` + `ZARINO_API_BASE_URL`  
مسیر پیش‌فرض: `GET /v1/instagram/profile/posts?username=`

اگر قرارداد API زرینو فرق دارد، فایل `worker/src/collectors/instagram/zarino.ts` را با مستندات تیم Pagezy هماهنگ کنید.

## UX

یک دکمه: **تحلیل رقبا** — بقیه مکالمه‌ای با LLM.

## تست محلی

```bash
export MOCK_MODE=true
pytest
python scripts/run_mock_e2e.py
cd worker && npm test
```