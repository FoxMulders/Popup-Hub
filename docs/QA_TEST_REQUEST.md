# QA test request — Popup Hub

**Prepared:** 2026-06-20  
**Target environment:** Production — https://popuphub.ca (v1.0.0 **build 218**, commit `80dfa1e`)  
**Pre-flight (2026-06-20):** `npm run verify:prod` — **PASS** (landing, login, signup, discover, PWA, build-info, sitemap on popuphub.ca + vercel.app)  
**Baseline workflow:** [QA_FULL_WORKFLOW.md](./QA_FULL_WORKFLOW.md) (Phases 0–8)  
**Coordinator deep dive:** [COORDINATOR_QA.md](./COORDINATOR_QA.md)

---

## Instructions for QA

1. Run **Section A** (automated pre-checks) if you have a local dev setup; otherwise skip to **Section B** on production.
2. Complete **Section B** (P0 core workflow) — all items must pass before sign-off.
3. Complete **Section C** (P1 recent production features) — report failures with browser, viewport, and steps to reproduce.
4. **Section D** is optional preview testing — only if QA has access to a preview deploy or local branch with pending changes.
5. Record results in **Section E** (sign-off template) and return to the product owner.

---

## Section A — Automated pre-checks (local dev)

Run from repo root after `npm install`, migrations (`npm run db:push`), and `.env.local` configured.

| Step | Command | Pass criteria |
|------|---------|---------------|
| TypeScript | `npx tsc --noEmit` | Exit 0 |
| Layout math | `npm run qa:layout` | Exit 0 |
| Signup RBAC | `npm run test:rbac-signup` | All roles allowed |
| Shopper routing | `npm run test:shopper-routing` | Exit 0 |
| Shopper routing (live) | `npm run test:shopper-routing:live` | Exit 0 |
| Full workflow | `npm run qa:workflow` | Seed + RBAC + Playwright + DB walkthrough pass |
| Pre-ship regression | `npm run qa:launch` | tsc + layout + routing + production build |
| Production HTTP smoke | `npm run verify:prod` | HTTP checks pass on popuphub.ca |

**Playwright-only (requires dev server on :3000):**

```bash
npm run seed:test-users
npm run test:e2e:workflow        # cross-role workflow specs
npm run test:e2e:public-discovery
npm run test:e2e:shopper-floorplan
npm run test:e2e:mobile          # mobile Chrome emulation
```

**Local quick login (dev only):**

| Role | URL |
|------|-----|
| Coordinator | `/api/dev/mock-login?role=coordinator` |
| Vendor | `/api/dev/mock-login?role=vendor` |
| Patron | `/api/dev/mock-login?role=shopper` |

**Local seed accounts:** `coordinator@me.com`, `vendor@me.com`, `patron@me.com` — password `testing`

---

## Section B — P0 core E2E workflow (production manual)

Use real accounts on https://popuphub.ca (no mock-login). Complete [QA_FULL_WORKFLOW.md](./QA_FULL_WORKFLOW.md) Phases 1–7.

### Phase 1 — Auth and role routing

- [ ] Guest `/` shows landing with discover / vendors / organizers links
- [ ] `/discover` lists markets without login
- [ ] `/signup?role=shopper` — patron signup or login succeeds; lands on `/discover`
- [ ] `/signup?role=vendor` — lands on `/vendor/dashboard`; **Passport** nav works
- [ ] `/signup?role=coordinator` — lands on `/coordinator`; **View your markets** works
- [ ] `/login` — email/password and Google OAuth (manual smoke)

### Phase 2 — Coordinator: build and publish

- [ ] `/coordinator/events/new` — Steps 1–3 with autosave
- [ ] Step 1: name, description (≥15 chars), future dates, venue + map pin
- [ ] Step 2: category with booth cap > 0, booth fee ($0 OK)
- [ ] Step 3: save blank **or** auto-place vendors; deploy toast appears
- [ ] Event hub readiness checklist complete
- [ ] **Publish Event** sets published; market appears on `/discover`

### Phase 3 — Vendor: passport

- [ ] `/vendor/passport` — business name + primary category saved
- [ ] Apply gate: **Apply Now** only when passport ready

### Phase 4 — Vendor: discover and apply

- [ ] `/vendor/events` lists published markets
- [ ] `/vendor/events/[id]` — **Apply Now** dialog; submit creates pending application
- [ ] Card shows **Applied · pending**; re-apply blocked

### Phase 5 — Coordinator: approve and assign

- [ ] `/coordinator/events/[id]/applications` — pending visible
- [ ] **Approve Application** respects category cap
- [ ] Floor plan: auto-place or manual assign booth numbers
- [ ] Print roster shows booth numbers

### Phase 6 — Market day (coordinator)

- [ ] `/coordinator/events/[id]/operations` — live ops grid
- [ ] `/coordinator/events/[id]/checkin` — check-in toggle, QR dialog
- [ ] `/checkin/[token]` works logged out

### Phase 7 — Patron / public discovery

- [ ] `/discover` — market list
- [ ] `/events/[id]` — detail + vendor roster (anonymous)
- [ ] `/events/[id]/map` — patron flow toggle; tabs: Patron flow, Direct to vendor, Browse all
- [ ] `/shopper/events/[id]` redirects to `/events/[id]`
- [ ] `/coordinators/[id]` — organizer profile

---

## Section C — P1 recent production features

### C1 — HubGuard trust directory (Patron + Vendor)

- [ ] Nav ribbon shows **HubGuard** with tooltip: *Popup Hub security & fraud prevention*
- [ ] `/check` loads without login; search returns Edmonton seed organizers
- [ ] `/organizers/central-occasion-events` — trust report (scam alerts, mentions, permalinks)
- [ ] `/organizers/lauderdale-community-league` — Lauderdale Community League published
- [ ] Homepage hero CTA: booth-fee headline references HubGuard
- [ ] `/check/review` — organizer dropdown shows full names (not clipped)
- [ ] Vendor: `/vendor/events` callout links to HubGuard
- [ ] Guest `/check/review` — sign-in gate for submission

### C2 — Patron navigation and discover UX

- [ ] Logo from any page → `/` (PublicLanding)
- [ ] Top ribbon: Home, Discover, HubGuard, FAQ on browse surfaces
- [ ] `/discover` — home address field filters markets by distance
- [ ] **Use my location** switches to map view; blue device pin appears
- [ ] Footer sits at bottom of viewport (no gap above footer on short pages)
- [ ] Build number visible in footer
- [ ] Mobile (≤768px): single-row header (logo + role tabs + menu); no second-row tabs
- [ ] Mobile discover: white title on green hero band; splash loader progress bar never rewinds

### C3 — Vendor discover and alerts

- [ ] `/vendor/events` — home address filter + map/list toggle
- [ ] **Use my location** on vendor grid switches to map
- [ ] Geolocation denial shows toast with fallback to address entry

### C4 — Auth and FAQ copy

- [ ] Signup confirmation email copy mentions **link** (not code)
- [ ] Resend confirmation button works
- [ ] Login tab note about email confirmation visible
- [ ] **Continue with Google** below terms checkbox on signup
- [ ] FAQ includes coordinator cancellation item
- [ ] `/for-organizers` mentions cancellation policy

### C5 — Coordinator feature roadmap (deployed 2026-06-19)

- [ ] Blueprint Studio: **Saved layouts** picker — save, load, edit-public toggle
- [ ] Wizard Step 1: paste/drop flyer cover image
- [ ] Mobile wizard Step 3: save-and-continue CTA (no full-screen canvas trap)
- [ ] Blueprint Studio: import layout from photo (paste or upload)
- [ ] Community league venue: league discount field on event form
- [ ] New venue submission → pending in `/admin/venues` → approve → publish unblocks
- [ ] Booth contract editor: Google Docs import (requires Google OAuth connected)
- [ ] `/for-organizers` — event value calculator renders and accepts inputs

### C6 — Coordinator Blueprint Studio (layout)

- [ ] `/coordinator/events/[id]/studio` — canvas + Allocation Ledger split pane
- [ ] Canvas mutation updates ledger rows without manual refresh
- [ ] Clearance bands: green ≥4′, yellow ≥3′, red <3′
- [ ] Category separation: same-category booths ≥4 columns or ≥2 rows apart
- [ ] **Auto-Arrange Floor Plan** in sidebar completes without page freeze
- [ ] Publish blocked when unresolved clearance issues exist
- [ ] Event hub → Layout opens production editor (not stale QA mirror)

### C7 — Vendor invite link (if deployed)

- [ ] Event hub **Vendor invite link** copies shareable URL
- [ ] Incognito: link → vendor signup → lands on `/vendor/events/[id]` apply section

### C8 — Organizer error hardening

- [ ] `/check` shows friendly error page (not blank 500) on simulated failure
- [ ] `/organizers/[slug]` invalid slug shows error boundary, not crash

---

## Section D — Pending deploy (preview / local only)

Skip unless QA is testing a preview URL or local branch. These items are in `PM/session-handoff.md` as **local, not deployed**.

### D1 — Quarter auction setup parity

- [ ] Create quarter auction draft → Step 2 **Add common vendor types** quick-fill
- [ ] Save redirects to `/coordinator/events/{id}/auctions`
- [ ] Live item: coordinator enters bid amount on stage

### D2 — Organizer vendor submissions

- [ ] `/check/review` → **Organizer not listed** nomination flow
- [ ] Admin CLI: `list-organizers.ts --pending` shows submission

### D3 — Venue type relaxation

- [ ] Publish succeeds for bar/gym/community league with dropped pin + complete address (≥10 chars)

### D4 — Mobile native app (Capacitor)

- [ ] iOS/Android shell opens on `/discover` (patron) or `/vendor/events` (vendor)
- [ ] Vendor quick-apply + haptics on native
- [ ] Alert onboarding on first vendor events visit
- [ ] Run `npm run test:e2e:mobile` on preview build

### D5 — Patron + vendor mobile web polish

- [ ] CI lint rename: **Use my location** still works after `requestMyLocation` refactor

---

## Section E — Sign-off template

| Field | Value |
|-------|-------|
| Tester name | |
| Date tested | |
| Environment | Production / Preview / Local |
| Build number (footer) | |
| Browser(s) | |
| Devices tested | Desktop / Mobile iOS / Mobile Android |

### Results summary

| Section | Pass | Fail | Blocked | Notes |
|---------|------|------|---------|-------|
| A — Automated | | | | |
| B — P0 core workflow | | | | |
| C — P1 recent features | | | | |
| D — Pending preview | | | | |

### Failures (required for any Fail)

| # | Section | Steps to reproduce | Expected | Actual | Screenshot/link |
|---|---------|-------------------|----------|--------|-----------------|
| 1 | | | | | |

### Blockers

| # | Description | Owner |
|---|-------------|-------|
| | | |

**QA sign-off:** ☐ Approved for release  ☐ Approved with minor issues  ☐ Blocked — do not release

---

## Manual-only (never automate)

- Real email signup + verification link click
- Google OAuth signup on production
- Square OAuth connect + live card payment
- Google Places autocomplete offline fallback
- Community vouch / escrow gates
- Event cancellation + refund retry ([COORDINATOR_QA.md § Cancellation](./COORDINATOR_QA.md#cancellation))

---

## Reference — production smoke command

```powershell
$env:PLAYWRIGHT_SMOKE_EVENT_ID = '<published-event-uuid>'
npm run verify:prod
```

Staging workflow smoke:

```powershell
.\scripts\qa-full-workflow.ps1 -StagingSmoke
```
