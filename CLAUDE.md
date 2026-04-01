# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps (Wrangler, TypeScript, workers-types)
npm run dev          # local dev server (http://localhost:8787)
npm run deploy       # publish to Cloudflare
npm run tail         # stream production logs
npx tsc --noEmit     # type-check without emitting

# Set secrets (each target has one cookie secret)
# Value = full Cookie header from browser DevTools (e.g. "session=xxx" or "session=xxx; cf_clearance=yyy")
npx wrangler secret put COOKIE_DKJSIOGU
npx wrangler secret put COOKIE_DUCKCODING
npx wrangler secret put COOKIE_LINUXDOAPI
npx wrangler secret put COOKIE_HOTARUAPI
npx wrangler secret put COOKIE_ZHANSI
npx wrangler secret put COOKIE_ZZHDSGSSS
npx wrangler secret put COOKIE_STEPHECURRY
npx wrangler secret put COOKIE_CHENGMO
npx wrangler secret put COOKIE_NIH
npx wrangler secret put COOKIE_HUAN666
npx wrangler secret put COOKIE_AIAPI3W
npx wrangler secret put COOKIE_API925214
npx wrangler secret put COOKIE_IDONTKNOWAPI
npx wrangler secret put COOKIE_ZENSCALEAI
npx wrangler secret put COOKIE_42API
npx wrangler secret put COOKIE_COULSON
npx wrangler secret put COOKIE_APIKEY_WELFARE
npx wrangler secret put COOKIE_DEV88
npx wrangler secret put COOKIE_THATAPI
npx wrangler secret put COOKIE_ELYSIVER
npx wrangler secret put COOKIE_AIDROUTER
npx wrangler secret put COOKIE_DAIJU
npx wrangler secret put COOKIE_MOAPI
npx wrangler secret put COOKIE_LINUXDOEDURS
npx wrangler secret put COOKIE_OPENAI_API_TEST_US_CI
npx wrangler secret put COOKIE_LAOXI
npx wrangler secret put COOKIE_YYBBWAN
npx wrangler secret put COOKIE_SUIMI
npx wrangler secret put COOKIE_DGBMC
npx wrangler secret put COOKIE_MARYDOWN
npx wrangler secret put COOKIE_DUDU
npx wrangler secret put COOKIE_ZHENHAOJI
npx wrangler secret put COOKIE_ARKAPI
npx wrangler secret put COOKIE_JOVERNA
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

Manual smoke tests against local or deployed worker:
```bash
curl http://localhost:8787/health
curl -X POST http://localhost:8787/run             # all targets
curl -X POST http://localhost:8787/run/dkjsiogu   # single target
curl -X POST "http://localhost:8787/run?notify=1"  # run + send Telegram
curl -X POST http://localhost:8787/notify-test     # test Telegram only
```

## Architecture

TypeScript Cloudflare Worker, split into modules under `src/`:

- `worker.ts` — entry point, exports `fetch` and `scheduled` handlers
- `routes.ts` — HTTP route handler (health, run, run/:name, notify-test)
- `checkin.ts` — check-in logic: regex classification, cookie handling, single/batch execution
- `telegram.ts` — Telegram report builder and sender
- `targets.ts` — target resolution: loads `targets.json`, derives `origin`/`referer`/full URL from base URL
- `types.ts` — shared TypeScript interfaces
- `targets.json` — target definitions (simplified schema, 4 fields per target)

**`scheduled`** — triggered by cron (`0 */6 * * *` UTC). Runs all targets in parallel, then sends Telegram summary.

**`fetch`** — HTTP interface:
- `GET /health` — lists targets and Telegram config status
- `POST /run` — runs all targets; `?notify=1` also sends Telegram
- `POST /run/:name` — runs a single named target
- `POST /notify-test` — sends a test Telegram message

### Target Configuration

Targets are defined in `src/targets.json`. Each target (4 fields, rarely 5):

```json
{
  "name": "identifier",
  "url": "https://example.com",
  "newApiUser": "12345",
  "cookieSecret": "COOKIE_IDENTIFIER"
}
```

Derived automatically:
- `origin` = `url`
- `referer` = `{url}/console/personal`
- check-in URL = `{url}/api/user/checkin` (override with `"checkinPath": "/api/user/claim_quota"`)

The `cookieSecret` field names a Wrangler secret whose value is the **full Cookie header** copied from browser DevTools (e.g. `session=xxx` or `session=xxx; cf_clearance=yyy`).

Can also be overridden at runtime via `CHECKIN_TARGETS` env var (JSON array).

### Response Classification

`classifyCheckinState()` pattern-matches the response body against regex lists (`ALREADY_PATTERNS`, `SUCCESS_PATTERNS`, `FAILURE_PATTERNS`) to return `"already"` | `"success"` | `"failed"`. HTTP non-2xx or `ok: false` / `success: false` in JSON body always maps to `"failed"`.

## Code Style

TypeScript ES modules, 2-space indentation, semicolons, double quotes. `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for module-level constants. No linter/formatter configured.

There is no test suite. Validate with `npx tsc --noEmit` + `npm run dev` + the manual curl commands above.
