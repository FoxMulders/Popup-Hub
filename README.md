# Popup Hub

Local market marketplace for coordinators, vendors, and shoppers — booth applications, Square payments, market-day operations, and floor-plan layout.

## Prerequisites

- Node.js 20+
- [Supabase](https://supabase.com) project linked via `.env.local`
- [Square](https://developer.squareup.com) sandbox credentials for paid booth testing

## Environment variables

Copy `.env.local.example` or pull from Vercel. Required keys:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/webhook jobs |
| `NEXT_PUBLIC_APP_URL` | e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_SQUARE_APP_ID` | Square Web Payments |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Square location |
| `SQUARE_ACCESS_TOKEN` | Server-side Square API |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Webhook HMAC validation |

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Guests see a public landing; coordinators and vendors route to their dashboards after sign-in.

### Public pages (no login)

| URL | Purpose |
|-----|---------|
| `/` | Landing for guests |
| `/discover` | Map + list of published markets |
| `/events/[id]` | Shareable market detail + vendor lineup |
| `/coordinators/[id]` | Organizer public profile |

Apply migration `022_public_vendor_roster.sql` so anonymous users can read approved vendor rosters on published events.

Database migrations:

```bash
npm run db:push
```

Layout math smoke tests (optional):

```bash
npm run qa:layout
npm run qa:regression
```

## Coordinator runbook — create & publish a market

1. **Sign in** as a coordinator (`/login` → signup with role coordinator).
2. **Connect Square** at `/coordinator/square-connect` if any category has a paid booth price.
3. **Create event** at `/coordinator/events/new`:
   - **Step 1** — name, schedule, booking mode (juried vs instant), policies.
   - **Step 2** — venue template, map pin, dimensions.
   - **Step 3** — category caps, table length, MLM tier cap if enabled.
   - **Step 4** — floor plan: use **Save blank floor plan** or **Auto-place vendors & save**, then **Save floor plan & deploy**.
4. **Event hub** (`/coordinator/events/[id]`) — readiness checklist, approve applications, send announcements.
5. **Market day** — `/coordinator/events/[id]/operations` (live grid, FCFS, clearance) and `/coordinator/events/[id]/checkin` (QR codes).
6. **Print** — roster and layout from event hub or `/coordinator/events/[id]/print`.
7. **Cancel** — use cancel dialog on event hub; retry failed refunds from the exceptions panel.

See [docs/COORDINATOR_QA.md](docs/COORDINATOR_QA.md) for a manual E2E checklist.

## Layout work (on hold)

Interactive SVG canvas polish, venue photo tuning, and live QA desk wiring are deferred. Step 4 only requires a saved non-overlapping layout (blank shell or auto-populate is fine).

## Deploy

Production: [popup-hub.vercel.app](https://popup-hub.vercel.app). Pushes to `master` auto-deploy on Vercel.

**First-time production setup:** [docs/PRODUCTION_NEXT_STEPS.md](docs/PRODUCTION_NEXT_STEPS.md)

| Task | Command |
|------|---------|
| Sync `.env.local` → Vercel | `npm run env:vercel` |
| Apply Supabase migrations | `npm run db:push` |
| Build + commit + push + deploy | `npm run ship -- "your message"` |
| Smoke-check live site | `npm run verify:prod` |

Production builds use `output: 'standalone'`. Set Square webhook URL to `https://popup-hub.vercel.app/api/square/webhook`.
