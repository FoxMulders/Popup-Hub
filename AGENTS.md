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

Single Next.js 16 app (`popup-hub`) backed entirely by Supabase (Postgres/Auth/Storage/Realtime). Personas: Coordinator, Vendor, Patron. The startup update script only runs `npm install`; everything below is manual/per-session.

### Standard commands (see `package.json`)
- Lint: `npm run lint` · Types: `npx tsc --noEmit` · Unit: `npm run test:unit` · RBAC check: `npm run test:rbac-signup` · Build: `npm run build` (webpack, 8 GB heap). These match `.github/workflows/ci.yml` and need no database.
- `tsx` is NOT a dependency; script commands use `npx tsx`, which on a TTY interactively prompts to install. Prefix with `npm_config_yes=true` (CI's non-TTY auto-installs) or the command hangs.

### Local Supabase (required to run the app with data)
- Needs Docker. In this VM install Docker CE and set `/etc/docker/daemon.json` to `{"storage-driver":"fuse-overlayfs","features":{"containerd-snapshotter":false}}` and use `iptables-legacy`, then `sudo service docker start`.
- `npx supabase start` brings up the stack. Get URL/keys from `npx supabase status` (new CLI prints `sb_publishable_…` / `sb_secret_…`, which `supabase-js` accepts as the anon / service-role keys).
- Create `.env.local` (gitignored) with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable>`, `SUPABASE_SERVICE_ROLE_KEY=<secret>`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, and `DEV_MOCK_*` accounts.
- Dev mock auth (only when `NODE_ENV=development`): after Supabase is up, run `node scripts/setup-dev-mock-users.mjs` to create coordinator@coordinator.dev / vendor@vendor.dev / patron@patron.dev (passwords = role name). Then `/login?mock_role=coordinator|vendor|shopper` logs in instantly.

### Known blockers (pre-existing, do not "fix" as part of setup)
- `supabase db reset` / `supabase start` CANNOT apply the migration history cleanly — several early migrations reference columns before they exist: `002` (needs `categories.sort_order`/`is_mlm`), `003` (uses `winner_id`/`pot_cents`; real columns are `winner_user_id`/`pot_amount`), `063` (needs `categories.requires_documentation`). To build a full local schema, apply migrations manually to the running DB with those three patched (add the missing `categories` columns; use the correct auction column names). Applying only `001_initial_schema.sql` gives a coherent-but-partial core schema, but middleware selects `profiles.is_admin` (added later), so coordinator/vendor sessions resolve as `shopper` until the later migrations are applied.
- `next dev` (both Turbopack and webpack) crashes at startup with "cannot use different slug names for the same dynamic path ('eventId' !== 'id')" because `app/vendor/events/[eventId]` and `app/vendor/events/[id]` are siblings. `npm run build` tolerates this, `next dev` does not. To run the dev server, temporarily relocate/rename one of those segments.

### Optional integrations
All self-disable when their env vars are unset (Square, Stripe, Twilio, Resend, web-push/FCM, AI). Exception: the coordinator create-market wizard requires dropping a Google Maps pin, so market creation is blocked without `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Map-free core flows (vendor passport, patron discover, auth/RBAC) work without any third-party keys.
