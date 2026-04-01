# Repository Guidelines

## Project Structure & Module Organization
This repository is a TypeScript Cloudflare Worker project.

- `src/worker.ts`: main Worker entrypoint (exports `fetch` + `scheduled` handlers).
- `src/routes.ts`: HTTP route handler (health, run, run/:name, notify-test).
- `src/checkin.ts`: check-in logic — regex classification, cookie handling, single/batch execution.
- `src/telegram.ts`: Telegram report builder and sender.
- `src/targets.ts`: target resolution — loads `targets.json`, derives origin/referer/full URL from base URL.
- `src/types.ts`: shared TypeScript interfaces.
- `src/targets.json`: target definitions (simplified schema, 4 fields per target).
- `wrangler.json`: Worker name, entry file, cron triggers.
- `package.json`: local scripts for development, deploy, and log tailing.

Keep runtime logic in `src/`. Avoid placing application code in root-level config files.

## Build, Test, and Development Commands
- `npm install`: install local dependencies (Wrangler, TypeScript, workers-types).
- `npm run dev`: run Worker locally with Wrangler dev server.
- `npm run deploy`: publish the Worker to Cloudflare.
- `npm run tail`: stream production logs from Cloudflare.
- `npx tsc --noEmit`: type-check without emitting files.
- `npx wrangler secret put COOKIE_XXX`: set a cookie secret for a target.

Manual smoke checks (after `npm run dev` or deploy):
- `curl -X POST http://localhost:8787/run`
- `curl http://localhost:8787/health`

## Coding Style & Naming Conventions
Follow the style already used in `src/`:

- TypeScript (ES module syntax), 2-space indentation.
- Semicolons and double quotes.
- `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for shared constants.
- Keep handlers small and extract reusable helpers.

No linter/formatter is currently configured; keep diffs minimal and style-consistent.

## Testing Guidelines
There is no automated test suite in this repository yet. Validate changes with:

1. `npx tsc --noEmit` for type checking.
2. Local run via `npm run dev`.
3. Endpoint checks for `/health`, `/run`, and `/run/{target}`.
4. Scheduled behavior verification via `npm run tail`.

When adding tests, place them under `tests/` and name files `*.test.ts`.

## Commit & Pull Request Guidelines
- Commit message style: `type(scope): short summary` (example: `fix(checkin): handle missing cookie secret`).
- Keep each commit focused on one change.
- PRs should include: purpose, config/secret changes, manual test evidence, and linked issue/task if applicable.

## Security & Configuration Tips
- Never commit real cookies or secrets.
- Store credentials only with Wrangler secrets.
- Cookie secrets contain the full Cookie header value — copy directly from browser DevTools.
