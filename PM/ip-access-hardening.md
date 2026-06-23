# Popup Hub — IP Access Hardening Audit

**Last audited:** June 22, 2026  
**Auditor:** Engineering (automated repo review)

---

## GitHub repository

| Control | Status | Action required |
|---|---|---|
| Repo visibility | **Private** (assumed — `FoxMulders/Popup-Hub`) | [ ] Confirm at github.com → Settings → Danger Zone (gh CLI not authenticated on dev machine — verify manually) |
| Account 2FA | Unknown | [ ] Enable 2FA on GitHub account (Settings → Password and authentication) |
| Collaborators | Solo developer | [ ] No outside collaborators without NDA + IP assignment |
| Branch protection on `master` | Unknown | [ ] Settings → Branches → require PR review if collaborators added |

---

## Secrets & environment

| Control | Status | Action required |
|---|---|---|
| `.env*` in `.gitignore` | **Pass** — `.env*` ignored | Keep `.env.local` out of commits |
| `CRON_SECRET` | Server-only | [ ] Rotate if ever exposed in logs or commits |
| Supabase service role key | Server-only (`SUPABASE_SERVICE_ROLE_KEY`) | [ ] Never prefix with `NEXT_PUBLIC_` |
| Google Maps API key | Client-visible (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) | [ ] Restrict by HTTP referrer to `popuphub.ca` + localhost in Google Cloud Console |
| Supabase anon key | Client-visible (required for auth) | **Expected** — RLS must enforce row access (verify policies) |
| Square app ID | Client-visible (required for OAuth) | **Expected** — client secret stays server-only |

---

## Server-side IP boundary audit

Core trade secrets **must remain server-side**. Client-exposed env vars reviewed June 22, 2026:

| Variable | Client? | IP risk | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Low | Maps/Places only — restrict referrer |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Low | Public endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Low | RLS-protected |
| `NEXT_PUBLIC_SQUARE_APP_ID` | Yes | Low | OAuth client id only |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Yes | Low | Payment UI |
| `NEXT_PUBLIC_APP_URL` / `SITE_URL` | Yes | None | Public origin |
| `NEXT_PUBLIC_BUILD_*` | Yes | None | Version metadata |
| Layout / clearance / escrow / payment chase logic | Coordinator client + server | **Auth-gated** | HubGrid bundles layout/clearance in authenticated coordinator sessions (expected for interactive canvas); cron/API paths for payment chase and escrow remain server-only. Not exposed via public routes or `robots.txt`-allowed paths. |

**Pass:** Fairness engine, pathfinding, clearance, escrow, and payment chase modules are not referenced from client-only bundles via `NEXT_PUBLIC_*`.

---

## Scraping & API access

| Control | Status |
|---|---|
| `robots.txt` disallows `/api/`, `/coordinator/`, `/vendor/`, `/admin/` | **Pass** (`app/robots.ts`) |
| Terms anti-scrape clause | **Pass** (added June 22, 2026 — `/legal/terms`) |
| Rate limits on public discovery | Partial — nomination rate limit exists; monitor abuse |

---

## Vercel & Supabase teams

| Control | Action required |
|---|---|
| Vercel team members | [ ] Limit to Brad M.; transfer to corp team after incorporation |
| Supabase project access | [ ] Limit to Brad M.; enable MFA on Supabase account |
| Domain registrar lock | [ ] Enable on `popuphub.ca` |

---

## Ongoing discipline

1. Never move layout, clearance, escrow, or dunning logic into `"use client"` modules without server API boundary.
2. Run this audit after adding new `NEXT_PUBLIC_*` variables.
3. Review `PM/trade-secrets-register.md` quarterly.
