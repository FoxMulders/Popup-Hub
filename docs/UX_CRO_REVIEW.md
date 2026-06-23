# Popup Hub — UX / CRO Review

Grounded audit of live routes as of the backlog implementation pass. Use this document for conversion optimization, onboarding friction reviews, and design-system alignment.

---

## 1. First Impressions & Hero Section

**Route:** `/`

The homepage hero presents three persona pathways (Patrons → Vendors → Organizers) with consistent secondary pill CTAs, including **Open HubGuard** on the vendor card. The lower path cards mirror the same order, reducing cognitive mismatch between hero and scroll content.

**Organizer vs vendor clarity:** Organizers get the emphasized glass card in the hero grid; vendors are steered toward HubGuard trust verification before apply flows. This matches the fraud-prevention narrative but may split vendor intent — some vendors may expect "Apply now" as the primary hero CTA rather than HubGuard.

**CTA friction:** Patron browse uses in-page discover navigation (no auth). Coordinator signup links to `/signup?role=coordinator`. Vendor HubGuard is one click to `/check` with no account required — low friction for trust, higher steps to reach `/vendor/events`.

**Recommendations (Quick Wins):**
- A/B test vendor hero primary CTA: HubGuard vs "Browse open markets"
- Add social proof count near organizer card (published markets, vendors onboarded)

---

## 2. Multi-Sided UX Architecture

### Coordinator — `/coordinator`, setup wizard `/coordinator/events/new`

Wizard summary rail places selections above proceed CTA (shipped). Coordinator home uses `SitePageBand` subtle tone for portal consistency. HubGrid + Allocation Ledger share live `floorPlanStore` — zero desync policy documented in workspace rules.

**Friction:** First market creation spans venue, dates, categories, and payment config — high cognitive load for new organizers. Demo market launcher helps but is below the fold on home.

### Vendor — `/vendor/passport`, `/vendor/events`, `/vendor/applications`

Vendor apply defaults to **Everywhere** (all published markets) with optional distance filter collapsed — distinct from patron Discover (25 km). Passport stories support upload, public strip, and full-screen viewer with swipe.

**Friction:** Juried vs open market distinction requires reading booking mode badges on application rows. Payment due states span Square, e-transfer, and offline confirmation — multiple mental models.

### Patron — `/discover`, `/favorites`

Discover uses `SitePageBand` + map/list with 25 km default radius. Favorites and event detail integrate calendar export.

---

## 3. Visual Design & Component Consistency

**Palette:** Forest (`#2d5a27`), harvest accents, cream/linen surfaces in `globals.css`. Field inputs use `--field-surface` white fill (shipped).

**Typography:** Plus Jakarta Sans body; marketing hero uses white-on-mesh; portal pages use `SitePageBand` subtle strips on vendor dashboard, events, applications, and coordinator home.

**Dashboard scannability:** Vendor dashboard stat cards and application status badges are color-coded. Coordinator studio remains dense — layout canvas competes with ledger for attention on dual-screen setups.

**Gaps:**
- Some legacy `PageIntro` remains on inner coordinator routes
- HubGuard `/check` now uses dedicated shell — good separation from shopper bottom nav

---

## 4. Technical Performance & Friction Points

| Area | Route | Observation |
|------|-------|-------------|
| Layout maps | `/coordinator/studio` | Canvas + ledger sync is live; save is async — users may publish before layout persist completes |
| Registration | `/signup`, `/confirm-email` | Email confirmation enabled locally; production requires Supabase SMTP parity |
| Recurring / multi-day events | `/discover`, event detail | Calendar export handles `event_days`; vendor approval emails attach `.ics` |
| PWA install | global + `/notifications` | Install coach on mobile; delivery settings panel on notifications page |
| Web push | `/notifications`, profile | Subscriptions persist to `push_subscriptions`; VAPID keys required in prod |

**Scroll behavior:** Route scroll-to-top on navigation (shipped) improves tab switching in multi-page flows.

---

## 5. Strategic Recommendations

### Quick Wins
- Homepage vendor CTA A/B (HubGuard vs open markets)
- Coordinator home: elevate demo market + "Create market" above claim suggestions for `marketCount === 0`
- Footer mobile height validated at ~50% reduction — monitor tap target legibility

### Core UX
- Unified payment status copy across vendor applications and coordinator review
- HubGuard → vendor apply handoff: deep link from organizer trust report to pre-filled apply
- Email confirmation resend path at `/confirm-email` with middleware gate

### Feature Enhancements
- Vendor calendar on approval (shipped: email + in-app Add to calendar)
- Passport stories full redesign (shipped: strip, viewer swipe, uploader empty states)
- Patron push for saved-market reminders (web push backend wired; preference grid still localStorage)

---

## Route Reference

| Route | Persona | Primary job |
|-------|---------|-------------|
| `/` | All | Persona routing, trust narrative |
| `/discover` | Patron | Find markets near me |
| `/check` | Vendor/Patron | HubGuard organizer lookup |
| `/vendor/events` | Vendor | Apply to open markets |
| `/vendor/passport` | Vendor | Profile + stories |
| `/vendor/applications` | Vendor | Track status, pay, calendar |
| `/coordinator` | Coordinator | Home, create market |
| `/coordinator/events/new` | Coordinator | Setup wizard |
| `/notifications` | All portals | Feed + push/install settings |

---

*Document generated as part of Popup Hub backlog Wave 6. Update after major UX releases.*
