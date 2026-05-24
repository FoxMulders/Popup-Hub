# Coordinator E2E QA checklist

Manual smoke test for the coordinator-first MVP. Layout canvas polish is out of scope — Step 4 may use blank or auto-populated floor plans only.

## Setup

- [ ] Dev server running (`npm run dev`)
- [ ] Supabase migrations applied (`npm run db:push`)
- [ ] Square sandbox connected for coordinator account
- [ ] Test vendor account available (optional, for application flow)

## Public discovery (shoppers)

- [ ] Guest `/` shows landing with links to discover, vendors, organizers
- [ ] `/discover` lists published markets without login
- [ ] `/events/[id]` shows market detail + vendor roster (anon)
- [ ] `/events/[id]/map` — floor plan with patron flow toggle and routing modes (Patron flow · Direct to vendor · Browse all)
- [ ] `/coordinators/[id]` shows organizer profile and their markets
- [ ] Legacy `/shopper/events/[id]` redirects to `/events/[id]`

## Auth & navigation

- [ ] Guest `/discover` redirects to shopper browse
- [ ] Coordinator login lands on `/coordinator/dashboard`
- [ ] Nav **Wallet** opens `/wallet` without 404
- [ ] Vendor **Browse Events** → event detail at `/vendor/events/[id]` loads

## Create & publish

- [ ] `/coordinator/events/new` — complete Steps 1–3 with autosave
- [ ] Step 4 — **Save blank floor plan** succeeds
- [ ] Step 4 — **Auto-place vendors & save** succeeds (with approved or test vendors)
- [ ] **Save floor plan & deploy** publishes event (`status: published`)
- [ ] Event hub readiness checklist shows layout + categories complete

## Applications

- [ ] Pending application appears on event hub
- [ ] Approve respects category slot cap (full category shows error)
- [ ] Reject / waitlist sends notification (check `/notifications`)
- [ ] Vendor announcement sends to approved vendors

## Market day

- [ ] `/coordinator/events/[id]/operations` — live ops grid loads
- [ ] FCFS queue tab shows approved vendors in order
- [ ] `/coordinator/events/[id]/checkin` — toggle check-in, QR dialog opens
- [ ] Vendor check-in token URL `/checkin/[token]` works when logged out
- [ ] Print roster (`/coordinator/events/[id]/print`) renders

## Cancellation

- [ ] Cancel event from event hub with reason
- [ ] Paid vendors marked refunded or listed in refund exceptions panel
- [ ] **Retry** on exception calls `/api/events/[id]/refund-retry` successfully

## Regression scripts (optional)

```bash
npx tsc --noEmit
npm run qa:launch          # full pre-ship: tsc + layout + shopper routing + build
npm run qa:launch:fast     # same without production build
npm run qa:layout
npm run test:shopper-routing
npm run test:shopper-routing:live
npm run verify:prod        # HTTP smoke against popup-hub.vercel.app
npm run test:e2e:shopper-floorplan   # Playwright floor plan routing
npm run test:e2e:public-discovery    # Playwright discover + legacy redirect smoke
# Playwright auto-picks http vs https when .cert/localhost.pem exists (override with PLAYWRIGHT_BASE_URL)
```
