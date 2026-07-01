# Conversion Engine deploy checklist

Complete these once, then run `bash scripts/run-conversion-engine-ops.sh` locally or the **Conversion Engine Ops** GitHub Action.

## 1. GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Source |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | [Supabase account tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_DB_PASSWORD` | Supabase → Project Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service_role) |
| `VERCEL_TOKEN` | [Vercel account tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Optional — Vercel project settings |
| `VERCEL_PROJECT_ID` | Optional — Vercel project settings |

After secrets exist, run: **Actions → Conversion Engine Ops → Run workflow** (or push a change under `scripts/seed-external-listing-market.ts`).

## 2. Local one-shot (alternative)

Create `.env.local` with the variables above, then:

```bash
bash scripts/run-conversion-engine-ops.sh
```

Or use the Windows path:

```bat
PM\Deploy-popuphub.bat
```

(`Deploy-popuphub.bat` builds, commits, pushes, and deploys — run migration/seed separately if needed.)

## 3. Verify

```bash
npm run verify:conversion-engine
CONVERSION_ENGINE_EVENT_ID=<uuid> npm run verify:conversion-engine -- --live
```

Open HubGrid:

```
https://popuphub.ca/coordinator/studio?event=<uuid>
```

Expect three blurred panels (Vendor Inbox, Map Builder, Invoicing) with **Switch to Native Market (Free)** CTAs.

## 4. API smoke tests

```bash
# Public redirect (external listing only)
curl -i -X POST "https://popuphub.ca/api/v1/markets/<uuid>/track-click"

# Gated route (should 403 when external)
curl -i -X POST "https://popuphub.ca/api/v1/markets/<uuid>/applications"
```

## Current blocker (cloud agent)

GitHub Actions run **28540045728** failed: `SUPABASE_ACCESS_TOKEN` secret is **not configured** on the repository. Until secrets are added, production remains on commit `45dad9f` (pre–Conversion Engine).
