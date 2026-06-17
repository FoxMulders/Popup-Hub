# Production next steps

Use this checklist after pushing code to GitHub. Live site: [popup-hub.vercel.app](https://popup-hub.vercel.app).

## Quick commands

| Step | Command |
|------|---------|
| Sync env → Vercel | `npm run env:vercel` |
| Apply DB migrations | `npm run db:push` |
| Pre-ship automated QA | `npm run qa:launch` |
| Build + commit + deploy | `npm run ship -- "your message"` |
| Smoke-check production | `npm run verify:prod` |

---

## 1. Environment variables (Vercel)

**Status (2026-06-17):** Core production keys are set on Vercel (Supabase, Square, Maps, cron, OpenRouter). Run `npm run env:vercel:dry` to compare `.env.local` with what would sync.

1. Ensure `.env.local` has real values (copy from `.env.local.example`).
2. Set production app URL in `.env.local` before sync:
   ```
   NEXT_PUBLIC_APP_URL=https://popuphub.ca
   ```
3. Run:
   ```powershell
   .\scripts\sync-vercel-env.ps1
   ```
   Or dry-run first:
   ```powershell
   .\scripts\sync-vercel-env.ps1 -DryRun
   ```
4. Redeploy so functions pick up changed vars:
   ```powershell
   npx vercel deploy --prod --yes
   ```

### Gaps to verify manually

| Item | Action |
|------|--------|
| `SQUARE_CLIENT_SECRET` | Confirm on Vercel if OAuth token exchange fails (`npm run env:vercel`) |
| `NEXT_PUBLIC_APP_URL` | Should be `https://popuphub.ca` (not localhost) |
| `NEXT_PUBLIC_SITE_URL` | Optional — set to `https://popuphub.ca` for OG/canonical metadata |
| `RESEND_API_KEY` / `TWILIO_*` | Optional — email/SMS skip gracefully when unset |
| `STRIPE_*` | Optional — quarter-auction charity flow only |

### Required for production boot

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Required for paid booths

- `NEXT_PUBLIC_SQUARE_APP_ID`
- `NEXT_PUBLIC_SQUARE_LOCATION_ID`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_ENVIRONMENT` (`sandbox` or `production`)
- Square webhook URL: `https://popup-hub.vercel.app/api/square/webhook`

### Optional (graceful skip if unset)

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — browser Maps / Places (website referrer restrictions OK)
- `GOOGLE_MAPS_SERVER_API_KEY` — server Geocoding for publish-time venue verification (**no** website restrictions; Geocoding API only). Falls back to `GOOGLE_MAPS_API_KEY`, then the public key.
- `RESEND_API_KEY` — transactional email
- `TWILIO_*` — SMS notifications
- `STRIPE_*` — quarter-auction charity flow

---

## 2. Supabase migrations

Project ref: `ensbggtbgabogvynqsqt` (see `scripts/push-migrations.ps1`).

**One-time setup:**

```powershell
npx supabase login
npx supabase link --project-ref ensbggtbgabogvynqsqt
```

**Apply pending migrations:**

```powershell
npm run db:push
```

Migrations run through `111_passport_niche_tags.sql` as of this doc.

### Post-migration dashboard tasks

- **Storage buckets:** `booth-clearance-photos`, `avatars`, `vendor-assets` (if not created by migrations)
- **Realtime:** enable for `notifications`, `auctions`, `auction_drops` (Database → Replication)
- **Auth URL configuration** (Supabase → Authentication → [URL Configuration](https://supabase.com/dashboard/project/ensbggtbgabogvynqsqt/auth/url-configuration)):
  - **Site URL:** `https://popuphub.ca` (must NOT be `http://localhost:3000` — that causes Google sign-in to redirect users to localhost)
  - **Redirect URLs** (add all):
    - `https://popuphub.ca/**`
    - `https://popup-hub.vercel.app/**`
    - `http://localhost:3000/**`
    - `https://localhost:3000/**`
  - Google Cloud Console → OAuth client → Authorized redirect URIs must include your Supabase callback: `https://ensbggtbgabogvynqsqt.supabase.co/auth/v1/callback`

---

## 3. Ship pipeline (commit → build → deploy)

After every feature change:

```powershell
npm run ship -- "feat: describe the change"
```

This runs `next build`, commits tracked source (excludes `.next`, `.env*`), pushes `master`, and triggers `vercel deploy --prod`.

Skip commit when you only want build + deploy:

```powershell
.\scripts\ship.ps1 -SkipCommit -Message "hotfix"
```

---

## 4. Production verification

```powershell
npm run verify:prod
```

Checks both `https://popuphub.ca` and `https://popup-hub.vercel.app` (landing, auth, discover, PWA, build-info, sitemap). Use `-BaseUrl` or `-VercelOnly` in `scripts/verify-production.ps1` for a single origin.

Manual checklist: [COORDINATOR_QA.md](./COORDINATOR_QA.md)

Minimum smoke test:

1. `/` loads without 500
2. `/login` and `/signup` render (Supabase client init)
3. Coordinator can sign in and open `/coordinator/dashboard`
4. `/discover` lists published markets (migration `022` applied)
5. Square Connect at `/coordinator/square-connect` (if taking payments)

---

## 5. Vercel Hobby cron limit

Auction auto-end cron runs **once daily** at 09:00 UTC (`vercel.json`). Vercel Hobby rejects schedules more frequent than daily.

For tighter auction timing, either:
- Upgrade to Vercel Pro and change schedule in `vercel.json`, or
- Ping `GET /api/cron/auction-auto-end` with `Authorization: Bearer $CRON_SECRET` from an external scheduler.

---

## 6. Known deferred items (not production blockers)

- Clearance rings on virtualized canvas (only active with 1′ grid overlay)
- Table spacing panel lists each application separately for multi-slot groups
- Legacy saved layouts need re-sync from grouped roster to merge cells
