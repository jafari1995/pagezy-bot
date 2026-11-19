# Pagezy Analyst Bot

[فارسی → README.fa.md](README.fa.md)

Telegram **webhook** bot on **Cloudflare Workers** (D1, KV, R2, Cron, **Durable Objects**) for Persian competitor/content analysis. Owner: **Hamed Jafari**.

## Architecture (Workers-first)

| Piece | Where |
|-------|--------|
| Bot webhook + conversation LLM | Worker `worker/src` |
| Persistence | D1 (`worker/migrations`) |
| Report cache | KV / R2 exports |
| Ad scan cron | Worker `scheduled` |
| Telegram channels (MTProto) | **GramJS in `MtprotoCollector` Durable Object** |
| Instagram | **Zarino API** (`ZARINO_API_KEY`, `ZARINO_API_BASE_URL`) |
| YouTube | YouTube Data API v3 |
| Local tests / mock | Python package `src/pagezy_bot` |

### MTProto: Worker vs Container

- **Default:** GramJS inside a **Durable Object** (`worker/src/mtproto/MtprotoCollector.ts`) with `nodejs_compat`. DO stores FloodWait cooldown; each collect connects, reads public channel messages, disconnects.
- **Why not Telethon?** Python does not run on Workers.
- **Why not plain isolate?** Session/FloodWait state needs a single-writer; DO is the smallest Workers-native fit.
- **Containers (`services/mtproto-collector/`):** **Fallback only** if GramJS fails to bundle or MTProto TCP is blocked in your account — set optional secret `MTPROTO_COLLECTOR_URL`. We avoid Containers unless you hit that wall.

### Zarino Instagram

No public Zarino scrape API docs were found (distinct from zernio.com / zarrino.io corporate site). The adapter calls:

`GET {ZARINO_API_BASE_URL}/v1/instagram/profile/posts?username=…`  
`Authorization: Bearer {ZARINO_API_KEY}`

**Owner action:** confirm base URL + response JSON with Zarino team; adjust `worker/src/collectors/instagram/zarino.ts` mapping if fields differ.

## UX

Minimal menu: one button **«تحلیل رقبا»**, then the agent asks conversationally for sources, time range, brand keywords, exports (LLM slot-filling). No multi-step inline wizards.

## Deploy (Wrangler)

```bash
cd worker
npm install
npx wrangler d1 create pagezy-analyst   # set database_id in wrangler.toml
npx wrangler kv namespace create pagezy-cache
npx wrangler r2 bucket create pagezy-exports
npx wrangler d1 migrations apply pagezy-analyst --remote

npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put ALLOWED_USER_IDS
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put ZARINO_API_KEY
npx wrangler secret put ZARINO_API_BASE_URL
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put TG_API_ID
npx wrangler secret put TG_API_HASH
npx wrangler secret put TG_SESSION_STRING
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET

npm run deploy
```

Webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<your-worker>.workers.dev/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Mock E2E (no Telegram):

```bash
npx wrangler dev
curl http://localhost:8787/mock/e2e   # MOCK_MODE=true
```

## Local Python (tests only)

```bash
pip install -e ".[dev]"
export MOCK_MODE=true
pytest
python scripts/run_mock_e2e.py
```

## LLM

OpenRouter **only** models ending in `:free` (enforced in Worker + Python).

## Known limits

| Source | Notes |
|--------|--------|
| Instagram | Zarino contract must match; else partial errors in Persian |
| Telegram Ads | Not enumerable via API — keyword/heuristic monitoring |
| PDF RTL | Worker PDF is basic; full Vazirmatn RTL in Python exports under `fonts/` |

## Repository layout

- `worker/` — production Workers app  
- `src/pagezy_bot/` — shared analysis + local mock  
- `services/mtproto-collector/` — optional Container fallback  
- `fonts/Vazirmatn-Regular.ttf` — RTL PDF (Python export path)