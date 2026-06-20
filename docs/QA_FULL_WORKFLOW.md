# Full workflow QA test suite

End-to-end checklist for coordinator, vendor, and patron flows: signup, market creation, passport build, applications, booth assignment, publish, and public discovery.

**Current QA handoff:** [QA_TEST_REQUEST.md](./QA_TEST_REQUEST.md) — sprint test request with P0/P1 priorities, sign-off template, and pending-preview appendix (updated 2026-06-20).

**Related:** Coordinator-only deep dive — [COORDINATOR_QA.md](./COORDINATOR_QA.md)

## Run commands (cheat sheet)

| Goal | Command |
|------|---------|
| Local full automated suite | `npm run qa:workflow` |
| Local Playwright workflow only | `npm run test:e2e:workflow` |
| Seed test accounts + fixtures | `npm run seed:test-users` |
| API/DB walkthrough (no browser) | `npx tsx scripts/qa-full-workflow-walkthrough.ts` |
| Pre-ship regression | `npm run qa:launch` |
| Staging/prod HTTP smoke | `npm run verify:prod` (set `PLAYWRIGHT_SMOKE_EVENT_ID` for event pages) |
| Send checklist to QA (Linear) | `npm run qa:handoff` — prod smoke + Linear [POP-5](https://linear.app/popuphub/issue/POP-5) links |

---

## Phase 0 — Environment and accounts

### Local development

- [ ] Migrations applied: `npm run db:push`
- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Dev mock credentials (for Playwright / quick login):

```env
DEV_MOCK_COORDINATOR_EMAIL=coordinator@me.com
DEV_MOCK_COORDINATOR_PASSWORD=testing
DEV_MOCK_VENDOR_EMAIL=vendor@me.com
DEV_MOCK_VENDOR_PASSWORD=testing
DEV_MOCK_SHOPPER_EMAIL=patron@me.com
DEV_MOCK_SHOPPER_PASSWORD=testing
```

- [ ] Seed users and workflow fixtures: `npm run seed:test-users`
- [ ] Dev server: `npm run dev` (or `npm run dev:https` for Square booth payment smoke)
- [ ] Optional: Square sandbox connected for coordinator (`/coordinator/square-connect`)

### Staging / production

- [ ] Provision or reuse three accounts (coordinator, vendor, patron) — **no mock-login** on deployed environments
- [ ] Note market under test: set `PLAYWRIGHT_SMOKE_EVENT_ID` or create a fresh market during Phase 2
- [ ] Confirm email verification completed for new signups
- [ ] Square: sandbox on staging, live credentials only on prod (booth payment is manual)

### Test accounts (local seed)

| Email | Role | Password | Lands on |
|-------|------|----------|----------|
| `coordinator@me.com` | Coordinator | `testing` | `/coordinator` |
| `vendor@me.com` | Vendor | `testing` | `/vendor/dashboard` |
| `patron@me.com` | Patron (shopper) | `testing` | `/discover` |

**Local quick login (dev only):**

- Coordinator: `/api/dev/mock-login?role=coordinator`
- Vendor: `/api/dev/mock-login?role=vendor`
- Patron: `/api/dev/mock-login?role=shopper`

---

## Phase 1 — Auth and role routing

### Patron

- [ ] Guest `/` shows landing with discover / vendors / organizers links
- [ ] `/discover` lists markets without login
- [ ] `/signup?role=shopper` — Patron role selected; signup or login succeeds
- [ ] Post-login lands on `/discover` (or safe `redirectTo`)

### Vendor

- [ ] `/signup?role=vendor` — Vendor role selected
- [ ] Post-login lands on `/vendor/dashboard`
- [ ] Nav **Passport** → `/vendor/passport`
- [ ] `/vendor/activate` path works for shoppers upgrading to vendor

### Coordinator

- [ ] `/signup?role=coordinator` — Coordinator role selected
- [ ] Post-login lands on `/coordinator` (home) or `/coordinator/dashboard` from nav
- [ ] **View your markets** → markets list at `/coordinator/markets`

### Regression (automated)

- [ ] `npm run test:rbac-signup` — all three roles allowed at signup

---

## Phase 2 — Coordinator: build and publish market

Wizard: **Event & Venue** → **Capacity** → **Floor Plan** (`/coordinator/events/new`).

### Step 1 — Event and venue

- [ ] Market name, description (≥15 characters), schedule (future dates)
- [ ] Venue name, address, map pin dropped (or Edmonton venue template selected)
- [ ] Autosave indicator shows saved state
- [ ] **Proceed to Capacity Settings →** advances to Step 2

### Step 2 — Capacity

- [ ] At least one category with booth cap > 0
- [ ] Booth fee configured ($0 allowed)
- [ ] Optional: booth contract reviewed in Step 1
- [ ] **Open Floor Plan Canvas →** advances to Step 3 (skip if “No venue space planning” enabled — 2-step deploy only)

### Step 3 — Floor plan and deploy

- [ ] **Save blank** succeeds (empty shell layout)
- [ ] **Auto-place vendors & save** succeeds when approved vendors exist
- [ ] **Save market** deploys; toast: “Market saved and deployed!”
- [ ] Event hub readiness checklist shows layout + categories complete
- [ ] Status dropdown **Publish Event** sets `published` (if not already deployed)
- [ ] Published market appears on `/discover` and coordinator dashboard

### Optional coordinator setup

- [ ] Square connect: `/coordinator/square-connect`
- [ ] Booth contract editor in wizard Step 1

**Automated (local):** `npm run test:e2e:workflow` — coordinator publish spec uses seeded draft at Step 3.

---

## Phase 3 — Vendor: build passport

Path: `/vendor/passport` — wizard steps **Business Info** → **Category** → **Photos**.

- [ ] Business name filled
- [ ] Primary broad category selected (required for apply)
- [ ] Save completes; passport shows on profile
- [ ] Apply gate: markets show **Apply Now** only when passport is ready (`business_name` + category)

**Local seed:** `npm run seed:test-users` pre-seeds a ready passport for `vendor@me.com`.

---

## Phase 4 — Vendor: discover and apply

- [ ] `/vendor/events` lists published markets
- [ ] Event detail `/vendor/events/[id]` loads
- [ ] **Apply Now** opens dialog: category, payment method, booth contract acknowledgment (if enabled)
- [ ] Submit creates **pending** application
- [ ] Card grid shows **Applied · pending** overlay; re-apply blocked for terminal states
- [ ] Optional: **Complete booth payment** with Square sandbox card (`npm run dev:https`)

---

## Phase 5 — Coordinator: review, approve, assign spaces

- [ ] `/coordinator/events/[id]/applications` — pending application visible
- [ ] **Review** drawer loads vendor passport nested data
- [ ] **Approve Application** (or waitlist / reject); full category shows cap error
- [ ] Floor plan (`/coordinator/events/[id]/setup?step=3` or layout page):
  - [ ] **Auto-place vendors & save** assigns booth numbers, or
  - [ ] Manual drag assigns vendor to booth cell
- [ ] Roster / print (`/coordinator/events/[id]/print`) shows booth numbers
- [ ] Vendor announcement to approved vendors (optional)

**Automated (local):** workflow specs 02–03 cover apply + approve; assign via auto-place when layout allows.

---

## Phase 6 — Market day and operations

See [COORDINATOR_QA.md § Market day](./COORDINATOR_QA.md#market-day) and § Cancellation.

- [ ] `/coordinator/events/[id]/operations` — live ops grid
- [ ] FCFS queue tab
- [ ] `/coordinator/events/[id]/checkin` — toggle check-in, QR dialog
- [ ] Vendor token `/checkin/[token]` works when logged out
- [ ] Print roster renders

---

## Phase 7 — Patron / public discovery

- [ ] `/discover` — market list
- [ ] `/events/[id]` — detail + vendor roster (anonymous)
- [ ] `/events/[id]/map` — patron flow toggle; tabs: Patron flow, Direct to vendor, Browse all
- [ ] Legacy `/shopper/events/[id]` redirects to `/events/[id]`
- [ ] `/coordinators/[id]` — organizer profile

**Automated:**

- [ ] `npm run test:e2e:public-discovery`
- [ ] `npm run test:e2e:shopper-floorplan`
- [ ] Workflow spec 04 (guest discover + map)

### Market-night / passport features (optional)

- [ ] `npm run qa:market-features` — DB tables + lib helpers
- [ ] `npm run qa:market-features:configure` — enable gamification on test event

---

## Phase 8 — Staging / production manual appendix

Run Phases 1–7 in the browser on the target URL. Differences from local:

| Topic | Local | Staging / prod |
|-------|-------|----------------|
| Login | Mock-login or `/login` with seed users | `/login` only; real credentials |
| Signup | Seed skips email verification | Email verification link required |
| OAuth | Optional smoke | Manual only |
| Square | Sandbox via dev connect | Staging sandbox or prod live — manual |
| Google Places | May need manual address entry | Same |
| Automation | `npm run qa:workflow` | `npm run verify:prod` + this checklist |

### Staging smoke (automated HTTP only)

```powershell
$env:PLAYWRIGHT_SMOKE_EVENT_ID = '<published-event-uuid>'
npm run verify:prod
```

---

## Manual-only (document, do not automate)

- Real email signup + verification link click
- Google OAuth signup
- Square OAuth connect + live card payment on production
- Google Places autocomplete failures (fallback: type address manually)
- Community vouch / escrow gates
- Event cancellation + refund retry — [COORDINATOR_QA.md § Cancellation](./COORDINATOR_QA.md#cancellation)

---

## Regression scripts (developer)

```bash
npx tsc --noEmit
npm run qa:launch          # tsc + layout + routing + build
npm run qa:workflow        # seed + RBAC + Playwright workflow + DB walkthrough
npm run test:e2e:workflow  # Playwright workflow specs only
npm run test:e2e           # all Playwright projects
```
