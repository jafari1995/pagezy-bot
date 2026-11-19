# Pagezy Analyst Bot

[فارسی → README.fa.md](README.fa.md)

Telegram **webhook** bot on **Cloudflare Workers** (KV, Durable Objects + DO SQLite, Cron). No D1/R2 required. Owner: **Hamed Jafari**.

## Stack

| Piece | Technology |
|-------|------------|
| Bot | Worker webhook + conversational LLM |
| Persistence | **KV** (`CACHE`) — OpenRouter model list, probes; **PagezyStore DO SQLite** — sessions, brands, posts cache |
| MTProto | GramJS in `MtprotoCollector` DO (`nodejs_compat`) |
| Exports | In-memory → Telegram `sendDocument` (no R2) |
| **Own social analytics** | **[Zernio](https://docs.zernio.com)** `GET /v1/analytics`, account insights |
| **Competitor IG ads** | Zernio `GET /v1/ads/library?platform=meta` (Meta Ad Library) |
| **Competitor IG posts** | **Primary:** Zernio `GET /v1/accounts/{accountId}/instagram/business-discovery` (`ZERNIO_API_KEY`; default account `6af6e7b664a67632e57fced8`). **Optional:** Meta Graph if `META_*` set. |
| Instagram (own) | Zernio + `ZERNIO_INSTAGRAM_ACCOUNT_ID` |
| YouTube | YouTube Data API v3 (or Zernio analytics for connected YT account) |
| LLM | OpenRouter **`:free` only** + KV-cached model list refreshed on cron |

### OpenRouter model chain (default order)

1. `google/gemma-4-31b-it:free`  
2. `google/gemma-4-26b-a4b-it:free`  
3. `nvidia/nemotron-3-ultra-550b-a55b:free`  
4. `nvidia/nemotron-3.5-lightning:free`  
5. `baidu/ernie-5.5-flash-preview:free`  
6. `inclusionai/ling-3.2-flash:free`  
7. Other live `:free` ids from `GET https://openrouter.ai/api/v1/models` (cached in KV)

Cron also refreshes this list. Retries rotate models on 404 / 429 / 5xx.

### What Zernio can and cannot do

| Capability | Zernio | Notes |
|------------|--------|--------|
| Analytics for **your connected** Instagram/YouTube/etc. | Yes | `GET /v1/analytics?accountId=…` |
| Account-level IG insights | Yes | `GET /v1/analytics/instagram/account-insights` |
| **Arbitrary competitor** Instagram post history | Zernio BD (then optional Meta) | Response `{ profile, media[] }` camelCase; `limit` query only (no cursor); **viewCount** on Reels only |
| Competitor **Meta/IG ads** in EU/UK archive | Yes | `GET /v1/ads/library` (40 Meta searches/hour/team) |
| US-only commercial ads | Often **missing** | Meta archive limitation (docs) |
| Telegram channel posts | **No** | Use GramJS DO |

Competitor IG: only `ZERNIO_API_KEY` required (account defaults to `6af6e7b664a67632e57fced8`). Optional `META_IG_USER_ID` + `META_ACCESS_TOKEN` as fallback. Cron probes Zernio BD once (KV).

## Wrangler secrets

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOWED_USER_IDS`, `OPENROUTER_API_KEY`, `ZERNIO_API_KEY`, `ZERNIO_INSTAGRAM_ACCOUNT_ID`, `META_IG_USER_ID`, `META_ACCESS_TOKEN`, `YOUTUBE_API_KEY`, `TG_*`, optional `APIFY_API_TOKEN`, `MOCK_MODE`.

```bash
cd worker && npm install
# Create KV: wrangler kv namespace create CACHE
npm run deploy
```

### `wrangler.toml` bindings (token-compatible)

- **KV** `CACHE` — LLM model cache, Zernio probe flags  
- **Durable Object** `MTPROTO` → `MtprotoCollector` (Telegram MTProto)  
- **Durable Object** `PAGEZY_STORE` → `PagezyStore` (SQLite: brands, sessions, optional post cache)  
- **Cron** `0 */2 * * *` — model refresh + ad scan  
- No `d1_databases`, no `r2_buckets`

## Tests

```bash
python3 -m pytest
MOCK_MODE=true python3 scripts/run_mock_e2e.py
cd worker && npm test
```

## UX

One button **تحلیل رقبا** → conversational flow for sources, ranges, exports, Ad Library brand search.