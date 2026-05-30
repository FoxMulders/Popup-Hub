# Quarter Auction — Simple Mode Spec

**Goal:** Run a traditional charity quarter auction night with **≤3 patron-facing steps after the door**, while keeping the existing backend (wallet, entries, draw pool, coordinator state machine).

**Non-goals (v1):** Replacing the coordinator catalog UI, changing draw math, or removing the full “Pro” mode for power users.

---

## 1. Design principles

| Principle | Meaning |
|-----------|---------|
| **Door is the product** | Cash + paddle number assignment happens at a **registration desk** (staff) or one **“I’m here”** screen (self-serve). |
| **Dollars, not credits** | Patrons see **$2 charity paddle · 25¢ per bid per paddle**; credits stay internal. |
| **One auction story** | When simple mode is on, **hide** standalone timer auctions (`/auctions/[id]`) and de-emphasize wallet-first onboarding on the event page. |
| **MC phases, not enums** | Map `active_price_setting → bidding_open → …` to **Shopping · Round 1 · Intermission · Claim prizes · Round 2**. |
| **Reuse clerk desk** | `AuctionClerkDesk` + `/api/coordinator/quarter-auction/.../assist` already implement the traditional door flow; simple mode **elevates** this path. |

---

## 2. Target patron journeys

### A. No smartphone (default happy path for traditional crowds)

| Step | Who | Action | Backend (unchanged) |
|------|-----|--------|---------------------|
| **1** | Staff | Patron gives **$2+ cash** → clerk **top-up** + **assign paddle number(s)** | `cash_top_up`, `purchase_paddles`, `check_in` via assist API |
| **2** | Staff | During live item: clerk **selects patron’s paddles** → **Place bid** | `place_bid` via assist API |
| **3** | Patron | **Hold up physical paddle** (or printed slip with number) | Room ritual; optional SMS “You’re in for item X” later |

**Patron app steps after door: 0** (optional: printed QR to `/events/{id}/quarter-auction?paddle=12` for win notification only).

### B. Has smartphone (simple self-serve)

| Step | Patron | Action | Backend |
|------|--------|--------|---------|
| **1** | Patron | Open event link → **“I’m at the auction”** (staff code or tap; **no GPS** if staff checked them in, else optional GPS) | `participate` or pre-checked via desk |
| **2** | Patron | If no paddles yet: **“Get my paddle — $2 to charity”** (auto-assign **next available** number, not pool grid) | `purchase_paddles` with server-picked numbers |
| **3** | Patron | When item is live: **one button per owned paddle** — “Bid with #12” (multi-tap = multi-paddle bid) | `placeCatalogBidEntries` |

**Steps after door: 3** (check-in implied in step 1, paddle in step 2, bid in step 3).

---

## 3. What to hide or defer (Simple vs Pro)

### Patron UI (`PatronQuarterAuctionLive`, `paddle-chip-picker`, `auction-participation-gate`)

| Current UI | Simple mode | Pro mode (today) |
|------------|-------------|------------------|
| `PaddleChipPicker` pool grid (1–200 cart) | **Hide** — auto-assign or desk-only | Keep |
| Wallet balance + “Top up” link | **Hide** on auction room; show **“Balance: $X (ask desk to add cash)”** | Keep |
| `CharitableImpactTracker` | **Collapse** to one line (“$X raised tonight”) | Full milestones |
| `AuctionParticipationGate` GPS flow | **Skip** if `event_auction_participants` exists (desk check-in) | GPS required |
| Credits copy (`formatCredits`) | **Replace** with `formatDollarsForPatron()` | Keep |
| Multi-select chips + “Bid” | **Replace** with large **“Bid with #N”** buttons (one tap per paddle) | Keep |
| `PaddleHoldScreen` / win modal | **Keep** (matches “hold up paddle”) | Keep |

### Event discovery / entry

| Surface | Simple mode | Pro mode |
|---------|-------------|----------|
| `QuarterAuctionEventBanner` | Single CTA: **“Auction room”** + phase chip | Same + countdown detail |
| Discover “quarter auction” filter | Optional rename: **“Charity auction tonight”** | Keep |
| `/auctions/[id]` timer room | **404 or redirect** when event has catalog QA enabled | Keep for legacy standalone auctions |
| Wallet `/wallet` from auction header | **Remove link**; copy: “Add cash at registration desk” | Keep |

### Coordinator UI (`CoordinatorQuarterAuction`, `AuctionClerkDesk`)

| Surface | Simple mode | Pro mode |
|---------|-------------|----------|
| `AuctionClerkDesk` | **Pinned first** — “Registration desk” | Below fold |
| Settings: `paddle_pool_size`, credits | **Presets only** (“$2 paddle · 25¢ bid”) | Full numeric fields |
| Vendor approval queue | **Keep** (required for catalog) | Keep |
| Catalog drag/reorder | **Keep** | Keep |
| Phase controls | **Relabel** buttons (see §5) | Technical `statusLabel` |
| **New:** `AuctionPhaseBanner` | MC script + “Shopping break” timer | — |
| **New:** `ProjectorDrawPanel` | Large paddle # + entry count | — |

### Same event — other features (defer, don’t block auction)

| Feature | Simple mode |
|---------|-------------|
| Market passport / feed / stories | **Off by default** via event flags or coordinator toggle “Market gamification” |
| Patron GPS market check-in | **Independent** — do not require before auction |
| My Night recap | **After** event completes only |

---

## 4. Data model

Add to `quarter_auction_settings`:

```sql
auction_ui_mode TEXT NOT NULL DEFAULT 'pro'
  CHECK (auction_ui_mode IN ('simple', 'pro'));

-- Optional: auto-assign paddles instead of pool picker
simple_auto_assign_paddles BOOLEAN NOT NULL DEFAULT true;

-- Skip patron GPS when staff checked them in (already supported via event_auction_participants)
simple_skip_gps_when_checked_in BOOLEAN NOT NULL DEFAULT true;

-- Hide timer / standalone auction promos on this event
simple_hide_timer_auctions BOOLEAN NOT NULL DEFAULT true;
```

**Event-level** (optional, for gamification bundle):

```sql
events.market_gamification_enabled BOOLEAN NOT NULL DEFAULT false;
```

Migration `081_quarter_auction_simple_mode.sql` + `types/database.ts` + PATCH in `app/api/quarter-auction/[eventId]/route.ts`.

---

## 5. MC phase mapping (coordinator + patron copy)

| DB status | Simple label (patron) | Simple label (coordinator) | Traditional |
|-----------|----------------------|----------------------------|-------------|
| `queued` / `draft` | — | Up next | Between items |
| `active_price_setting` | **Vendor on stage** | Start presentation | Vendor pitch |
| `bidding_open` | **Bidding open — tap your paddle** | Open bidding | Quarters in bowl |
| `bidding_closed` | **Drawing…** | Close bidding | Volunteers collect |
| `drawing` | **Drawing…** | Roll draw | Draw number |
| `completed` | **Winner: Paddle #N** | Next item | Announce winner |

**Program phases** (coordinator-only metadata, v1 UI only):

| Phase | Purpose |
|-------|---------|
| `shopping` | Patrons browse vendors — no live catalog item |
| `round_1` | Auction block 1 |
| `intermission` | **Claim prizes** CTA on patron room |
| `round_2` | Auction block 2 |
| `closed` | Event over — link to My Night |

Store as `quarter_auction_settings.program_phase` or derive from coordinator button (no schema required for MVP — banner text only).

---

## 6. New / refactored components

| Component | Responsibility |
|-----------|----------------|
| `lib/quarter-auction/ui-mode.ts` | `isSimpleMode(settings)`, copy helpers |
| `lib/quarter-auction/patron-copy.ts` | `paddlePriceLabel`, `bidPriceLabel` (dollars) |
| `components/quarter-auction/simple-patron-room.tsx` | Thin wrapper: steps 2–3 UI |
| `components/quarter-auction/simple-bid-buttons.tsx` | One button per owned paddle |
| `components/quarter-auction/simple-auto-paddle.tsx` | “Get paddle ($2)” → API auto-pick |
| `components/quarter-auction/auction-phase-banner.tsx` | MC phase + intermission claim copy |
| `components/quarter-auction/projector-draw-panel.tsx` | Coordinator fullscreen draw |
| `app/api/quarter-auction/[eventId]/auto-paddle/route.ts` | POST: assign lowest free number |

**Wire-in:** `patron-live-view.tsx` branches on `isSimpleMode(settings)`.

---

## 7. API additions

### `POST /api/quarter-auction/[eventId]/auto-paddle`

- Auth: patron, participated, simple mode.
- Body: `{ count?: 1 }` (default 1 paddle).
- Logic: `fetchTakenPaddleNumbers` → pick lowest free in pool → `purchaseEventPaddles`.
- Response: `{ paddles, newBalance, message: "Paddle #12 — $2 to charity" }`.

### Assist API (existing)

No change required for door mode. Optional: `action: 'door_bundle'` = check_in + cash_top_up + purchase_paddles in one request for clerk speed.

---

## 8. Implementation phases

### Phase 1 — Flag + copy (1–2 days)

- [ ] Migration `auction_ui_mode`
- [ ] Coordinator toggle: **Simple / Pro** in `CoordinatorQuarterAuction` settings
- [ ] `patron-live-view`: hide picker + wallet link when `simple`
- [ ] Dollar labels everywhere in simple branch
- [ ] Banner: suppress timer auction links when `simple_hide_timer_auctions`

### Phase 2 — Patron ≤3 steps (2–3 days)

- [ ] `auto-paddle` route + “Get my paddle” CTA
- [ ] `simple-bid-buttons` (one tap per paddle)
- [ ] Participation gate: skip GPS if already in `event_auction_participants`
- [ ] `auction-phase-banner` with intermission / claim copy

### Phase 3 — Desk-first coordinator (1–2 days)

- [ ] Clerk desk moved to top; “Door bundle” optional
- [ ] `projector-draw-panel` for room display
- [ ] Phase button labels on coordinator dashboard

### Phase 4 — Polish (optional)

- [ ] Print paddle slip (PDF/HTML): number + event name + QR
- [ ] SMS/push when patron wins (if phone on file)
- [ ] Default new charity events to `auction_ui_mode = 'simple'`

---

## 9. Acceptance criteria

**Coordinator**

- Can run full night with **only** clerk desk + coordinator item buttons (no patron app).
- Can switch an event to Simple without breaking existing catalog items.

**Patron (self-serve)**

- After desk check-in OR one tap participate: **≤3 interactions** to place first bid on an open item.
- Never required to understand “credits” or pick from 200-number grid.

**Patron (traditional)**

- Can participate with **zero** app installs if clerk handles door + bids.

**Room**

- Projector shows **entry count** and **winning paddle #** for current item.

---

## 10. File map (quick reference)

| Area | Files |
|------|--------|
| Patron room | `components/quarter-auction/patron-live-view.tsx`, `paddle-chip-picker.tsx`, `auction-participation-gate.tsx` |
| Clerk / door | `components/coordinator/auction-clerk-desk.tsx`, `app/api/coordinator/quarter-auction/[eventId]/assist/route.ts` |
| Coordinator | `components/quarter-auction/coordinator-dashboard.tsx`, `app/coordinator/events/[id]/auctions/page.tsx` |
| Draw / bids | `lib/quarter-auction/place-catalog-bid.ts`, `lib/quarter-auction/draw.ts`, `lib/quarter-auction/catalog.ts` |
| Settings | `quarter_auction_settings`, `app/api/quarter-auction/[eventId]/route.ts` |
| Timer auction (hide) | `components/auction/auction-room.tsx`, `app/(browse)/auctions/[id]/page.tsx` |
| Credits copy | `lib/quarter-auction/credits.ts` → add patron-facing dollar helpers |

---

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Auto-assign paddle feels “unfair” vs picking lucky number | Clerk desk keeps manual pick; auto-assign only for self-serve |
| Two check-ins (market + auction) confuse | Simple mode copy: “Auction check-in = registration desk only” |
| Coordinators still enable gamification + simple | Default gamification off; warn in settings |
| Pro users lose pool picker | Explicit **Pro** toggle per event |

---

## 12. Open questions (decide before Phase 2)

1. **Default mode** for new `listing_type = quarter_auction` events: `simple` or `pro`?
2. **Intermission claim:** tracking only (copy) vs scan-out workflow for prizes?
3. **Physical paddle:** integrate with printed wallet QR or separate auction slip?

---

*Last updated: 2026-05-24 — spec only; implementation tracked in Phase 1–4 checklists above.*
