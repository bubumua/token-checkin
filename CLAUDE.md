# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install Wrangler
npm run dev          # local dev server (http://localhost:8787)
npm run deploy       # publish to Cloudflare
npm run tail         # stream production logs

# Set secrets (each target has its own session cookie secret)
npx wrangler secret put SESSION_COOKIE_DKJSIOGU
npx wrangler secret put SESSION_COOKIE_DUCKCODING
npx wrangler secret put SESSION_COOKIE_LINUXDOAPI
npx wrangler secret put SESSION_COOKIE_HOTARUAPI
npx wrangler secret put EXTRA_COOKIE_HOTARUAPI   # additional cookies beyond session
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

Single-file Cloudflare Worker (`src/worker.js`) with two handlers:

**`scheduled`** — triggered by cron (`0 */6 * * *` UTC). Runs all configured check-in targets in parallel via `Promise.all`, then sends a Telegram summary.

**`fetch`** — HTTP interface for manual control:
- `GET /health` — confirms targets are parsed and whether Telegram is configured
- `POST /run` — runs all targets; `?notify=1` also sends Telegram
- `POST /run/:name` — runs a single named target
- `POST /notify-test` — sends a test Telegram message without running any check-ins

### Target Configuration

Targets are defined as a JSON array in the `CHECKIN_TARGETS` env var (set in `wrangler.json`). Each target:

```json
{
  "name": "identifier",
  "url": "POST endpoint",
  "origin": "Origin header value",
  "referer": "Referer header value",
  "newApiUser": "value for New-API-User header",
  "sessionSecret": "NAME_OF_WRANGLER_SECRET",
  "cookiePrefix": "(optional) prepended to cookie string",
  "extraCookieSecret": "(optional) name of secret for additional cookies like cf_clearance"
}
```

The session cookie value is never stored in `wrangler.json` — only the secret name is stored there; the actual value lives in Wrangler secrets.

### Response Classification

`classifyCheckinState()` pattern-matches the response body text against three regex lists (`ALREADY_PATTERNS`, `SUCCESS_PATTERNS`, `FAILURE_PATTERNS`) to return `"already"` | `"success"` | `"failed"`. HTTP non-2xx or `ok: false` / `success: false` in JSON body always maps to `"failed"`.

## Code Style

JavaScript ES modules, 2-space indentation, semicolons, double quotes. `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for module-level constants. No linter/formatter configured.

There is no test suite. Validate with local `npm run dev` + the manual curl commands above.
