# Repository Guidelines

## Project Structure & Module Organization
This repository is a small Cloudflare Worker project.

- `src/worker.js`: main Worker entrypoint (HTTP handlers + scheduled trigger logic).
- `wrangler.json`: Worker name, entry file, cron triggers, and `CHECKIN_TARGETS` config.
- `README.md`: setup and manual verification examples.
- `package.json`: local scripts for development, deploy, and log tailing.

Keep runtime logic in `src/`. Avoid placing application code in root-level config files.

## Build, Test, and Development Commands
- `npm install`: install local dependencies (mainly Wrangler).
- `npm run dev`: run Worker locally with Wrangler dev server.
- `npm run deploy`: publish the Worker to Cloudflare.
- `npm run tail`: stream production logs from Cloudflare.
- `npx wrangler secret put SESSION_COOKIE_DKJSIOGU`: set a required secret (repeat for other targets).

Manual smoke checks (after `npm run dev` or deploy):
- `curl -X POST http://localhost:8787/run`
- `curl http://localhost:8787/health`

## Coding Style & Naming Conventions
Follow the style already used in `src/worker.js`:

- JavaScript (ES module syntax), 2-space indentation.
- Semicolons and double quotes.
- `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for shared constants.
- Keep handlers small and extract reusable helpers (for parsing config, response formatting, and target execution).

No linter/formatter is currently configured; keep diffs minimal and style-consistent.

## Testing Guidelines
There is no automated test suite in this repository yet. Validate changes with:

1. Local run via `npm run dev`.
2. Endpoint checks for `/health`, `/run`, and `/run/{target}`.
3. Scheduled behavior verification via `npm run tail`.

When adding tests, place them under `tests/` and name files `*.test.js`.

## Commit & Pull Request Guidelines
Git history is not available in this workspace snapshot, so use a clear conventional format:

- Commit message style: `type(scope): short summary` (example: `fix(worker): handle missing target secret`).
- Keep each commit focused on one change.
- PRs should include: purpose, config/secret changes, manual test evidence (commands + results), and linked issue/task if applicable.

## Security & Configuration Tips
- Never commit real session cookies or secrets.
- Store credentials only with Wrangler secrets.
- Treat `CHECKIN_TARGETS` values as deploy-time configuration, not hardcoded runtime secrets.
