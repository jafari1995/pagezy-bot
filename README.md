# Pagezy Analyst Bot

[فارسی → README.fa.md](README.fa.md)

Telegram **webhook** bot on **Cloudflare Workers** (D1, KV, R2, Cron, **GramJS Durable Object**). Owner: **Hamed Jafari**.

## Stack

| Piece | Technology |
|-------|------------|
| Bot | Worker webhook + conversational LLM |
| MTProto | GramJS in `MtprotoCollector` DO (`nodejs_compat`) |
| **Own social analytics** | **[Zernio](https://docs.zernio.com)** `GET /v1/analytics`, account insights |
| **Competitor IG ads** | Zernio `GET /v1/ads/library?platform=meta` (Meta Ad Library) |
| **Competitor IG posts** | **Meta Graph Business Discovery** (`META_IG_USER_ID` + `META_ACCESS_TOKEN`); fallback `GET /v1/accounts/{id}/instagram/business-discovery` (Zernio); optional Apify/scraper |
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
| **Arbitrary competitor** Instagram post history | Via **Business Discovery** only | Meta Graph or Zernio `.../instagram/business-discovery`; **views usually null** on competitor posts (likes/comments OK; Reels may have viewCount via Zernio path) |
| Competitor **Meta/IG ads** in EU/UK archive | Yes | `GET /v1/ads/library` (40 Meta searches/hour/team) |
| US-only commercial ads | Often **missing** | Meta archive limitation (docs) |
| Telegram channel posts | **No** | Use GramJS DO |

Competitor IG: set `META_IG_USER_ID` + `META_ACCESS_TOKEN` (token from the connected Page/IG app). Zernio account `6af6e7b664a67632e57fced8` for fallback/probe. Startup cron probes Zernio BD once (KV).

## Wrangler secrets

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOWED_USER_IDS`, `OPENROUTER_API_KEY`, `ZERNIO_API_KEY`, `ZERNIO_INSTAGRAM_ACCOUNT_ID`, `META_IG_USER_ID`, `META_ACCESS_TOKEN`, `YOUTUBE_API_KEY`, `TG_*`, optional `APIFY_API_TOKEN`, `MOCK_MODE`.

```bash
cd worker && npm install
npx wrangler d1 migrations apply pagezy-analyst --remote
npm run deploy
```

## Tests

```bash
python3 -m pytest
MOCK_MODE=true python3 scripts/run_mock_e2e.py
cd worker && npm test
```

## UX

One button **تحلیل رقبا** → conversational flow for sources, ranges, exports, Ad Library brand search.