<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Session handoff

At the end of every scoped task, update `PM/session-handoff.md` (baseline, shipped work, blockers, next actions). After deploys, run `.\scripts\update-session-handoff.ps1` or use `PM/Deploy-popuphub.bat` / `ship.ps1`, which refresh baseline automatically.

## Release workflow

When the user explicitly asks for a commit:

1. Commit only the intended changes (never `.env` or credentials).
2. `git push -u origin HEAD` (or `git push` if upstream is already set).
3. `npx vercel deploy --prod --yes`

Report the commit hash, push result, and production URL (including https://popuphub.ca when aliased).

Do not force-push `main`/`master` or skip git hooks unless the user explicitly requests it. If a commit fails, fix and create a new commit rather than amending unless amend rules apply.

## Cursor Cloud specific instructions

Popup Hub is a single Next.js 16 app (`npm run dev` → `http://localhost:3000`). Hosted Supabase (`ensbggtbgabogvynqsqt`) is required for data-backed pages (`/discover`, dashboards, mock login).

### Environment

Create `/workspace/.env.local` before running the dev server. Minimum keys:

- `NEXT_PUBLIC_SUPABASE_URL` — `https://ensbggtbgabogvynqsqt.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for `npm run seed:test-users` and server admin paths)
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Pull from Vercel when linked: `npx vercel env pull .env.local --yes` (needs Vercel auth). Optional dev mock users: `DEV_MOCK_COORDINATOR_EMAIL` / `DEV_MOCK_COORDINATOR_PASSWORD` (defaults in `scripts/seed-test-users.ts`).

Without valid Supabase keys the dev server still starts; `/` and `/login` render, but `/discover` and auth flows return empty data (`Invalid API key` in server logs).

### Commands (see `package.json` / `README.md`)

| Task | Command |
|------|---------|
| Install | `npm ci` |
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Build | `npm run build` (CI uses placeholder Supabase env vars) |
| Layout QA (no DB) | `npm run qa:layout`, `npm run qa:regression` |
| E2E | `npx playwright test --project=android-chromium` (Linux has no MS Edge; default `desktop-edge` project fails) |
| E2E vs running dev | `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/public-discovery.spec.ts --project=android-chromium` |
| Seed test users | `npm run seed:test-users` (needs service role key) |
| DB migrations | `npm run db:push` (needs `npx supabase login` + link) |

### Optional services (not needed for core dev)

- **Square sandbox** — paid booth checkout; use `npm run dev:https` + `.cert/` for card payments
- **Stripe** — quarter-auction / wallet top-up
- **Google Maps** — map pins on discover (graceful fallback without key)
- **Master Generator** — Experience Designer at `http://localhost:4000`
- **Local Supabase** — `supabase start` (requires Docker; repo defaults to hosted project)

### Dev server in background

Use tmux so the process survives: `tmux -f /exec-daemon/tmux.portal.conf new-session -d -s next-dev-server -c /workspace -- npm run dev`
