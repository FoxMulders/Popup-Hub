# Session handoff ? PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Active work - Blueprint/HubGrid responsive floor-plan guard (local, not deployed)
- **Baseline:** Branch `cursor/blueprint-layout-responsiveness-ec21` from commit `f119b94` (`feat: ship local changes`). Production/build metadata unchanged by this QA patch.
- **Goal:** QA scan Blueprint Studio / dashboard / layout views for missing small-screen defensive UI around floor-plan canvas and booth matrix surfaces.
- **Shipped locally:**
  - **Shared warning:** Added `FLOOR_PLAN_MATRIX_DESKTOP_REQUIRED_MESSAGE` + `FloorPlanMatrixDesktopRequiredNotice` with `data-testid="floor-plan-matrix-desktop-required"` for the designated floor-plan matrix small-screen regression copy.
  - **Standalone matrix:** `/coordinator/studio/ledger` (`DashboardLedgerWindowClient`) now uses `FloorPlanViewportLayoutProvider`; sub-1024px/550px viewports render the matrix warning instead of mounting the presenter/wall-cast matrix.
  - **Spatial layout editor:** `/coordinator/events/[id]/layout` now has a client-side viewport guard in addition to the server mobile UA redirect; the floor-plan canvas unmounts when `showDesktopRequired` is active.
  - **QA mirrors:** `src/qa_review` and `qa_review/coordinator-site-recovery` floor-plan wizard/spatial components now use the same provider + desktop-required overlay pattern.
- **Verify:** `git diff --check` PASS; focused `npm run lint -- <touched files>` PASS; `npx tsc --noEmit --pretty false` PASS.
- **Blockers:** None. `node_modules/next/dist/docs` was not present in this workspace, so Next-specific docs could not be read locally before editing.
- **Next:** PR review; optional browser smoke on `/coordinator/studio/ledger` and `/coordinator/events/[id]/layout` at 390x844 and >=1024x550 to visually confirm warning vs canvas/matrix behavior.

## Active work — HubGuard review organizer loop (deployed 2026-06-20)
- **Goal:** Vendor event reviews notify the organizer; organizer can respond; past-event notes copy + grain-of-salt guidance for booth/neighbour complaints.
- **Shipped:**
  - **Notifications:** `hubguard_vendor_review` (coordinator) + `hubguard_review_response` (vendor); migration `121_hubguard_review_notifications.sql` applied on Supabase.
  - **Submit flow:** `notifyOrganizerOfVendorReview` on published review insert.
  - **Respond API:** `POST /api/organizers/reviews/[reviewId]/respond` + `OrganizerReviewRespondForm` on trust report when claim holder.
  - **Public list:** organizer responses on `/organizers/[slug]#vendor-reviews`.
  - **Form copy:** optional notes reframed for post-event reflection; booth/neighbour grain-of-salt helper text.
  - **Build fix:** `export const dynamic = 'force-dynamic'` on `app/notifications/layout.tsx` (shipped in same commit).
- **Verify:** `npx tsc --noEmit` PASS. Smoke: submit review → coordinator notification; claim holder responds → vendor notification + response on trust report.
- **Next:** Smoke on prod — submit review, respond as claim holder, confirm notifications deep-link.

## Active work ? HubGuard brand logo (local, not deployed)
- **Goal:** Process shield+stall+pin HubGuard lockup and replace generic shield icons on trust surfaces.
- **Shipped locally:**
  - **`scripts/import-hubguard-logo.mjs` / `process-hubguard-logo.mjs`:** Transparent PNGs ? full lockup (`hubguard-logo.png` 640?634) + emblem icon (`hubguard-icon.png` 512?512); splits wordmark from emblem via vertical gap detection.
  - **`components/brand/hubguard-logo.tsx`:** `lockup` | `icon` variants, sm/md/lg sizes.
  - **Wired:** `/check` hero, `/check/review`, vendor check-in prompt, vendor events callout, coordinator claim callout, `/for-vendors` hero link.
  - **`npm run assets:hubguard`:** Regenerate from `hubguard-logo-source.png`.
  - **`public/sw.js`:** Cache v18 includes HubGuard PNGs.
- **Verify:** Hard refresh `/check` ? HubGuard lockup in hero; icon in vendor callouts. `npm run assets:hubguard` after replacing source PNG.
- **Next:** Commit + deploy when user asks.

- **Goal:** Wire Tipsy Fox ? Popup Hub origin narrative into marketing surfaces (CRO origin proof).
- **Shipped:**
  - **`lib/marketing/origin-story.ts`:** Short homepage copy + full About sections (four beats).
  - **`marketing-split-story.tsx`:** Replaced generic ?built by market people? with punchy origin + kept platform benefit bullets.
  - **`/legal/about`:** Full origin story above existing fee/transparency sections; metadata updated.
- **Verify:** `npx tsc --noEmit` PASS. Smoke: `/` split-story section; `/legal/about` origin + fees flow.
- **Next:** Optional Tipsy Fox photography in split-story visual tile.

## Active work ? SEO P0/P1 implementation (deployed 2026-06-20)
- **Goal:** Implement audit recommendations ? metadata, schema, landing pages, sitemap/robots, performance hints.
- **Shipped locally:**
  - **OG image:** `app/opengraph-image.tsx` (1200?630); `DEFAULT_OG_IMAGE_PATH` ? `/opengraph-image`.
  - **Homepage:** canonical + `og:url` via `buildPublicMetadata`; `revalidate = 60` on `/`.
  - **Layout:** removed blanket `force-dynamic`; anonymous metadata uses full public SEO bundle.
  - **`/for-vendors`:** landing + FAQ/Service JSON-LD; nav/footer/ path cards point here (not signup).
  - **City SEO:** `/markets/edmonton`, `/markets/calgary` ? SSR event lists, CollectionPage + breadcrumb schema.
  - **Schema:** WebSite `SearchAction` (HubGuard); Event `GeoCoordinates`; breadcrumbs on events + organizers.
  - **Signup:** `noIndex` via `app/(auth)/signup/layout.tsx`.
  - **Sitemap:** +for-vendors, +city pages; removed thin patron/coordinator profile URLs.
  - **Robots:** allow `/for-vendors`, `/markets/`, `/organizers/`.
  - **Footer:** marketing links (Discover, Organizers, Vendors, HubGuard, About).
  - **GSC hook:** `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`; social `NEXT_PUBLIC_ORG_SOCIAL_URLS` (comma-separated).
- **Verify:** `npx tsc --noEmit` PASS. Smoke: `/`, `/for-vendors`, `/markets/edmonton`, `/opengraph-image`, `/sitemap.xml`, view-source canonical on `/`.
- **Next:** Set env vars in Vercel; submit sitemap in GSC. Deferred: event URL slugs, blog/content hub.

- **Goal:** Replace all Popup Hub logo instances (static + loader animation) with the new glossy green stall + blue pin artwork.
- **Shipped locally:**
  - **`scripts/import-location-tent-logo.mjs`:** Auto-picks the largest icon from composite sheets (1024 PNG side preferred); removes black backdrop; writes `popup-hub-icon-source.png` + `popup-hub-logo.png`.
  - **`npm run assets:logo`:** Regenerated light + **dark** marks: `popup-hub-brand.png`, `popup-hub-brand-dark.png`, icons, favicons, PWA, `app/icon.png`.
  - **Theme-aware logos:** `lib/brand/brand-logo-paths.ts`, `hooks/use-brand-logo-src.ts` ? swaps on `.dark` class or `prefers-color-scheme: dark`; wired into nav logo, initial loader, market animation replay.
  - **Loader animation:** Pin overlay + glow blue (`#105fc1`); `pinOffsetY` / `LOGO_ICON_ANCHOR_Y` ? **0.57**.
  - **`public/sw.js`:** Cache bumped to `v16` (includes dark PNGs).
- **Verify:** Hard refresh; toggle OS dark mode (or add `class="dark"` on `<html>`) ? nav logo + loader animation use dark variant.
- **Next:** Commit + deploy when user asks. Optional: wire `ThemeProvider` for in-app dark toggle; drop lossless dark SVG/1024 PNG into `popup-hub-icon-source-dark.png` for sharper upscaling.

**Deploy gate:** `PM\Deploy-popuphub.bat` ships when you have uncommitted changes or undeployed handoff sections. Commit messages auto-resolve from `## Shipped this session (title, not deployed)`, then `## Active work ? title (local, not deployed)`, then `feat: ship local changes`. After deploy, matched sections flip to `deployed yyyy-MM-dd`. Clean tree with nothing undeployed ? no-op (exit 0). Use `-SkipCommit` to redeploy production without a new commit.

**Semver:** Footer `vX.Y.Z` tracks conventional commits since the 1.0.0 baseline (`8aea984`). Deploy/ship bumps `major:` ? major, `feat:` ? minor, `fix:` ? patch (`docs:`/`chore:` unchanged). Build counter stays separate. Retroactive sync: `npm run version:sync-history`.

## Active work ? semver sync from release history (local, not deployed)
- **Goal:** Align `package.json` semver with shipped `feat`/`fix`/`major` commits; auto-bump on every deploy going forward.
- **Shipped locally:**
  - **`scripts/bump-package-version.mjs`:** Infers bump from commit message; `--from-history` replays log since `8aea984`.
  - **`deploy-popuphub.ps1` / `ship.ps1`:** Bump semver before build when committing (skipped on `-SkipCommit`).
  - **`package.json` / `build-number.json` / `package-lock.json`:** `1.0.0` ? **`1.100.0`** (100 `feat` since baseline, 4 `fix` absorbed by later minors).
  - **`PM/ios-testflight.md`:** Version table updated.
- **Verify:** `node scripts/bump-package-version.mjs --message "feat: x" --dry-run` ? `1.101.0`; `fix:` ? `1.100.1`; `docs:` unchanged.
- **Next:** Commit + deploy when user asks.

## QA handoff ? full workflow test request (2026-06-20)
- **Checklist:** `docs/QA_TEST_REQUEST.md` ? P0 core E2E (Phases 1?7), P1 recent production (HubGuard, discover UX, coordinator roadmap, HubGrid), D pending-preview appendix, sign-off template.
- **Baseline workflow:** `docs/QA_FULL_WORKFLOW.md` (Phases 0?8).
- **Target:** Production https://popuphub.ca ? build **217** @ commit `4cae286`.
- **Automated (dev):** `npm run qa:automation` (CI-safe static) | `npm run qa:automation:prod` (prod Playwright smoke) | `npm run test:e2e:smoke`
- **Status:** Delivered to Linear ? [POP-5](https://linear.app/popuphub/issue/POP-5/qa-full-workflow-test-request-build-217) (**In Progress**, build **218**). Checklist doc: [QA Test Checklist ? build 217](https://linear.app/popuphub/document/qa-test-checklist-build-217-fff43e29c970). Handoff script: `npm run qa:handoff`.

## Active work ? CRO remaining gaps ? Core UX #4/#5 + vendor alert email (local, not deployed)
- **Goal:** Close last three CRO gaps ? unified event hub timeline, vendor apply?booth?payment journey, nearby-market email alerts.
- **Shipped locally:**
  - **Event hub timeline (Core UX #4):** `EventHubTimeline` on `/coordinator/events/[id]` ? four phases (Setup ? Publish ? Vendor pipeline ? Market day) with counts + embedded `EventReadinessChecklist`; duplicate stats grid removed.
  - **Vendor booking rail (Core UX #5):** `vendor-booking-steps.ts` + `VendorBookingProgressRail` on active rows in `vendor-applications-list`; `notifyVendorBoothAssigned` on HubGrid layout save (`booth-planner`) and FCFS assign (`fcfs-queue` + `eventName` on operations page).
  - **Market alert email (Feature Enhancement #1):** `nearby-market-alert.ts` templates + `dispatchNearbyMarketAlertEmails` (single alert or 24h digest when 2+); wired from `dispatch-publish-market-alerts` when vendor prefs have `notify_email`.
- **Verify:** `npx tsc --noEmit` PASS. Smoke: event hub sticky timeline; vendor applications 4-step rail; publish market ? email to vendor with email prefs; FCFS/HubGrid assign ? in-app booth notification.
- **Next:** Commit + deploy when user asks. Optional: booking rail on `/vendor/events/[id]` detail page.

## Active work ? CRO ?5 feature backlog (local, not deployed)
- **Goal:** Patron follow organizer, post-market HubGuard NPS after vendor check-in, printable patron map QR on roster.
- **Shipped locally:**
  - **Patron follow organizer:** `120_coordinator_follows.sql`, `CoordinatorFollowButton`, publish alerts via `dispatchCoordinatorFollowerAlerts` (`coordinator_market_published` notifications).
  - **HubGuard NPS:** `VendorCheckinHubguardPrompt` on QR check-in success; prefilled `/check/review` (organizer, event, month).
  - **Patron map QR:** `PatronMapQrPoster` on Print Roster ? live `/events/{id}/map` (or detail when no layout).
- **Verify:** `npx tsc --noEmit` PASS; apply migration `120_coordinator_follows.sql`.
- **Next:** Commit + deploy when user asks.

## Active work ? CRO strategic recommendations ?5 (local, not deployed)
- **Goal:** Quick wins from UX review ?5 ? recurring market clone, saved venue prompt, discover trust, vendor alerts, unified event hub readiness rail.
- **Shipped locally:**
  - **Clone market:** `CloneMarketButton` on event hub (non-draft) + markets list rows; `POST /api/coordinator/events/[eventId]/clone` (+7 days, layout copy).
  - **Saved venue:** `SaveVenuePrompt` on event hub when venue not in `coordinator_saved_venues`.
  - **Event hub rail:** `EventHubTimeline` (4-phase sticky timeline + counts) with embedded `EventReadinessChecklist`; replaces duplicate stats grid on event hub.
  - **Discover trust:** `fetchDiscoverMarkets` joins coordinator `reliability_score`; `CoordinatorTrustChip` on discover cards.
  - **Discover alerts:** Empty state links to profile (signed in) or vendor signup ? profile.
  - **Vendor alerts:** `VendorAlertOnboarding` on `/vendor/dashboard`.
  - **Checklist times:** `CoordinatorGettingStarted` step badges (~15 min, ~5 min, etc.).
- **Not started (?5 backlog):** Done ? see **CRO ?5 feature backlog** above.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: clone from completed market; save venue on event hub; discover card trust chip; vendor dashboard alert banner.
- **Next:** Commit + deploy when user asks.

## Active work ? CRO performance & friction ?4 (local, not deployed)
- **Goal:** Reduce technical/workflow friction from UX review ?4 ? Discover maps blocking, payment publish confusion, vendor passport/insurance gates.
- **Shipped locally:**
  - **Discover location (non-blocking):** `HomeAddressPicker` shows input while Maps API loads; `MarketAreaFilter` puts radius + geolocation + Edmonton/Calgary quick picks before address autocomplete.
  - **Coordinator payouts:** `CoordinatorPaymentReadinessCallout` on `/coordinator` when publish blocked for missing Square/Stripe/org; checklist copy clarifies offline publish path.
  - **Vendor friction:** `VendorPassportCompletionCard` (% meter + missing fields); `VendorActionRequiredBanner` for insurance upload + payment due; `pending_insurance` applications filter.
- **Already shipped earlier (same review):** HubGrid INP deferrals, route scroll-to-top, wizard step scroll reset, Simple HubGrid mode, discover empty states.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/discover` use location without waiting for Places; `/coordinator` payment callout; `/vendor/dashboard` passport meter + insurance banner.
- **Next:** Commit + deploy when user asks.

## Active work ? HubGuard claim matching + Visual/UI ?3 (local, not deployed)
- **Goal:** Auto-suggest unclaimed HubGuard profiles for new coordinators; CRO review ?3 visual polish (Discover density, marketing?app bridge, card scannability).
- **Shipped locally:**
  - **Claim matching:** `match-coordinator-organizers.ts` scores unclaimed organizers vs profile org name, contact name, email domain, and existing event names; `fetch-coordinator-claim-suggestions.ts`; `CoordinatorOrganizerClaimSuggestions` on `/coordinator` with claim + dismiss.
  - **Discover filters:** `DiscoverWhenFilter` ? mobile shows Today/Tomorrow/Weekend + ?More dates?; filters wrapped in white card panel for hierarchy.
  - **Coordinator welcome:** `CoordinatorPortalWelcome` strip for new coordinators (`marketCount === 0`).
  - **Event cards:** Two-line titles + slightly larger meta text on Discover grid.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator` with org name similar to unclaimed HubGuard listing; `/discover` mobile filter collapse.
- **Next:** Commit + deploy when user asks.

## Active work ? CRO user journeys ?2 (local, not deployed)
- **Goal:** Shopper, vendor, and organizer journey friction from UX review ? including demo market, HubGuard claim surfacing, HubGrid Simple mode.
- **Shipped locally:**
  - **Discover:** `DiscoverEmptyState` with Try next preset, Widen radius, Show everywhere; upcoming market count; map overlay + list modes.
  - **Browse CTAs:** `goToDiscover()` ? navigates immediately, requests location in background (hero pathways + path cards).
  - **Vendor:** Apply-once 3-step loop on hero/path cards; `VendorSignupPassportPreview` on vendor signup; "See open markets" ? `/discover`.
  - **Organizer checklist:** `CoordinatorGettingStarted` on home when `marketCount === 0`.
  - **Demo market (~10 min):** `POST /api/coordinator/demo-market` + `DemoMarketLauncher` on coordinator home/getting-started; `DemoMarketGuideBanner` on setup wizard when `?demo=1`.
  - **HubGuard claim:** `CheckOrganizerList` (Unclaimed/Claimed badges + claim link); `HubGuardCoordinatorClaimCallout` for signed-in coordinators on `/check`.
  - **HubGrid Simple mode:** `hubgrid-layout-mode.ts` ? default Simple (booth IDs, no clearance/category rules); Simple/Pro toggle in dashboard toolbar; publish clearance gate skipped in Simple via `MarketManagementProvider`.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/check` as coordinator (claim callout + badges); `/coordinator` demo market button; `/coordinator/studio` Simple/Pro toggle; demo wizard banner at setup step 3.
- **Next:** Commit + deploy when user asks.

## Active work ? dual-audience hero + Canada positioning (local, not deployed)
- **Goal:** CRO item #1 + broaden marketing beyond Alberta (Canada + origin proof).
- **Shipped locally:**
  - **`lib/marketing/home-hero.ts`:** Eyebrow *Built in Canada ? strong in Alberta today*; H1 *One hub for local makers markets*; national subhead; human footer line (no duplicate origin).
  - **`marketing-hero-pathways.tsx`:** Three pathway cards (organizer / HubGuard / discover).
  - **`marketing-testimonial.tsx`:** Canadian pop-up market attribution.
  - **`lib/seo/site-config.ts`:** Default description mentions Canada.
  - **`/check`:** Directory heading *Organizers in our directory (Alberta today, expanding)*; body copy still Edmonton-area honest.
  - **`/check/review`:** Metadata de-regionalized.
  - **E2E:** `public-discovery.spec.ts`, `canopy-trust.spec.ts` updated.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke `/` national H1 + Alberta proof eyebrow; `/check` honest directory label.
- **Next:** Commit + deploy when user asks.

## Active work ? UX polish batch + CRO review (local, not deployed)
- **Goal:** Field contrast, scroll-to-top on navigation, hide inaccurate venue presets (keep field), menu cleanup, professional UX/CRO review delivered in chat.
- **Shipped locally:**
  - **Fields:** `WIZARD_INPUT` + venue template selects use `bg-white`; removed `bg-background` overrides on wizard Places inputs and hall selector.
  - **Scroll:** `RouteScrollToTop` on pathname change; shared `resetScrollToTop()` for portal tab switches + wizard steps.
  - **Venue presets:** Edmonton hall blueprints hidden from template dropdown ? only Blank Canvas + saved venues; field retained.
  - **Menu:** Removed "More" section; supplemental links merged into single vertical Navigate list (no 2-col grid).
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: switch nav routes + portal tabs land at top; menu sheet single column; wizard venue template shows blank only.
- **Next:** Commit + deploy when user asks.

- **Goal:** Fix ~319ms INP on `svg.floor-plan-canvas-surface` ? pointer handlers blocked UI updates on large layouts.
- **Root cause:** Every pointer-driven re-render ran O(n?) overlap detection and called `vendorBoothClearanceWarningBand` per vendor booth inside the `CanvasObjects` map loop.
- **Fix:**
  - **`floor-plan-canvas.tsx`:** `useDeferredValue` for overlap + clearance bands; live `store.doc.objects` still drives booth positions.
  - **`booth-clearance-visual.ts`:** `vendorBoothClearanceBandsByObjectId` bulk precompute.
  - **`canvas-objects.tsx`:** Lookup precomputed band map instead of per-object clearance in render.
  - **`use-canvas-pointer.ts`:** `startTransition` for hover-only state (placement ghost, room edge/vertex, empty canvas).
- **Verify:** `npx tsc --noEmit` ? PASS. Chrome Performance ? interact with HubGrid canvas; INP on `floor-plan-canvas-surface` should drop below 200ms on large markets.
- **Next:** Commit + deploy when user asks.

## Active work ? HubGrid minimal footer + fullscreen viewport + clearance tint fix (local, not deployed)
- **Goal:** Reduce footer chrome on HubGrid canvas; fix black letterbox in Full screen; stop corner booth from falsely tinting distant rows/columns yellow/red.
- **Shipped locally:**
  - **`dashboard-workspace-footer.tsx`:** Hidden on HubGrid (blueprint) tab and preview; only shows on Allocation Ledger when a market is selected.
  - **`dashboard-next-step-cta.tsx`:** Inline footer uses a single compact row (muted status + text link) instead of full-width green button.
  - **`command-center-fullscreen-context.tsx`:** Full screen uses `document.documentElement.requestFullscreen()` so the site-main flex chain fills the monitor (fallback: dashboard root).
  - **`globals.css`:** `:fullscreen` rules for command center ? canvas cream background + flex height chain through floor plan host.
  - **`booth-clearance-visual.ts`:** Corner/perimeter booths ignore every flush wall for distance math; corner pockets + backward-facing perimeter placements tint **critical** (no vendor rear access).
  - **`rect-edge-clearance.ts`:** Perpendicular vendor booths (0? row vs 90? perimeter) no longer cross-tint via shared-row/column aisle math ? only parallel neighbors count.
  - **`perimeter-booth-orientation.ts`:** Rotated perimeter flush detection extends tolerance by half the long-minus-short span so right-wall vertical booths are not falsely read as 0? from the room edge.
  - **`door-clearance-zones.ts`:** Door egress zone no longer double-expands (touch/overlap only, not +5? beyond padded zone).
- **Verify:** `npx tsx scripts/verify-booth-clearance-visual.ts` ? PASS (includes perpendicular perimeter row case). Smoke: `/coordinator/studio?event=?` ? corner booth no longer tints opposite corner red; vertical perimeter booth beside horizontal rows stays green when aisles are clear.
- **Next:** Commit + deploy when user asks.

## Active work ? coordinator market load crash (local, not deployed)
- **Issue:** Opening a created market (event hub `/coordinator/events/[id]`) showed the coordinator error boundary ? "We couldn't load this coordinator page." Markets list (`/coordinator/markets`) still loaded.
- **Root cause:** Circular module import ? `layout-density.ts` ? `booth-clearance-visual.ts` ? `door-clearance-zones.ts` ? back to `booth-clearance-visual` before `BOOTH_CLEARANCE_GOOD_FT` initialized. Event hub pulls floor-plan modules via `ApplicationBoard` client bundle.
- **Fix:** Extracted clearance constants to `lib/coordinator/booth-clearance-constants.ts` and `edgeClearanceBetweenRects` to `lib/floor-plan/rect-edge-clearance.ts`; hardened studio curation queue date display + profile `.maybeSingle()`.
- **Verify:** Dev mock-login ? `/coordinator/events/4e87e086-?` HTTP **200** (was 500); `/coordinator/markets` HTTP **200**; `npx tsc --noEmit` PASS.
- **Next:** Commit + deploy when user asks.

- **Goal:** Fix "Database migration required" when saving a new market.
- **Root cause:** Hosted Supabase was missing migration **117** (`community_league_discount_*` columns). Error text incorrectly pointed at migration 088.
- **Applied:** `npm run db:push` ? migrations **115**, **116**, **117** on `ensbggtbgabogvynqsqt`.
- **Code:** Clearer schema-migration error (names missing column); expanded `verify-events-schema.ts`.
- **Verify:** `npx tsx scripts/verify-events-schema.ts` ? PASS. Retry saving a new market in wizard step 1.
- **Next:** Commit + deploy when user asks.

## Active work ? flyer cover upload click regression (local, not deployed)
- **Goal:** Restore file picker when clicking "Upload cover or flyer" on web.
- **Root cause:** `FlyerCoverUpload` `<label>` was replaced with `<div role="button">` for paste/drop; native label click-to-open was lost.
- **Fix:** Restored `<label>` wrapper; kept paste, drag-drop, and keyboard handlers.
- **Verify:** `/coordinator/events/new` or wizard step 1 ? click upload zone ? OS file explorer opens; paste/drop still work.
- **Next:** Commit + deploy when user asks.

## Active work ? patron UX + coordinator polish (local, not deployed)
- **Goal:** Tester feedback batch ? footer, discover location, venue approval, league pricing, mobile layout gate, HubGuard nav naming.
- **Shipped locally:**
  - **Footer:** Removed year from copyright; moved `BuildVersionFooter` inside `#site-layout-main` with `mt-auto`; dropped `flex-1` on `#site-main` to remove content/footer gap; mobile padding above bottom nav; `ComplianceFooter` delegates to shared footer
  - **HubGuard nav:** Ribbon/menu and `/check` page use **HubGuard** (replaced Canopy / Check organizers)
  - **HubGuard review form:** Organizer dropdown keeps proper-cased display name after selection (was showing lowercase slug)
  - **CI lint:** Renamed `useMyLocation` ? `requestMyLocation` in market area filter (hook naming rule)
  - **Coordinator event hub crash:** Safe date formatting on schedule items + application cards; guard unknown event status in status toggle
  - **Venues:** `shouldSubmitPlatformVenue` no longer skips coordinator saved venues; submit on wizard autosave, event form save, and "Save for future" venue action
  - **League discount:** Wired in `EventForm` (wizard already had it)
  - **Mobile layout:** Wizard step 3 shows save-and-continue CTA; full-screen overlay unchanged on studio
  - **Discover:** Bright address input; **Use my location** switches to map + drops blue `#4285F4` pin
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/discover` footer at bottom, location pin on map, `/check` nav vs page titles, coordinator new venue ? admin queue, league discount on event edit.
- **Next:** Commit + deploy when user asks.

## Active work ? create market single scroll (local, not deployed)
- **Goal:** `/coordinator/events/new` ? one scrollbar (wizard body only, not page + body).
- **Shipped locally:** Match setup page shell ? `overflow-hidden` on `.coordinator-setup-page`, `min-h-0` + `overscroll-y-contain` on `.setup-wizard-body`.
- **Verify:** Smoke Create New Market ? only inner content scrolls below nav.
- **Next:** Commit + deploy when user asks.

## Active work ? white form fields on canvas (local, not deployed)
- **Goal:** Search and other typable fields read as editable (white surface on cream/canvas backgrounds).
- **Shipped locally:** Base `Input`, `Textarea`, `Select`, and `InputGroup` use `bg-white` in light mode.
- **Verify:** Smoke `/check` organizer search, `/discover` address, vendor market search, HubGuard review form fields.
- **Next:** Commit + deploy when user asks.

## Active work ? HubGrid market-first gate (local, not deployed)
- **Goal:** Coordinators must pick a market before HubGrid loads ? no auto-open of the first market.
- **Shipped locally:**
  - **`app/coordinator/studio/page.tsx`:** `initialEventId` only from `?event=` query (valid id)
  - **`market-management-context.tsx`:** No `events[0]` fallback; selection syncs URL via `coordinatorStudioHref`
  - **`hub-grid-market-picker.tsx`:** Full-screen market picker + header market switcher
  - **`Dashboard_qa.tsx`:** Blocks canvas/toolbar until market selected
  - **`coordinator-markets-list.tsx`:** ?Open HubGrid? ? `/coordinator/studio` (picker)
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: nav **HubGrid** without `?event=` ? picker; pick market ? canvas loads with `?event=` in URL; event hub **HubGrid** link still opens that market directly.
- **Next:** Commit + deploy when user asks.

## Active work ? Games + Woodworking booth capacity (local, not deployed)
- **Goal:** Add **Games** and ensure **Woodworking** appear in Booth capacity by category (wizard Step 2, event hub matrix, suggested caps).
- **Shipped locally:**
  - **`118_games_broad_category.sql`:** Inserts broad **Games** category; reaffirms **Woodworking** `is_broad`
  - **`119_coordinator_booth_capacity_categories.sql`:** 16 broad maker categories (Candles & Wax Melts, Ceramics & Pottery, Woodworking & Furniture, Pet Accessories & Treats, Toys & Children's Items, Paper Goods & Stickers, Upcycled & Reclaimed Goods, Jewelry & Accessories, Glass & Stained Glass, Textiles & Quilting, Leather Goods, Soaps & Body Care, Seasonal & Holiday Decor, Metalwork & Blacksmithing, Knitted & Woven Goods, Plant & Floral Crafts)
  - **`002_seed_categories.sql`:** Seeds **Games** on fresh installs
  - **`smart-populate-booth-caps.ts`:** Suggested caps use broad categories only (excludes niche passport tags)
- **Verify:** `npm run db:push` then coordinator event hub ? new names in category picker / capacity matrix after limits configured.
- **Next:** Commit + deploy when user asks.

## Active work ? HubGrid rename (local, not deployed)
- **Goal:** Rename user-facing **Blueprint Studio** ? **HubGrid** across coordinator nav, workspace tabs, help/FAQ, and E2E prerequisites.
- **Shipped locally:** 35 files ? nav (`app-nav`, workspace rail), studio header/tabs, markets list CTAs, layout help search keywords, FAQ, QA checklist, `.cursor/rules/popup-hub-ecosystem.mdc`.
- **Unchanged:** Route `/coordinator/studio`; internal view id `blueprint` in workspace context.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: nav link **HubGrid**; studio tab label **HubGrid**; Layout help search `hubgrid`.
- **Next:** Commit + deploy when user asks.

## Active work ? logo icon-only (no wordmark) (local, not deployed)
- **Goal:** Remove ?Popup Hub? text band below the storefront icon everywhere ? nav, footer, loaders, PWA icons. Icon artwork must stay the canonical stall + location pin (not the broken lockup crop).
- **Shipped locally:**
  - **`public/popup-hub-icon-source.png`:** Canonical stall+pin artwork restored from official reference
  - **`scripts/process-logo.mjs`:** Prefers `popup-hub-icon-source.png` over lockup crop; regenerates `popup-hub-brand.png`, `logo.png`, PWA/app icons at 994?994
  - **Loaders:** Initial loader drops ?Markets Made Easy? tagline; walking-market scene uses square icon asset
  - **`popup-hub-logo.tsx`:** Square 994?994 dimensions
- **Verify:** `npm run assets:logo` + `npx tsc --noEmit` ? PASS. Smoke: header logo shows teardrop pin (not concentric circles); no text band below icon.
- **Next:** Commit + deploy when user asks.

## Active work ? HubGuard booth-fee headline (local, not deployed)
- **Goal:** Trust directory hero/callout copy names **HubGuard** explicitly.
- **Shipped locally:** `TRUST_DIRECTORY_LINKS.check.boothFeeHeadline` ? ?Before you pay for a booth, use HubGuard to check the organizer?; wired in homepage hero, `/check` h1, vendor events callout.
- **Next:** Commit + deploy when user asks.

## Active work ? HubGuard rebrand (local, not deployed)
- **Goal:** Rebrand trust directory from **Canopy** / **Check organizers** to **HubGuard** with tagline **Popup Hub security & fraud prevention**.
- **Shipped locally:**
  - **`lib/nav/trust-directory-nav.ts`:** `label` + `navLabel: HubGuard`, `ctaOpen: Open HubGuard`, booth-fee headline names HubGuard
  - **Nav:** Guest/patron ribbon + vendor app nav show **HubGuard** with tooltip; marketing CTA band uses tagline
  - **`/check`:** Metadata + footer copy; review page metadata
  - **Tests/QA:** `canopy-trust.spec.ts`, `QA_TEST_REQUEST.md`, verify-production script labels
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: ribbon link **HubGuard**, `/check` eyebrow, homepage Open HubGuard CTA.
- **Next:** Commit + deploy when user asks.

## Active work ? mobile discover UX polish (local, not deployed)
- **Goal:** Patron mobile feedback ? compact single-row header, readable discover hero band, monotonic loader progress bar.
- **Shipped locally:**
  - **Header:** `BrandLogoLockup` default `header` size (~36px); logo + Patron/Vendor/Coordinator tabs + menu on one row (`AppNav`, `ShopperTopBar`, `GuestNav`); removed mobile second-row portal tabs; `--app-nav-height` 3.25rem
  - **Discover band:** `SitePageBand` forest h1 explicit `text-white`; description `text-base text-white/95`; tighter mobile vertical padding
  - **Loader:** `initialLoaderFrame` keeps progress at 1 during hold/outro so progress bar never rewinds
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/discover` on mobile width ? single header row, white title on green band, splash loader bar fills forward only.
- **Next:** Commit + deploy when user asks.

## Shipped this session (coordinator feature roadmap (8 items), deployed 2026-06-19)
- **Goal:** Phase A?C coordinator enhancements from roadmap plan ? saved layouts, paste cover, mobile layout gate, layout image import, league discount, venue admin approval, Google Docs contracts, for-organizers value calculator.
- **Shipped locally:**
  - **Phase A:** `SavedLayoutPicker` in HubGrid dashboard + edit-public toggle; `FlyerCoverUpload` paste/drop; mobile iron-dome on wizard step 3, event hub banner, production `dashboard-bootstrap`
  - **Phase B:** `POST /api/coordinator/layout/import-image` + vision parser + canvas import button (paste support); community league vendor discount (migration **117**, wizard, apply, checkout best-of); `platform_venue_submissions` + wizard submit gate + publish block + `/admin/venues`
  - **Phase C:** Google OAuth routes + `GoogleDocsContractImport` in `BoothContractEditor`; `EventValueCalculator` on `/for-organizers`
- **Verify:** `npx tsc --noEmit` ? PASS. Apply migrations **108** (saved layouts) + **117** (roadmap) via `npm run db:push`. Google Docs needs `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`; layout import needs `OPENROUTER_API_KEY`.
- **Smoke:** Studio save/load public layout; paste cover in wizard step 1; phone on wizard step 3 ? save draft CTA; import layout photo; league discount on community league venue; new venue ? pending ? admin approve ? publish; Google connect + doc import; for-organizers calculator.
- **Next:** Commit + deploy when user asks.

## Active work ? patron navigation, location, organizer UX (local, not deployed)
- **Goal:** Tester feedback ? real Home (`/` PublicLanding), unified top ribbon, home-address distance filter, organizer error hardening, auth copy, cancellation FAQ.
- **Shipped locally:**
  - **Home:** `/` always shows `PublicLanding` (guest + signed-in); logo ? `/` via `SITE_HOME_PATH` in GuestNav, ShopperTopBar, AppNav
  - **Ribbon:** `site-ribbon-links.ts` ? Home, Discover, HubGuard, FAQ on browse + guest surfaces; desktop links on ShopperTopBar; GuestNav on login/signup; profile layout ? patron `ShopperShell`; vendor bottom nav Home tab
  - **Location:** `HomeAddressPicker` + address field on Discover/vendor market grid + vendor alert prefs; geolocation error toasts
  - **Organizers:** `error.tsx` on `/check` and `/organizers/[slug]`; query helpers return empty/null on DB errors instead of 500
  - **Auth:** Signup confirmation **link** copy + resend; login tab note on email confirm; **Continue with Google** below terms checkbox on signup
  - **FAQ:** Coordinator cancellation item in `faq-content.tsx` + for-organizers landing
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/` path cards; logo from `/discover` ? `/`; address on Discover; `/check` loads; signup resend button.
- **Ops:** Confirm prod migrations **113?116** applied if organizer pages still fail (`npm run db:push`).
- **Next:** Commit + deploy when user asks.

## Active work ? quarter auction setup parity (local, not deployed)
- **Goal:** Make quarter-auction wizard as clear as market setup for Monday demo (especially Step 2 vendor spots).
- **Shipped locally:**
  - **Wizard shell:** Listing-aware titles, stepper ("Vendor spots"), nav labels, post-save redirect ? `/coordinator/events/{id}/auctions`
  - **Step 2:** QA branch hides booth pricing/floor-plan copy; "Add common vendor types" quick-start + total-spot distribute; `CategoryLimitEditor` vendor-spot labels
  - **Step 1:** "Launch your quarter auction"; hide booth contract/payment strip for QA; lock skip floor plan
  - **Live pricing:** Coordinator "Vendor on stage ? enter bid amount"; optional vendor `entry_cost_credits` on item submit
  - **Checklist/event page:** Catalog + vendor-approval readiness; auction control panel (not legacy timer auctions)
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: create QA draft ? step 2 quick-fill ? save ? lands on auction control.
- **Next:** Commit + deploy when user asks; walk Monday demo through create ? vendor spots ? auction control ? live item bid entry.

## Active work ? organizer list growth (local, not deployed)
- **Goal:** Break chicken-and-egg ? vendors can nominate unlisted organizers + submit review in one step; admin publishes via CLI; coordinators auto-sync on market publish.
- **Shipped locally:**
  - **Migration `116_organizer_vendor_submissions.sql`:** `submitted_by`, `submitted_at` on organizers
  - **Vendor intake:** `/check/review` ? ?Organizer not listed? + nomination fields; API creates draft org (`vendor_submitted`) + unpublished review
  - **Admin CLI:** `list-organizers.ts --pending`, `publish-organizer-submission.ts --slug|--all-vendor-submitted`
  - **Coordinator sync:** `onMarketPublished` wired to publish API routes + `trust-sync` from status toggle; claim CTA on `/organizers/[slug]`
  - **Copy:** `/check` empty state + `/check/review` moderation note
- **Verify:** `npx tsx scripts/verify-organizer-submissions.ts` ? PASS; `npx tsc --noEmit` ? PASS. Apply migration `npm run db:push`.
- **Next:** Commit + deploy when user asks; smoke vendor not-listed submission ? `list-organizers --pending` ? publish script.

## Active work ? relax venue type restriction for markets (local, not deployed)
- **Issue:** Publish blocked bars, gyms, and other non-commercial Google place types with ?Location must be a commercial property, park, or public event space.?
- **Fix:** `verify-venue-coordinates.ts` ? dropped pin + complete address (?10 chars) now verifies regardless of Google place types; user-facing copy updated in wizard, event form, status toggle, and `require-venue-verified.ts`.
- **Verify:** `npx tsx scripts/verify-venue-coordinates.ts` ? PASS.
- **Next:** Commit + deploy when user asks.

## Active work ? trust directory navigation (local, not deployed)
- **Goal:** Make `/check` and `/check/review` discoverable without typing URLs; fix guest login redirect on trust pages.
- **Shipped locally:**
  - **Public access:** `/check`, `/check/review`, `/organizers/*` in `public-paths.ts`; patron portal prefixes updated
  - **Nav:** Guest nav, shopper top bar, vendor app nav ? **Canopy** (tooltip: Popup Hub security & fraud prevention); hamburger ? "Review an organizer" (vendors/coordinators)
  - **Vendor CTA:** `VendorCheckOrganizerCallout` on `/vendor/events`
  - **Marketing:** Vendor path card trust copy + secondary link; Trust & verification tile ? `/check`; CTA band link
  - **SEO:** Sitemap static `/check`, `/check/review`; dynamic published `/organizers/[slug]`
  - **Shared:** `lib/nav/trust-directory-nav.ts`
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: guest homepage ? `/check` (no login); vendor nav + banner; guest `/check/review` sign-in gate.
- **Next:** Commit + deploy when user asks.

## Active work ? organizer trust directory vet + Lauderdale (local, not deployed)
- **Issue:** `/check` and `/check/review` listed venues (rec centres, community centres, retail stores) mistaken for organizers during FB extract.
- **Vet (DB applied via `patch-organizer-list-vet.ts`):**
  - **Archived (4):** Garden Valley Community Centre, St. Paul Rec Center, The Craft Vault, Venue of New Hope & Dezzigner Scrunchies
  - **Renamed:** `stm-cwl-christmas-market` display ? **STM Catholic Women's League**
  - **Added:** **Lauderdale Community League** (lauderdalecl.ca) ? published
  - **Published list now (9):** Agora Markets, Beaumont Farmers Market, Caribou Exchange, Central Occasion Events, Decimate Metalfest, Lauderdale CL, Little Big Town Western Market, Morinville District Chamber, STM Catholic Women's League
- **Seed:** `edmonton-fb-table1-batch1.json` trimmed; import preserves `listing_status` on re-run (won't resurrect archived rows).
- **Scripts:** `scripts/patch-organizer-list-vet.ts`, `scripts/list-organizers.ts`
- **Next:** Commit + deploy when user asks; identify Hope & Holly market organizer if vendor reports exist.

## Active work ? /check/review select dropdown width (local, not deployed)
- **Issue:** Organizer review form dropdowns clipped option text ? popup locked to narrow `w-fit` trigger via `w-(--anchor-width)` + `overflow-x-hidden`.
- **Fix:** `SelectContent` uses `min-w-(--anchor-width) w-max max-w-(--available-width)`; all review form `SelectTrigger` set to `w-full`.
- **Verify:** Open `/check/review` ? Organizer dropdown shows full names (e.g. "Agora Markets ? Edmonton").
- **Next:** Commit + deploy when user asks.

## Shipped this session ? Edmonton trust seed expansion (deployed 2026-06-18)
- **Deploy:** `2caa4cc` ? production build **207** @ https://popuphub.ca
- **Shipped:**
  - **Seed:** Caribou Exchange (Tanya Hillmer, quarter auction, FB group) + Hope & Holly Christmas in July (Coalhurst, permalink verified vendor call)
  - **Scripts:** `patch-caribou-exchange.ts`, `patch-hope-holly-coalhurst.ts`; import supports `facebook_url` / `instagram_handle`
  - **Trust report UI:** Official Facebook group + Instagram on `/organizers/[slug]`
- **DB (already applied via patch scripts):** 12 organizers published in trust directory
- **Next:** Caribou vendor-call post permalink; Beaumont scam permalink; thread-linked mentions UI (Morinville); `/check/review`

## Shipped this session ? Edmonton trust directory /check (deployed 2026-06-18)
- **Goal:** Trust-first wedge ? vendors check organizers before paying booth fees; Edmonton metro seed data live in DB.
- **Deploy:** `12dad28` ? production build **207** @ https://popuphub.ca (alias confirmed). `npm run verify:prod` ? PASS.
- **Shipped:**
  - **Migration `113_organizer_trust_directory.sql`** ? organizers, events, scam alerts, watchlist, community mentions
  - **`/check`** search + **`/organizers/[slug]`** trust reports (scam alerts, mentions, source permalinks)
  - **Homepage hero** repositioned ? ?Before you pay for a booth, check the organizer?
  - **Seed scripts:** `import-edmonton-seed.ts`, `publish-edmonton-organizers.ts`, `patch-morinville-thread.ts`, `scripts/seed/edmonton-fb-*.json`
  - **DB seeded:** 10 Edmonton organizers published; Central Occasion Events scam alerts + Kallans watchlist + Tracy/Bite Me mentions (permalink verified); Morinville $150 vs $580 clarification
- **Also in commit:** Capacitor mobile shell, vendor geo alerts (112), coordinator vendor invite links, build clean script
- **Verify:** `npm run db:push` + `seed:edmonton:import` + `seed:edmonton:publish -- --include-verified-alerts` ? DONE. `npx tsc --noEmit` ? PASS. Prod smoke `/check` + `/organizers/central-occasion-events` ? live on popuphub.ca.
- **Next:** Beaumont scam alert ? find FB permalink before publish; vendor review submission form (`/check/review`); public watchlist page (`/check/scam-alerts`); Nicole Skinner praise thread extract (Table 2 re-run)

## Active work ? patron + vendor mobile app (local, not deployed)
- **Goal:** Capacitor iOS/Android shell with patron discover + vendor markets, geo alerts, one-tap apply.
- **Shipped locally:**
  - **Native:** `lib/mobile/native-app.ts`, `components/mobile/capacitor-init.tsx`, launch URL `/discover` in `capacitor.config.ts`, role-aware bootstrap ? `/vendor/events` for vendors
  - **Vendor mobile:** bottom nav, skip 3-column workspace on phone, `QuickApplyButton` (`express: true` API guard), `VendorAlertOnboarding` on first `/vendor/events` visit
  - **Alerts:** migration `112_vendor_mobile_alerts.sql`, publish hooks, prefs API + profile UI, push dispatch scaffold
  - **Patron push:** reminder cron wires `dispatchNativePushToUsers` per saved market
  - **Deep links:** `.well-known/apple-app-site-association` (replace `TEAM_ID` ? see `.well-known/README.md`), `assetlinks.json`
  - **Haptics:** `@capacitor/haptics` on quick-apply success (native only)
  - **Docs:** `PM/mobile-emulator-setup.md`, `PM/ios-testflight.md`, `PM/android-play-console.md`
  - **Tests:** `tests/e2e/patron-mobile-chrome`, `vendor-mobile-chrome`, `vendor-quick-apply`
- **Verify:** `npx tsc --noEmit` ? PASS. Run `npm run test:e2e:mobile` before deploy. Apply migration `npm run db:push`.
- **Next:** Android SDK + `npm run mobile:android:add`; replace AASA Team ID + Android SHA256; wire APNs/FCM env keys; commit + deploy when user asks.

## Active work ? coordinator vendor invite guidance (local, not deployed)
- **Goal:** First coordinators on an empty platform need one shareable link for vendor outreach (Facebook, email, etc.).
- **Shipped locally:**
  - **`lib/coordinator/vendor-outreach.ts`** ? `vendorMarketInviteUrl(eventId)` ? `/signup?role=vendor&next=/vendor/events/[id]` (signup then straight to apply).
  - **`components/coordinator/vendor-recruitment-callout.tsx`** ? single ?Vendor invite link? with Copy.
  - **Signup:** already-authenticated users with `next` redirect immediately; vendor signup copy mentions market apply when `next` is set.
  - **Vendor event page:** login redirect preserves `/vendor/events/[id]`.
  - **Surfaces:** curation queue, vendor pool, applications board, event hub checklist, markets list, check-in.
- **Verify:** Copy invite link from event hub ? open in incognito ? sign up as vendor ? land on `/vendor/events/[id]` apply section.
- **Next:** Commit + deploy when user asks.

## Active work ? Windows production build: next-font-manifest (local, not deployed)
- **Issue:** Local deploy failed during `Collecting page data` with `Cannot find module '.next/server/next-font-manifest.json'` ? stale/corrupt `.next` while multiple `next dev` processes held locks on the same output directory.
- **Root cause:** Eight concurrent `next dev` instances for popup-hub were writing dev artifacts into `.next` while production `next build` ran; webpack emitted manifests then dev/build races deleted or overwrote them before static workers loaded them.
- **Fix:** `scripts/clean-next-build.mjs` ? detect popup-hub `next dev` / `start-server.js` processes; `--stop-dev` uses `taskkill /T /F` on Windows (retry up to 3?); `--strict` fails fast if dev servers or `.next` cannot be cleared. `package.json` prebuild + `deploy-popuphub.ps1` / `ship.ps1` now pass `--strict --stop-dev`.
- **Verify:** `npm run build` ? PASS (build 204, webpack). Deploy should succeed after rerun of `PM\Deploy-popuphub.bat`.
- **Next:** Commit + deploy when user asks.

## Shipped this session ? deploy + production hygiene (deployed 2026-06-17)
- **Deploy 1 (`0b7a8d7`, build 204):** Past markets access fix ? safe date formatting, archived events in HubGrid, coordinator/vendor layout cookie fix (Next.js 16), error boundary, markets loading skeleton, `npm run test:unit`.
- **Deploy 2 (build 205):** Env sync ? `SQUARE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL=https://popuphub.ca`, 15 keys refreshed on Vercel.
- **DB:** Migration `111_passport_niche_tags.sql` applied via `npm run db:push`.
- **Hygiene:** `sync-vercel-env.ps1` default app URL ? popuphub.ca; `OPENROUTER_API_KEY` in sync list; `verify-production.ps1` checks both domains + build-info + sitemap; `PRODUCTION_NEXT_STEPS.md` updated.
- **Prod smoke:** `npm run verify:prod` ? all PASS on popuphub.ca and popup-hub.vercel.app.
- **Manual follow-up:** Supabase Auth dashboard ? Site URL `https://popuphub.ca`, redirect URLs include `ca.popuphub.app://auth/callback` for iOS; Google Search Console sitemap submit.

## Active work ? unit test inventory + gaps (local, not deployed)
- **Goal:** Catalog QA/unit coverage; add colocated tests for floor-plan rules missing `.test.ts` files.
- **Added:** `lib/floor-plan/door-clearance-zones.test.ts`, `components/coordinator/floor-plan-v2/interactions/category-rules.test.ts`, `npm run test:unit` (geometry, integration, polygon-edit, category-rules, door zones, active-portal).
- **Verify:** `npm run test:unit` ? all PASS.
- **Next:** Wire high-value `scripts/verify-*.ts` into `test:unit` or `qa:launch` when prioritized; add `clearance-auto-correction.test.ts` colocated with module.

## Active work ? coordinator markets access fix (local, not deployed)
- **Issue:** Coordinator cannot open **current or past** markets ? Next.js "This page couldn't load" error on `/coordinator/markets` and event hubs.
- **Root causes addressed:**
  - **`cookies().set()` in coordinator layout** ? illegal in Next.js 16 Server Components; crashed the entire coordinator segment on load. Removed (middleware syncs portal cookie). Same fix applied to vendor layout.
  - **Unsafe `date-fns` formatting** on market rows when `start_at` is missing/invalid ? SSR crash on both Active and Past sections.
  - HubGrid excluded archived events ? `?event=<past-id>` fell back to wrong market.
  - Profile query used `.single()` ? switched to `.maybeSingle()` with error logging.
- **Shipped locally:**
  - `lib/format/safe-event-date.ts` ? crash-safe market date formatting + sort timestamps.
  - `coordinator-markets-list.tsx` ? safe dates + **View layout** link on past markets ? studio.
  - `app/coordinator/studio/page.tsx` ? includes archived events for read-only blueprint access.
  - `app/coordinator/markets/page.tsx` ? resilient query error logging.
  - `app/coordinator/markets/loading.tsx` ? skeleton while markets load.
  - `app/coordinator/layout.tsx` ? removed illegal cookie write.
  - `app/coordinator/error.tsx` ? segment error boundary with reload + markets link.
  - `event-inline-editor.tsx` ? safe dates in display + edit state init.
  - `lib/queries/events.ts` ? safe sort via `safeEventTimestamp`.
- **Verify:** `/coordinator/markets` ? Active + Past sections render; click current event hub + past **View layout**.
- **Next:** **Commit + deploy** ? production still has the layout cookie bug until shipped.

## Active work ? dynamic tessellation + clearance auto-correction (local, not deployed)
- **Goal:** Multi-pattern floor-plan tessellation (perimeter loop, structured grid, staggered offset) with valid-booth-yield + flow-fairness optimization; push-back/prune until every vendor booth is green (?4?).
- **Shipped locally:**
  - **`lib/floor-plan/layout-tessellation-optimizer.ts`** ? evaluates all three patterns per W?L canvas; ranks by valid booth yield ? flow fairness ? placed count; returns winning pattern + scores.
  - **`lib/floor-plan/clearance-auto-correction.ts`** ? iterative push-back then lowest-priority prune (unassigned first) until all vendor booths ?4? green clearance.
  - **`lib/floor-plan/request-ai-auto-arrange.ts`** ? tessellation fallback before unified/perimeter paths; clearance correction on AI placements.
  - **`floor-plan-v2.tsx`** ? grid auto-arrange now runs tessellation optimizer (best of 3 patterns).
  - **`lib/floor-plan/ai-auto-arrange.ts`** ? prompt notes tessellation context + storefront-on-flow requirement.
  - **`scripts/verify-layout-tessellation.ts`** ? smoke tests for patterns + clearance correction.
- **Integration:** Canvas mutations ? `floorPlanStore` ? ledger via `useBoothEntities` unchanged; tessellation runs on auto-arrange with **progressive `onProgress` canvas preview** per pattern evaluation.
- **Verify:** `npx tsx scripts/verify-layout-tessellation.ts` PASS; HubGrid auto-arrange toast shows winning pattern; clearance bands all green post-arrange when physically possible.
- **Next:** Commit + deploy when user asks; optional tessellation candidate picker UI (like fairness scenarios).

## Active work ? tiered OpenRouter spatial AI (local, not deployed)
- **Goal:** Tiered multi-model OpenRouter architecture for HubGrid floor-plan parsing, layout geometry, and spatial awareness ? never default to premium frontier models for routine coordinate math.
- **Shipped locally:**
  - **`lib/ai/spatial/`** ? central spatial module: tier router (`vision` ? qwen/qwen3.7-plus, `draft` ? nex-agi/nex-n2-pro:free, `geometry` ? mistral-7b-instruct:floor, `advisor` ? claude-3.5-sonnet), `max_price` guardrails, layout compressor (`[x,y,w,h]` JSON + lightweight SVG), advisor escalation on collision errors, streaming SSE handler.
  - **`lib/ai/openrouter.ts`** ? centralized `buildOpenRouterPayload` with `provider.max_price` + streaming support.
  - **`lib/ai/tasks.ts`** ? spatial tier tasks; `auto_arrange_layout` ? mistral:floor; `layout_recommend` ? nex-n2-pro:free.
  - **`lib/floor-plan/ai-auto-arrange.ts`**, **`ai-layout-recommend.ts`** ? compressed prompts + advisor on overlap/collision.
  - **`app/api/coordinator/spatial-layout/stream/route.ts`** ? coordinator-gated SSE layout generation.
  - **`lib/floor-plan/request-spatial-layout-stream.ts`** ? client helper with `onPartial` progressive render hook.
  - **`scripts/verify-spatial-ai.ts`** ? 12 checks for routing, compression, guardrails.
- **Integration:** Auto-arrange + Ask AI layout feedback wired through tiered tasks + compressor + advisor. HubGrid progressive render wired ? grid tessellation previews best-so-far per pattern; perimeter/staggered AI streams placements via SSE.
- **Blockers:** Requires `OPENROUTER_API_KEY` in `.env.local`/Vercel; `nex-agi/nex-n2-pro:free` availability varies on OpenRouter.
- **Verify:** `npx tsc --noEmit` PASS; `npx tsx scripts/verify-ai-provider-fallback.ts` (41/41); `npx tsx scripts/verify-spatial-ai.ts` (12/12).
- **Next:** Commit + deploy when user asks; blueprint image upload ? `spatial_vision` task.

## Active work ? ecosystem rules + ledger sync audit (local, not deployed)
- **Goal:** Persist Popup Hub master Cursor rules; audit canvas ? Allocation Ledger zero-desync; fix critical sync gaps; spec compliance pass on floor-plan v2 work.
- **Shipped locally:**
  - **Rules:** `.cursor/rules/popup-hub-ecosystem.mdc` ? personas (Coordinator/Vendor/Patron), zero-desync policy, ft/grid units, RBAC, clearance bands (<3? critical ? 3?4? tight ? ?4? good), category freeze (4 col / 2 row), agent prompting protocol, key file map.
  - **Sync audit:** In-tab ledger derives from `useBoothEntities` ? live `floorPlanStore.doc` (instant when store mounted). **Gap found:** switching to full-page Ledger tab unmounted canvas ? `onStoreReady(null)` wiped `floorPlanStore` ? empty ledger.
  - **Fixes:** `registerFloorPlanStore` ignores null unmount (store cleared only on event switch); `docRevision` effect watches full `floorPlanStore.doc` (room/fixture edits bump telemetry/clearance); Ledger tab keeps hidden canvas mounted (`Dashboard_qa`) so direct `?view=ledger` loads doc.
- **Spec compliance (uncommitted floor-plan v2):** Pass ? clearance engine, category separation, door egress zones, `useBoothEntities` single source, dual-screen BroadcastChannel. Partial ? ledger matrix omits per-row clearance column; server persist still async on save (by design).
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: HubGrid place booths ? docked ledger updates; switch to Allocation Ledger tab ? rows persist; drag booth ? matrix label/position updates without refresh.
- **Next:** Commit + deploy when user asks; optional ledger clearance column; consider lifting doc snapshot for ledger-only SSR.

## Active work ? HubGrid ledger & layout fixes (local, not deployed)
- **Goal:** Fix six coordinator-reported HubGrid issues ? ledger help, category display, test suite, door clearance, category separation.
- **Shipped locally:**
  - **Help (#1?2):** New `ledger` help category (allocation overview, vendor-to-booth workflow, category separation topic). `LayoutEditorHelpHost` mounted on Ledger tab so `?` / nav Layout help works without the canvas mounted.
  - **Ledger categories (#4):** Unassigned booths show `Unassigned` in Category column (not placement slot tag). Event category cap names load from `event_category_limits` for booth tagging palette.
  - **Test suite (#5):** `populateTestSuiteCanvas` assigns seeded vendors to existing canvas booths only ? no `fillRoomWithTables` wipe. Button disabled until ?1 vendor booth on canvas; 2-step toast (seed + assign).
  - **Door radius (#6):** Door/exit clearance warnings and auto-arrange obstacles scoped to 5? egress zones (`door-clearance-zones.ts`) ? booths far along the same row are not penalized.
  - **Category separation (#3):** Production `use-canvas-pointer` enforces proximity rule on draw/drag; toolbar Shuffle toggle (View/utilities) with localStorage pref.
- **Files:** `layout-editor-help-content.ts`, `search-layout-editor-help.ts`, `Dashboard_qa.tsx`, `use-booth-entities.ts`, `market-management-context.tsx`, `studio/page.tsx`, `populate-test-suite-canvas.ts`, `test-suite-populate-button.tsx`, `door-clearance-zones.ts`, `booth-clearance-visual.ts`, `auto-arrange.ts`, `use-canvas-pointer.ts`, `category-separation-prefs.ts`, `floor-plan-v2.tsx`, `canvas-command-bar-blocks.tsx`, `floor-plan-canvas.tsx`.
- **Verify:** `npx tsc --noEmit` passes. HubGrid ? place booths ? Ledger shows Unassigned categories; run test suite assigns all canvas booths; place door ? only nearby booths show clearance warnings; toggle category separation; open Layout help on Ledger tab and search "ledger allocate".
- **Next:** Commit + deploy when user asks.

## Active work ? favicon icon mark only (local, not deployed)
- **Goal:** Browser tab favicon shows the **icon mark** (stall+pin) only ? no wordmark ? as large as possible.
- **Change:** `scripts/process-logo.mjs` favicons use `extractIconMark()` (`iconMark`) via `faviconSource`, not `fullLockup`. `FAVICON_PADDING = 0.03` (3% per edge; was `0.10`). PWA / apple-touch / `app/icon.png` still use full lockup.
- **Files:** `scripts/process-logo.mjs`; regenerated `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/favicon.ico` via `npm run assets:logo`.
- **Verify:** Hard-refresh browser tab ? cream square with large green stall+pin, no ?Popup Hub? text; `app/layout.tsx` still links `/favicon.ico`, `/favicon-16x16.png`, `/favicon-32x32.png`.
- **Next:** Commit + deploy when user asks.

## Active work ? passport niche tags + MLM gating (local, not deployed)
- **Change:** MLM brand tags (Norwex, Scentsy, etc.) only appear in passport ?Specific tags? when primary category is **Multi Level Marketer (MLM)**; switching primary away clears MLM tags. Added niche discovery tags (Hot Sauce, BBQ Sauces, Knitting, Birdhouses, Beef Jerky, and more) via migration `111_passport_niche_tags.sql`.
- **Files:** `lib/vendor/passport-categories.ts`, `components/passport/passport-wizard.tsx`, `lib/categories/mlm-constraints.ts`, `supabase/migrations/111_passport_niche_tags.sql`.
- **Verify:** `/vendor/passport` ? Category step ? MLM brands hidden unless MLM primary selected; food/craft tags visible for all; run migration on Supabase for new tags in prod.
- **Next:** Commit + deploy when user asks.

## Active work ? layout tutorial room shape step (local, not deployed)
- **Change:** Quick-start layout help tour now has 6 steps ? new Step 5 demos changing room shape (canvas handles, W/L fields, rotate); save moved to Step 6.
- **Files:** `lib/floor-plan/layout-editor-help-tours.ts`, `layout-editor-help-content.ts`, `layout-editor-help.tsx`, `floor-plan-v2.tsx` (`data-layout-help="room-shape"` on canvas wrapper).
- **Verify:** HubGrid ? Layout help ? Start quick-start tour ? Step 5 spotlights canvas and explains resize/reshape/rotate; Step 6 covers save.
- **Next:** Commit + deploy when user asks.

## Active work ? passport featured products nav (local, not deployed)
- **Issue:** After adding featured products on vendor passport, users had to scroll back up to reach Next.
- **Fix:** Featured products embedded in wizard card; Back/Next/Save in a fixed bottom bar that stays visible while scrolling.
- **Files:** `passport-wizard.tsx`, `passport-page-view.tsx`, `vendor-product-manager.tsx`.
- **Verify:** `/vendor/passport` with existing passport ? add featured product ? Next remains visible at bottom of screen.
- **Next:** Commit + deploy when user asks.

## Active work ? AI auto-arrange page freeze (local, not deployed)
- **Issue:** AI Auto-Arrange triggered browser ?Page Unresponsive? ? patron capacity probe packed 512 tables on every render; auto-arrange ran heavy sync work on the main thread.
- **Fix:** Fast obstacle-aware patron capacity estimate; bulk patron auto-arrange uses dense shelf-pack; `autoArrangeInRoomAsync` + async fairness fallback; capped room-expansion probe loop; extra yields between fairness scenarios.
- **Verify:** HubGrid with ~20 patron tables ? AI Auto-Arrange shows ?Arranging?? without freezing; canvas stays scrollable between fairness scenario ticks.
- **Next:** Commit + deploy when user asks.

## Active work ? patron table fill capacity (local, not deployed)
- **Issue:** Fill with 20 patron tables only placed 4 ? capacity estimate ignored walls/doors; patron fill used strict auto-arrange instead of dense shelf-pack.
- **Fix:** Patron fill uses `packVendorBoothsInRoomGrid` with `scope: 'patron'` (obstacle-aware row pack). Capacity estimate probes the same packer. Auto-arrange skips patron bounding box when tables are off-canvas fill seeds.
- **Verify:** Layout editor ? patron tables ? enter count ? max ? Fill ? placed count matches request (toast warns if room cannot fit all).
- **Next:** Commit + deploy when user asks.

## Active work ? layout auto-tour opt-out (local, not deployed)
- **Change:** "Don't show again" on the guided tour overlay and getting-started banner; persists `popuphub.layout-editor-help.auto-tour-dismissed` so the first-visit auto tour does not re-run. Manual tour from Layout help still works.
- **Files:** `lib/floor-plan/layout-editor-help-prefs.ts`, `layout-editor-help.tsx`, `layout-editor-help-tour.tsx`.
- **Verify:** Clear localStorage key ? open layout editor ? auto tour starts ? click Don't show again ? reload ? tour does not auto-start; Layout help ? Start interactive tour still works.
- **Next:** Commit + deploy when user asks.

## Active work ? share contact with vendors label (local, not deployed)
- **Change:** Removed "(Quarter Auctions only)" from shopper share-contact checkbox on signup and profile settings.
- **Files:** `app/(auth)/signup/page.tsx`, `app/profile/profile-form.tsx`.
- **Next:** Commit + deploy when user asks.

## Active work ? coordinator signup from Host a Market (local, not deployed)
- **Issue:** "Host a market" showed generic signup with oversized logo overlapping Create account/Sign in tabs; full role picker despite coordinator intent; post-signup did not land on market setup.
- **Fix:** Smaller auth wordmark; tabs above logo; coordinator-focused copy when `?role=coordinator`; hide role picker when role locked; pass `next=/coordinator/events/new` through OAuth/email callback; guest nav + marketing CTAs + middleware aligned.
- **Verify:** `/signup?role=coordinator&next=/coordinator/events/new` ? title "Start hosting your market", badge "Signing up as Coordinator", no role cards; after signup lands on `/coordinator/events/new`.
- **Next:** Commit + deploy when user asks.

## Active work ? FAQ and help copy refresh (local, not deployed)
- **Goal:** Align all FAQ and in-app help with current product naming (HubGrid, Markets, AI Auto-Arrange, Layout help in nav).
- **Updated:** `lib/legal/faq-content.tsx`, `lib/market-day/help-content.ts`, `lib/floor-plan/layout-editor-help-content.ts`, layout help tours, operations FCFS blurb, account capabilities, event readiness checklist, market-day shell tab, for-organizers landing, payment-methods back link, FAQ last-updated date.
- **Verify:** `/legal/faq`, `/for-organizers`, Market Day Operations ? How to Use & FAQ tab, HubGrid ? Layout help search topics.
- **Next:** Commit + deploy when user asks.

## Active work ? app icon full logo restore (local, not deployed)
- **Issue:** Rounded-square app icon cropped the storefront awning (top) and wordmark because `process-logo.mjs` used optical centering that shifted the tall lockup upward and clipped pixels.
- **Fix:** Replaced optical centering with geometric centering and explicit per-edge padding ratios in `iconOnBackground` / `transparentIcon`; removed clipping from `trimToSquare`. Regenerated `app/icon.png`, `app/apple-icon.png`, PWA icons, favicons, iOS AppIcon set, and `mobile/resources/icon-only.png` via `npm run assets:logo` + `npm run mobile:assets`.
- **Verify:** Inspect `app/icon.png` ? full awning scallops + "Popup Hub" text visible with even cream margins; no edge clipping.
- **Next:** Commit + deploy when user asks.

## Active work ? site-wide modern brand system (local, not deployed)
- **Goal:** Carry homepage modernization through the whole site ? not just `/`.
- **Shared system:** `SitePageBand`, `SiteContentShell`, `SiteAmbientBackdrop`, `PageIntro`, `.site-surface`, `.site-panel` utilities in [`app/globals.css`](app/globals.css).
- **Browse (patron):** `/discover`, `/favorites`, `/supplies`, event detail ? forest/subtle page bands + glass panels.
- **Legal:** glass document card + sage header strip; layout uses ambient shell.
- **Portals:** `AppNav` matches guest nav; coordinator/vendor workspace centers use `site-surface`; rails use glass cards; `PageIntro` on coordinator home, markets list, vendor dashboard/events.
- **Shells:** `shopper-shell`, `site-app-shell`, `shared-layout-chrome`, `command-center-shell` all on `site-surface`.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/discover`, `/favorites`, `/supplies`, `/events/{id}`, `/legal/about`, `/vendor/dashboard`, `/coordinator/markets`.
- **Next:** Commit + deploy when user asks; optional pass on remaining deep coordinator event-hub pages.

## Active work ? modern brand refresh (local, not deployed)
- **Goal:** Modernize Popup Hub visual system (Market Scout?inspired energy, unique Popup Hub identity) across marketing, browse, auth, and portal entry points ? keep forest/sage/cream palette.
- **Shipped locally:**
  - **Tokens:** Sans-serif headings (removed Lora); softer borders/shadows; `--radius` 1rem; marketing utility classes (`marketing-glass-card`, `marketing-hero-mesh`, pill CTAs).
  - **Primitives:** `Button` / `Card` / `market.ts` ? flat modern buttons, lighter card borders.
  - **Marketing:** Rebuilt `/` with forest mesh hero, booth-grid backdrop, 3-path cards, features, split story, testimonial, CTA band. `/for-organizers` aligned to same system.
  - **Chrome:** Lighter nav (pill CTAs), footer hides build hash (sr-only + title tooltip).
  - **Browse:** Discover pill filters + updated headings; taller event card images with `object-cover`.
  - **Auth:** Glass cards on login/signup with ambient blobs.
  - **Portals:** Coordinator home + vendor dashboard header polish.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/`, `/for-organizers`, `/discover`, `/login`, `/coordinator`, `/vendor/dashboard`.
- **Next:** Commit + deploy when user asks; optional real market photography for hero/story sections later.

## Active work ? AI Auto-Arrange UI freeze fix (local, not deployed)
- **Issue:** Layout editor became unresponsive during **AI Auto-Arrange** ? fairness multi-scenario packing blocked the main thread for several seconds before React could paint the loading state.
- **Fix:** `generateFairLayoutCandidatesAsync` yields between fairness scenarios via `nextAnimationFrame`; new `PackBoothsAsync` used from `handleAutoArrangeFloorPlan` (fairness path); double rAF after `autoArrangeRunning` so ?Arranging?? paints; yields before grid/patron passes and before deterministic AI fallback.
- **Verify:** HubGrid ? place booths ? **AI Auto-Arrange** (Fairness engine) ? toolbar shows ?Arranging?? and canvas stays scrollable/zoomable between scenario ticks; completes with toast as before.
- **Next:** Commit + deploy when user asks.

## Active work ? mobile maps + Google directions (local, not deployed)
- **Issue:** Discover map blank on mobile; **Directions** opened Apple Maps on iOS instead of Google Maps.
- **Fix:** `openDirections` always uses Google Maps dir URL (`/maps/dir/?api=1&destination=?`); removed iOS Apple Maps branch. `MapResize` triggers `resize` on mount, container resize, orientation change; `EventMap` loads `marker` library for Advanced Markers; map containers use `70dvh`; provider wraps loaded map in `h-full`.
- **Verify:** On phone: `/discover` ? Map tab shows tiles + pins; **Directions** on event card/detail opens Google Maps. `npx tsc --noEmit` ? PASS.
- **Next:** Commit + deploy when user asks.

## Shipped this session ? SEO: sitemap, canonical domain, organizer landing (deployed 2026-06-16)
- **Issue:** Google search for "market organizer" did not surface Popup Hub; production `/sitemap.xml` returned 500; `robots.txt` Host/Sitemap pointed at `popup-hub.vercel.app`.
- **Fix:** Hardened `collectSitemapEntries` (try/catch, safe dates); `sitemap.ts`/`robots.ts` force dynamic Node runtime; production canonical fallback `https://popuphub.ca` in `getURL()`; new public `/for-organizers` landing page with FAQ + SoftwareApplication JSON-LD; expanded default keywords; homepage organizer card links to landing page.
- **Verify:** `npm run build` ? PASS. Production: `robots.txt` Host/Sitemap ? popuphub.ca; `/sitemap.xml` ? 200; `/for-organizers` live.
- **Next:** Submit `https://popuphub.ca/sitemap.xml` in Google Search Console; set `NEXT_PUBLIC_SITE_URL=https://popuphub.ca` in Vercel prod env; re-test `site:popuphub.ca` in 1?2 weeks.

## Active work ? fairness capacity / coverage / fairness split (local, not deployed)
- **Goal:** Classify layout outcomes (complete, physical capacity, routing failure, optimization failure, algorithm limitation); remove routing-driven booth prune from main pipeline; split Cap ? Cov ? Fair scores; capacity reducer only after physical capacity proof.
- **Engine:** `layout-outcome.ts`, `capacity-reducer.ts`, `fairness-placement-pipeline.ts`; refactored `generate-fair-layout.ts` (no `pruneToFullRouteCoverage`); updated `fairness-scorer.ts`, `fairness-report.ts`, `generate-fair-layout-candidates.ts` ranking (partial never beats full roster complete).
- **UI:** Scenario bar + optimize toolbar + toasts show Cap ? Cov ? Fair; `FloorPlanDoc.lastCapacityScore` persisted.
- **Verify:** `npx tsx scripts/verify-fairness-outcome-rules.ts` ? 49 PASS (~77s). Extended `verify-layout-strategies.ts` score/outcome assertions (full suite still ~25 min).
- **Next:** Commit + deploy when user asks; smoke fairness-first auto-arrange on a tight room to confirm capacity-limited toast + partial label.

## Active work ? Windows webpack build worker crash (local, not deployed)
- **Issue:** Local deploy (`PM\Deploy-popuphub.bat`) failed build 174?175 on commit `690e276` with `Next.js build worker exited with code: 3221226505` (Windows `0xC0000409` / stack buffer overrun) during webpack compile ? not a TypeScript error.
- **Root causes:** (1) Stale/partial `.next` cache when prebuild clean hit `ENOTEMPTY` (dev server or prior build locking files). (2) Webpack build worker subprocess crash on Windows under memory pressure on this large app.
- **Fix:** `scripts/clean-next-build.mjs` ? retries + rename-aside fallback + `--strict` for deploy scripts. `package.json` ? `node --max-old-space-size=8192` for build. `next.config.ts` ? `experimental.webpackMemoryOptimizations: true`; `webpackBuildWorker: false` on `win32` only. `deploy-popuphub.ps1` / `ship.ps1` ? strict clean + `NODE_OPTIONS` before build.
- **Verify:** `npm run lint` ? PASS. `npx tsc --noEmit` ? PASS. `npm run build` ? PASS (build 177, webpack, `webpackBuildWorker` disabled on Windows). Turbopack not used ? prior Windows Turbopack manifest failures on `[id]` routes.
- **Next:** Commit + deploy when user asks.

## Active work ? sitemap canonical domain (local, not deployed)
- **Issue:** GSC shows sitemap submitted at `popuphub.ca` but `<loc>` URLs and `robots.txt` Host/Sitemap still use `popup-hub.vercel.app` when `NEXT_PUBLIC_SITE_URL` is unset at build time.
- **Fix:** `getRequestPublicOrigin()` reads `x-forwarded-host` on each request; `app/sitemap.ts` and `app/robots.ts` pass that origin into URL generation so `https://popuphub.ca/sitemap.xml` emits `popuphub.ca` links (works for any Vercel custom domain without per-domain env).
- **Verify:** After deploy, fetch `https://popuphub.ca/sitemap.xml` ? first `<loc>` should be `https://popuphub.ca/`; `robots.txt` Sitemap/Host should match. Re-submit sitemap in GSC (old "1 error / Unknown" may be stale from login HTML redirect).
- **Next:** Commit + deploy when user asks; optionally set `NEXT_PUBLIC_SITE_URL=https://popuphub.ca` for OG/canonical metadata site-wide.

- **Structured data:** Global Organization + WebSite JSON-LD in root layout; FAQPage on `/legal/faq`; richer Event schema (organizer, address, free admission).
- **Metadata:** `buildPublicMetadata` now sets keywords, canonical URLs, OG/Twitter defaults; legal + supplies pages migrated; authenticated portals (`/coordinator`, `/vendor`, `/login`) marked `noindex`.
- **Sitemap / robots:** Added `/supplies`, `/legal/about`; removed auth-only experience-designer URLs; sitemap lists active/published events only.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: view-source on `/`, `/discover`, `/events/{id}`, `/legal/faq` for meta + JSON-LD; fetch `/robots.txt` and `/sitemap.xml`.
- **Next:** Commit + deploy; re-submit sitemap in GSC after deploy (`/sitemap.xml` was redirecting to login HTML ? fixed in `lib/auth/public-paths.ts`).

## Active work ? coordinator IA: Markets + HubGrid (local, not deployed)
- **Issue:** Nav **Command center** landed on layout at `/coordinator/dashboard` while UI/URL used conflicting names (command center vs dashboard vs HubGrid).
- **Fix:** Canonical route **`/coordinator/studio`** (+ `/studio/ledger`); legacy `/coordinator/dashboard` redirects with query preserved. Nav + workspace rail: **Markets** (`/coordinator/markets`) and **HubGrid**. User-visible ?dashboard/command center? strings ? HubGrid where they mean the layout workspace.
- **Verify:** `npx tsc --noEmit` ? PASS. `npx tsx scripts/verify-document-scroll-routes.ts` ? PASS. Smoke: nav **Markets** ? list; **HubGrid** ? layout; old `/coordinator/dashboard` redirects.
- **Next:** Commit + deploy when user asks.

## Active work ? coordinator markets list route (local, not deployed)
- **Issue:** **View your markets** on `/coordinator` linked to `/coordinator/dashboard`, which auto-opened HubGrid for one market ? not a list of all markets despite the `(N)` count.
- **Fix:** New `/coordinator/markets` page + `CoordinatorMarketsList` ? upcoming/active and past sections, event hub links, per-market **Command center** buttons (`?event=`), global **Open command center** CTA. Home card now links there with **Browse all markets (N)**. Mobile command center redirects to `/coordinator/markets`; post-login layout redirect on phones ? markets.
- **Verify:** `npx tsc --noEmit` ? PASS. `npx tsx scripts/verify-document-scroll-routes.ts` ? PASS. Smoke: `/coordinator` ? **Browse all markets** ? `/coordinator/markets` lists all events; **Command center** nav ? layout designer for selected market.
- **Next:** Commit + deploy when user asks.

## Active work ? auto-arrange button feedback (local, not deployed)
- **Issue:** Coordinators could not tell if/when **AI Auto-Arrange** was pressed or finished.
- **Fix:** Running state on button (spinner, **Arranging?**, disabled); green status pill with placed count + timestamp after run; loading toast for all arrange modes (grid, fairness, AI).
- **Verify:** Click **AI Auto-Arrange** ? spinner + toast + pill; after finish ? **Arranged N placed at 2:34 PM** beside button.
- **Next:** Commit + deploy when user asks.

## Active work ? remove Arrange layout buttons (local, not deployed)
- **Goal:** Drop redundant **Arrange layout** toolbar buttons; coordinators use Optimize / auto-arrange instead.
- **Fix:** Removed `arrange-layout` block, header-bar slot, `handleArrangeLayoutInRoom` wiring, and toolbar order entries.
- **Verify:** Command center + wizard/spatial layout editors ? no **Arrange layout** button in header or alignment section.
- **Next:** Commit + deploy when user asks.

## Active work ? layout help in site nav (local, not deployed)
- **Goal:** Move green **Layout help** button into main site header on command center ? between Wallet nav link and notification bell (per coordinator UX).
- **Fix:** `app-nav.tsx` ? `LayoutEditorHelpButton` when coordinator on `/coordinator/dashboard`. `coordinator-layout-help-nav.ts` route helper. `canvas-command-bar-blocks.tsx` ? hide dashboard toolbar help unless fullscreen (nav hidden). `floor-plan-v2.tsx` ? `showFloatingFab={false}` (nav/toolbar entry points).
- **Fullscreen:** Layout help stays in canvas utilities when `#site-app-nav` is hidden.
- **Verify:** Command center ? green **Layout help** in top header right of Wallet; fullscreen ? help in canvas utilities; wizard/spatial unchanged.
- **Next:** Commit + deploy when user asks.

## Active work ? CI lint fix simulated-annealing (local, not deployed)
- **Issue:** CI lint failed ? `prefer-const` on `activeRoute` and `activeCoveragePct` in `simulated-annealing.ts` (lines 170?171); pipeline stops before build even though `next build` passes.
- **Fix:** `let` ? `const` for both (set once from `initialCoverage`, never reassigned).
- **Verify:** `npm run lint -- --quiet` PASS; `npm run build` PASS.
- **Next:** Commit + deploy when user asks.

## Active work ? auto-populate movable entrance/exit (local, not deployed)
- **Goal:** New floor-plan rooms start with one entry door and one emergency exit on perimeter walls, draggable like manually placed fixtures.
- **Module:** `components/coordinator/floor-plan-v2/state/ensure-default-traffic-doors.ts` ? `ensureDefaultTrafficDoors()` adds missing doors (`locked: false`), snapped to bottom (entry) and top (exit) center via `snapStructuralAssetToLocalPerimeter`.
- **Wired:** `canvas-init.ts` (Main Hall bootstrap + existing rooms), `layout-hydration.ts` (wizard room open), `use-floor-plan-doc.ts` (room frame patches / add-room).
- **Verify:** `npx tsx scripts/verify-default-traffic-doors.ts` ? PASS.
- **Next:** Commit + deploy when user asks.

## Active work ? initial loader disorganized-to-organized reveal (local, not deployed)
- **Goal:** Convey PopUp Hub's value in the first-visit loader ? fanned deck in center, then deal tables one-by-one to an organized perimeter ring, then logo and tagline.
- **Component:** `components/brand/initial-loader-reveal.tsx` + `lib/brand/initial-loader-controller.ts`.
- **Timing:** 2? duration (`holdFrame` 420, `totalFrames` 540 @ 60fps ? 7s reveal + 2s outro).
- **Sequence (progress 0?1):** fanned deck hold **0.03?0.26** ? card deal **0.26?0.68** ? logo **0.68?0.84** ? tagline **0.84?0.95** ? progress bar **0.91?1.0**.
- **Layout:** 3?3 ring; side rows paired **R0?L1** / **L0?R1**; logo lockup centered on ring interior (`cx`/`cy` + image `height/2` anchor).
- **Verify:** Hard refresh with cleared `popup-hub-initial-loader-shown` ? slower deal, logo centered in stall ring at end.
- **Next:** Commit + deploy when user asks.

## Active work ? patron table flush wall placement (local, not deployed)
- **Issue:** Patron / guest tables could not be dragged or placed flush against room walls during manual layout editing ? they stopped ~6? from the perimeter.
- **Root cause:** `wallInsetClearanceFt` in `lib/floor-plan/boundary-constraints.ts` applied `ROOM_PLACEMENT_CLEARANCE_FT` (6? = 2? `BOOTH_SAFETY_BUFFER_FT`) to guest tables while vendor booths used `VENDOR_WALL_INSET_FT` (0). That inset fed `footprintClampDeltaForRoom` (live drag via `boothLayoutMovePatch`) and `footprintWithinBounds` (draw commit via `isValidObjectPlacement`).
- **Fix:** All `kind === 'booth'` objects (vendor + patron) now use `VENDOR_WALL_INSET_FT` (0) for manual drag clamp and boundary validation. Physical overlap checks unchanged (`placedObjectsOverlap` ? edge-touch allowed, positive-area overlap blocked).
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts` ? PASS (added patron table flush + near-wall clamp cases).
- **Remaining constraints:** Table center must stay inside room polygon; rotated AABB must fit room bounds; true overlaps with other objects still block; auto-arrange / AI paths may still apply separate `WALL_BUFFER_FT` insets; vendor booths still get 3? clearance probes vs other booths.
- **Next:** Commit + deploy when user asks.

## Active work ? ClearanceHeatCell build fix (local, not deployed)
- **Issue:** Production build failed ? `exposureHeatmapToClearanceField` return type missing `clearanceFt`, not assignable to `ClearanceHeatCell[]` (`floor-plan-v2.tsx` lines 2050/2184).
- **Fix:** `lib/layout-strategies/fairness-engine/fairness-report.ts` ? `exposureHeatmapToClearanceField` maps exposure heatmap cells to clearance overlay cells with `clearanceFt: Math.max(0, cell.value) * BOOTH_VIEWING_DISTANCE_FT` (8 ft viewing distance) plus band (`critical` / `tight` / `good`). Matches `UnifiedLayoutSolver.ClearanceHeatCell` shape.
- **Usages:** Only `floor-plan-v2.tsx` (fairness scenario preview + apply paths); unified-solver paths use `unifiedMeta.clearanceField` directly (already has `clearanceFt`).
- **Verify:** `npx next build --webpack` ? **PASS** (build 164). `npx tsc --noEmit` ? **PASS**.
- **Next:** Commit + deploy when user asks (includes untracked `fairness-report.ts` + related fairness WIP).

## Active work ? fixed canvas toolbar layout (local, not deployed)
- **Goal:** Remove user ability to drag/reorder layout editor toolbars; tool groups stay in default positions.
- **Fix:** `canvas-toolbar-reorder.tsx` ? dropped framer-motion `Reorder` drag handles, chevron nudge buttons, reset-order control, and localStorage order persistence; blocks render in `DEFAULT_CANVAS_TOOLBAR_ORDER`. `canvas-toolbar-static.tsx` ? removed row up/down move buttons and saved row-order state; rows use `DEFAULT_STATIC_ROW_ORDER` (collapse state still persisted). Comment updates in `canvas-command-bar.tsx`, `toolbar-order.ts`.
- **Verify:** Wizard/spatial layout editor ? toolbar groups no longer show ?? drag handles or left/right reorder; static stacked rows no longer show up/down move chevrons. Dashboard top/header strips unchanged (already fixed section order).
- **Next:** Commit + deploy when user asks.

## Active work ? fullscreen layout editor toolbar parity (local, not deployed)
- **Issue:** Fullscreen mode showed only a subset of layout tools (utilities / zoom / dual-screen) while normal mode had the full command ribbon (select/hand, shapes, undo/redo, copy/paste, rotate, alignment, table sizes, etc.).
- **Root cause:** (1) Command-center **Full canvas** still portaled the main tool strip into the left rail even when immersive mode hid that panel ? only header utilities remained visible. (2) Native wizard/spatial fullscreen pinned the canvas to `100vh` with a fixed exit-only overlay that covered the inline toolbar; coordinators saw a clipped/wrapped tail of the ribbon.
- **Fix:** `floor-plan-v2.tsx` ? skip left-rail portal when `dashboardImmersive`; render the full wizard command bar in the native fullscreen toolbar slot; extract shared `wizardCommandBarSharedProps`. `dashboard-bootstrap.tsx` ? omit left panel in immersive mode. `fullscreen-layout.tsx` + `globals.css` ? toolbar in flex flow above canvas (fixed root, not overlapping overlay). `canvas-command-bar.tsx` ? allow wrap/scroll for fullscreen ribbon. `canvas-command-bar-blocks.tsx` ? unify **Exit Fullscreen** label.
- **Verify:** `/coordinator/dashboard` ? **Full canvas** ? full tool strip above canvas (shapes, history, alignment, vendor/patron sizes). `/coordinator/events/[id]/layout` or setup Step 3 ? **Full screen** ? full ribbon under exit row; Esc exits. Labels read **Exit Fullscreen** everywhere.
- **Intentionally fullscreen-only:** Presenter, Wall Cast, Layout help, zoom, eye/labels toggle remain in utilities; exit fail-safe row stays at top of native fullscreen shell.
- **Next:** Commit + deploy when user asks.

## Active work ? test suite populate duplicate loading label (local, not deployed)
- **Issue:** "Populate test suite" running state showed "Seeding vendors?" twice ? once in the violet pill button (flask icon) and again as `ProgressLabel` text below the progress bar.
- **Fix:** `test-suite-populate-button.tsx` ? removed `ProgressLabel` child from `Progress`; progress bar only. Stage text remains on the button pill.
- **Verify:** Click **Populate test suite** / compact **Test suite** ? single stage label on button; bar below with no duplicate text.
- **Next:** Commit + deploy when user asks.

## Active work ? FairnessFirst route-based exposure refactor (local, not deployed)
- **Goal:** Vendor fairness = equal probability a patron passes each booth (not serpentine spine proximity).
- **Primary metric:** PathfindingService booth tour (`route-coverage.ts` ? `CalculateOptimalPath`) + 1000-patron pass-by simulation (`exposure-simulator.ts`).
- **Score:** `fairnessScore = round(100 ? (1 ? normalizedVariance))` on per-booth pass-by %; **score 0 when coverage < 100%**; `layoutValid` requires 100% route coverage. 80% relative exposure rule is diagnostic only.
- **Pipeline:** serpentine seed (placement only) ? traffic fill ? **100% coverage gate** ? annealing (?20 booths) ? `buildFairnessReport` with histogram, heatmap, extrema, coverage %.
- **Ranking:** `generate-fair-layout-candidates.ts` ? coverage first, then fairness score, then variance.
- **UI:** fairness badge `Fairness N/100 ? X% cov`; scenario bar shows coverage + invalid flag + report summary; floor-plan overlay uses PathfindingService route + exposure heatmap.
- **Tests:** `npx tsx scripts/verify-layout-strategies.ts` ? **200/200 PASS** (~135s). `npm run build` ? **PASS** (build **163**, commit `9a302d3`, local uncommitted).
- **Perf note:** PathfindingService is slow for 10+ booths; annealing skipped for >20 booths; adaptive grid cell size in route-coverage.
- **Next:** Commit + deploy when user asks; consider loading indicator for large booth counts during auto-arrange.

## Active work ? exposure-simulator export build fix (local, not deployed)
- **Issue:** Vercel/local production build failed on commit `9a302d3` ? `exposure-simulator.ts` line 193 re-exported `boothFootprintRect` / `boothFacadeCenter` that were never defined in that module (`boothFootprintRect` lives in `placement-validator.ts`; `boothFacadeCenter` was file-private).
- **Fix:** Removed erroneous `export { boothFootprintRect, boothFacadeCenter }`; added missing `import type { Booth, Point } from '../types'`. Renamed deploy bat exit var `EXITCODE` ? `DPL_EXIT` in `PM/Deploy-popuphub.bat` + `scripts/get-deploy-commit-message.ps1` template (avoids `'EXITCODE' is not recognized` when cmd misparses after PS deploy failure).
- **Verify:** `npm run build` ? PASS (webpack). `npm run lint -- --quiet` ? 0 errors. No layout-strategies imports needed those re-exports.
- **Next:** Commit + deploy when user asks.

## Active work ? Fairness snake seed + score fix (local, not deployed)
- **Issue:** Fairness-first auto-arrange on irregular rooms showed **Fairness ~24/100**, scattered booths (left-edge stack + random center), green route visible but booths not flanking it. Perimeter pattern irrelevant to fairness engine but user expected tight snake rows + score 60+.
- **Root causes:**
  1. **Degenerate serpentine** ? co-located bottom entry/exit (same wall band) produced a 2-point route (door-to-door), so exposure sim scored almost nothing.
  2. **Wrong flow direction** ? seed forced `reverseFlow: false`, breaking top-entry rooms; bbox-edge legs clipped outside irregular polygons.
  3. **Narrow visibility cone** ? 60? forward-only cone ignored booths flanking aisle margins (lateral booths got 0 impressions ? high variance ? low score).
  4. **Bad seeding** ? sparse vertex-only slots + unrestricted traffic-fill merged bbox-scattered booths over snake seed.
  5. **Annealing** ? 1.8s budget too short for 20?50 booths; no rotation moves; objective didn't penalize distance from route.
- **Fix:**
  - `aisle-skeleton.ts` ? same-wall-band circulation turnaround, polygon `horizontalSpanAtY`, auto flow/axis inference, improved clip.
  - `fairness-seed.ts` ? arc-length aisle slots both sides, booth-sized margins, route-biased fallback, traffic fill only for unplaced + route-proximity filter.
  - `exposure-simulator.ts` ? forward half-plane visibility (?90?) + route-distance gate for aisle-margin booths.
  - `simulated-annealing.ts` ? scaled budget (up to 12s), rotate/swap/nudge, variance + route-distance objective, fast 250-patron eval during search.
  - `generate-fair-layout.ts` ? always return serpentine route (not traffic pathway); traffic fill only when snake leaves gaps.
- **Verify:** `npx tsx scripts/verify-layout-strategies.ts` ? **2847/2847 PASS**. Fixture scores: rectangle 6-booth **79**, irregular 6-booth (bottom doors) **90**, 50-booth **55**, multi-scenario 50-booth best **55** (~10s).
- **User retest:** HubGrid ? irregular room + bottom entry/exit doors ? Engine **Fairness** ? **AI Auto-Arrange** ? booths in rows flanking green serpentine; badge **Fairness 60?90+** on well-filled rooms (depends on booth count vs polygon area).
- **Next:** Commit + deploy when user asks.

## Active work ? Fairness path vs patron overlay gap (local, not deployed)
- **User question:** Why does the patron/green path not visit every booth in fairness scenarios? What does fairness score 0?100 mean?
- **Finding (confirmed gap):** Production fairness (`lib/layout-strategies/fairness-engine/`) scores booths against a **fixed serpentine circulation centerline** (`buildSerpentineAisle` ? `aisle.centerline`), **not** a booth-by-booth tour. The green dashed spine after Fairness auto-arrange (`UnifiedLayoutFlowOverlay`, `#059669`) is that serpentine ? it is **not** the TSP path and is **not** expected to pass every table.
- **Fairness score:** `computeFairnessScore` in `fairness-scorer.ts` = `100 ? (1 ? normalizedVariance)` on per-booth **normalized impression counts** from `exposure-simulator.ts` (1000 virtual patrons sampled along the serpentine; 8? viewing distance + forward half-plane visibility). **100 = equal impressions across booths**; does **not** require route to visit every booth. Test targets only: rectangle ?40, irregular ?30 (no UI ?good? threshold).
- **Separate overlay:** Toolbar **Route / patron path** (`PatronTrafficPathOverlay`, blue `#0284c7` or orange if partial) uses `PathfindingService.CalculateOptimalPath` ? A* + nearest-neighbor + 2-opt **does** aim to visit every booth; shows `missedBoothIds` toast when aisles block approach. **Not wired into fairness scoring.**
- **Dead code path:** Standalone `lib/vendor-fairness-layout/` has TSP route (`generateRoute`) + alternate scoring formula (`fairness-score.ts`, max variance 0.25) ? demo module; floor-plan fairness engine does not call it.
- **Other gaps:** Route frozen at seed time while annealing moves booths; traffic-fill booths far from spine get low/zero exposure but still affect score denominator; scenario variants change serpentine axis/bias so path looks ?erratic? across compares.
- **Recommended fix (when prioritized):** (1) UX ? label spine vs booth-tour overlays; (2) score using post-layout booth tour (`PathfindingService` or wire `vendor-fairness-layout/generateRoute`); (3) optionally recalc route after annealing. No code change this session (investigation only).

## Active work ? Multi-scenario fairness auto-arrange (local, not deployed)
- **Goal:** Fairness-first **AI Auto-Arrange** evaluates multiple layout scenarios (serpentine axis, aisle bias, anneal seeds), auto-applies the best fairness score, and lets coordinators compare alternates on canvas.
- **Engine:** `generateFairLayoutCandidates` in `lib/layout-strategies/fairness-engine/` ? scenario library (up to 8 variants), booth-count caps (7?3 scenarios for 200+ booths), shared 3.6s budget with per-scenario annealing slices; alternate scenarios skip traffic fill for speed. `buildSerpentineAisle` supports horizontal/vertical + reverse flow. `LayoutResult` carries optional `scenarioId` / `scenarioLabel`.
- **Wiring:** `PackBooths` fairness path runs multi-scenario by default (`fairnessCandidates` ranked best-first). Traffic-aware / unified paths unchanged.
- **UI:** `fairness-scenario-bar.tsx` ? after run, best applied + toast ?best of N scenarios?; **Compare N scenarios** chip on canvas opens stepper (Prev/Next, Apply, dismiss reverts to committed).
- **Tests:** `npx tsx scripts/verify-layout-strategies.ts` ? **2846/2846 PASS** (multi-scenario ranking + 50-booth ? 5 ~12s).
- **Verify:** HubGrid ? Engine **Fairness** ? entry/exit doors ? **AI Auto-Arrange** ? toast shows best-of-N; click **Compare scenarios** to preview alternates and **Apply** to commit.
- **Next:** Commit + deploy when user asks.

## Active work ? Fairness-first auto-arrange verification (local, not deployed)
- **Goal:** Confirm Engine **Fairness** + **AI Auto-Arrange** bypasses Gemini, uses `PackBooths` ? `generateFairLayout`, requires entry/exit doors, and yields snake circulation + non-zero fairness score on irregular rooms.
- **Trace (verified):**
  1. `floor-plan-v2.tsx` `handleAutoArrangeFloorPlan` ? when `vendorLayoutMode === fairness_first` and vendor booths exist, returns early after local `PackBooths` (no `runAutoArrangeWithAi` / Gemini).
  2. `BoothArrangementEngine.PackBooths` ? fairness mode calls `layoutRequestFromDocRoom` + `generateFairLayout` (polygon serpentine seed ? filtered traffic fill ? annealing ? sanitize).
  3. `request-ai-auto-arrange.ts` `deterministicFallback` ? also routes fairness_first to `PackBooths` if Gemini path is ever hit (UI path does not).
  4. Doors: `evaluateTrafficFlowPrerequisites` ? entry (`doorType: entrance`) + exit (`doorType: exit` or `emergency_exit`) on perimeter (?1.5? from wall). Missing ? Run disabled + toast `AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP`. `layoutRequestFromDocRoom` falls back to room-center entrance/exit only if prereqs fail (UI blocks before pack).
- **Fix this session:** `autoArrangeDisabledReason` now matches handler ? Fairness-first + Grid still requires entry/exit (Run button disabled with door tooltip, not enabled-then-toast).
- **Regression:** `npx tsx scripts/verify-layout-strategies.ts` ? **1485/1485 PASS** (added irregular 6-vertex polygon fixture + L-shape/rectangle/stress). Production baseline `a69841e` (prior fairness polygon fix in `ba6b2b1`).
- **User steps (HubGrid):** Draw irregular room (merged zone or `perimeterRing`) ? **Vendor Booths** tool place tables ? **Shapes ? Door** entry on wall (`entrance`) + exit (`exit` or emergency exit) snapped to perimeter ? Optimize toolbar ? Engine **Fairness** ? **AI Auto-Arrange** ? booths inside green boundary in snake rows along circulation overlay; toast + badge `Fairness N/100` with N ? 1.
- **Next:** Commit + deploy when user asks.

## Active work ? CI + Windows production build fix (local, not deployed)
- **Issue:** Local deploy (`PM\Deploy-popuphub.bat`) failed build 143?144 on commit `a662315` with `TurbopackInternalError: failed to write` to `.next\server\app\coordinator\events\[id]\print\page\next-font-manifest.json` (Windows os error 3). GitHub Actions **CI / build** also failed on `f679cb0` / `a662315` (lint step; build skipped).
- **Root causes:**
  1. **CI:** ESLint `prefer-const` error ? `let route = snakeSeed.route` in `lib/layout-strategies/fairness-engine/generate-fair-layout.ts:115` (`route` never reassigned). CI runs `npm run lint` before `npm run build`.
  2. **Local Windows deploy:** Turbopack production build intermittently fails writing manifest files under dynamic-route paths (`[id]`) when `.next` is stale/locked (dev server, interrupted build, or Windows path/bracket handling). Panic log path was empty/expired.
- **Fix:**
  - `const route = snakeSeed.route` (CI lint).
  - `package.json` ? `build`: `next build --webpack`; `prebuild`: `scripts/clean-next-build.mjs` then bump build number.
  - `scripts/clean-next-build.mjs` ? removes `.next` before every production build.
  - `scripts/deploy-popuphub.ps1` + `scripts/ship.ps1` ? remove full `.next` before local build (not just lock file).
- **Verify:** `npm run lint -- --quiet` ? 0 errors. `npm run build` ? PASS (webpack, clean `.next`). `app/coordinator/events/[id]/print/page.tsx` ? no code issues.
- **Next:** Commit + push to unblock master CI and local deploy (not committed this session per user request).

## Active work ? Fairness-first layout polygon fix (local, not deployed)
- **Issue:** Fairness-first + Auto-Arrange on irregular (L-shaped) rooms placed booths outside the green dashed boundary, with overlaps, random orientations, and fairness score **0/100**.
- **Root causes:**
  1. `generateFairLayout` seeded from bbox-only `packBoothsTrafficAware` ? filled the bounding rectangle, ignoring the room polygon notch.
  2. `placementIsValid` checked AABB corners (not rotated footprint corners) and used bbox wall inset instead of polygon inset.
  3. Annealing accepted/reported invalid initial seeds; no final sanitize pass.
  4. `orientBoothToNearestWall` ran after fairness pack and overwrote aisle-facing rotations.
  5. AI Auto-Arrange deterministic fallback ignored `vendorLayoutMode: fairness_first` (Gemini path only; fairness UI path already used `PackBooths` directly).
- **Fix:** Polygon-aware serpentine seed (`fairness-seed.ts`), rotated-corner validation + `sanitizePlacements`, merged snake + filtered traffic fill, annealing only on valid states, skip wall re-orient for fairness results, AI fallback routes to `PackBooths` fairness when mode set. Traffic-aware path unchanged.
- **Verify:** `npx tsx scripts/verify-layout-strategies.ts` ? 1455/1455 PASS (includes L-shape in-polygon + clearance checks). `npx tsc --noEmit` ? PASS. Smoke: HubGrid ? Engine **Fairness** ? draw irregular room + entry/exit doors ? Auto-Arrange ? booths inside boundary, snake circulation overlay, score > 0.

## Active work ? Traffic-aware auto-arrange greyed out fix (local, not deployed)
- **Issue:** AI Auto-Arrange **Traffic-aware** / **Perimeter** controls stayed disabled in HubGrid even when the canvas showed many table-like blocks; tooltip said ?draw at least one vendor booth or patron table?.
- **Root cause (dual):**
  1. **Counting bug:** `vendorBoothsInRoom` / patron counts used strict `doc.objectRoom[id] === roomId` while placement and save use geometry fallback when the sidecar tag is missing (common on localStorage drafts and legacy hydration). Booths rendered on canvas but counted as zero.
  2. **UX coupling:** Pattern + Engine dropdowns shared the same `disabled` gate as the Run button, so missing prerequisites (or zero count) greyed out **Traffic-aware** even when the user only needed to pick Grid or add doors.
- **Fix:** `resolveObjectRoomId()` in `geometry/is-point-in-room.ts` ? sidecar tag first, else geometry (matches `legacyRoomsFromDoc`). Wired through `vendorBoothsInRoom`, `patronTablesInRoom`, `autoArrangeInRoom`, traffic-flow prerequisites. `FloorPlanOptimizeControl` ? dropdowns enabled when arrangeable booths exist; Run button disabled separately with prerequisite tooltip. Clearer tooltips (`AUTO_ARRANGE_NEEDS_BOOTHS_TOOLTIP`, wrong-room hint, entry/exit door requirement).
- **User guidance:** Auto-arrange only sees objects placed via **Vendor Booths** or **Patron Tables** toolbar sections (`kind: 'booth'`). Generic **Shapes** (walls, stages, labels, food trucks) do not count.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: dashboard HubGrid ? place vendor booths (Vendor Booths tool) ? Perimeter + Traffic-aware dropdowns enabled; without entry/exit doors Run shows door tooltip but engine selector stays active; Grid mode runs without doors.

## Active work ? floor plan empty-grid marquee + crosshair (local, not deployed)
- **Issue:** Select tool on the floor plan canvas did not show crosshair over empty grid cells, and drag on empty interior started room drag instead of marquee multi-select.
- **Root cause:** `use-canvas-pointer` treated any click inside a room frame (not just the perimeter stroke) as a room-drag gesture, so marquee never started. Command-center select mode also forced a `grab` cursor instead of crosshair on empty canvas.
- **Fix:** Select tool ? room drag only from explicit `data-room-stroke` hits; empty interior falls through to marquee. Track `emptyCanvasHover` for crosshair cursor on empty grid (edit mode only; `viewOnly` unchanged). `onPointerLeave` clears hover chrome.
- **Verify:** Dashboard HubGrid or setup Step 3 ? **Select** tool ? hover empty grid shows crosshair; drag a box over multiple booths selects them (blue dashed marquee preview). Click room perimeter stroke still selects/moves the room. Preview / view-only surfaces unchanged.

## Active work ? test suite seed redirect fix (local, not deployed)
- **Issue:** After **Test suite** / vendor seed during setup Step 3 or Command center, UI bounced to **Set up your floor plan** (50?50 empty-state form) instead of staying in HubGrid with toolbar.
- **Root cause:** `TestSuitePopulateButton` called `router.refresh()` after canvas populate; `MarketManagementProvider` re-synced `layoutRooms` from server on every refresh ? when the layout was still in-memory only (no `booth_layouts` row yet), rooms were wiped and `DashboardNoRoomEmptyState` replaced the canvas. Setup wizard had no `populateTestSuiteOnCanvas` hook, so seed only refreshed and never placed booths on the wizard canvas.
- **Fix:** Drop post-populate `router.refresh()` when canvas populate succeeds (approved pool already refreshed client-side). Preserve in-memory rooms when same-event server bundle is empty. Wire wizard Step 3 `populateTestSuiteOnCanvas` via `WizardStepFloorPlan` store ref ? `LayoutPlannerHeader` ? `TestSuitePopulateButton`.
- **Verify:** Draft market ? setup Step 3 (`?step=4`) or dashboard with first room created ? **Test suite** ? vendors seeded, booths placed, canvas + toolbar remain visible (no empty-state form). Switch markets still loads saved layouts from server.

## Active work ? Vendor Fairness Layout Engine (local, not deployed)
- **Goal:** Fairness-first booth layout module ? minimize exposure variance across vendors (not shortest walking distance).
- **Shipped:** `lib/vendor-fairness-layout/` ? geometry (turf polygon, SAT overlap, serpentine aisle), nav graph, route (A* + Dijkstra + NN/2-opt; fast snake path for 80+ booths), exposure simulator (1000 attendees), simulated annealing optimizer, fairness score 0?100. Adapter `adapters/floor-plan-v2.ts`. React SVG components in `components/vendor-fairness-layout/`. Demo at `/dev/fairness-layout`.
- **Tests:** `npm run test:fairness-layout` (geometry + integration); `npm run test:fairness-layout:stress` ? 200 booths ~1.6s layout, route recalc ~2ms.
- **Integration:** Parallel to existing auto-arrange ? wire as `fairness-first` mode in floor-plan-v2 later (not done this session).
- **Verify:** `npm run test:fairness-layout` ? all PASS. Open `/dev/fairness-layout` ? Generate fair layout ? SVG floor plan with route overlay and fairness score.

## Active work ? Vendor Fairness Layout Engine (strategy-based, local, not deployed)
- **Architecture:** Option A strategy pattern in `lib/layout-strategies/` ? `LayoutStrategy`, `LayoutMode` (`traffic_aware` | `fairness_first`), `AutoArrangeEngine` orchestrator (`AutoArrangeOrchestrator.ts`). Full tree in `lib/layout-strategies/README.md`.
- **Phase A:** `TrafficAwareStrategy` wraps existing `packBoothsTrafficAware` ? regression-verified identical placements for fixed fixtures.
- **Phase B:** `FairnessFirstStrategy` + `fairness-engine/` (snake circulation, exposure sim, simulated annealing, fairness scorer 0?100).
- **Phase C:** `BoothArrangementEngine.PackBooths` delegates to fairness pipeline when `vendorLayoutMode: fairness_first`; default unchanged traffic-aware / unified paths.
- **Phase D:** UI engine toggle (Traffic / Fairness) on Optimize control; `FloorPlanDoc.vendorLayoutMode` + `LayoutRoom.vendor_layout_mode` persisted via legacy bridge; fairness score badge + toast after run.
- **Phase E:** `npx tsx scripts/verify-layout-strategies.ts` ? 10/10 PASS; `verify-auto-arrange-engine.ts` unchanged PASS.
- **Verify:** Command center ? Optimize ? Engine **Fairness** ? Auto-Arrange with entry/exit doors ? toast shows score; badge shows `Fairness N/100`.

## Active work ? Deploy bat cmd.exe %DE parse fix (local, not deployed)
- **Issue:** `PM\Deploy-popuphub.bat` failed with `'PLOY_PS1"' is not recognized` (exit 9009) ? cmd.exe parsed `%DE` inside `%DEPLOY_PS1%` before the full variable name.
- **Fix:** Renamed bat vars to `DPL_*` (`DPL_SCRIPT`, `DPL_PS_ARGS`, `DPL_NO_PAUSE`); path/script invocations use delayed expansion (`!VAR!`). Template in `get-deploy-commit-message.ps1` updated so regenerated `.bat` stays safe.
- **Verify:** `cmd /c "set DE=broken&& PM\Deploy-popuphub.bat -SkipBuild -SkipCommit -SkipDeploy -SkipHandoff --no-pause"` ? PowerShell deploy script runs (no PLOY_PS1 error).

## Active work ? 1? grid lines restored (local, not deployed)
- **Issue:** Floor plan canvas showed only 5? major grid blocks ? 1? minor subdivisions disappeared.
- **Root cause:** `canvas-grid.tsx` pattern tiles gained opaque `#fafaf9` fills; the 5? major pattern layer painted over the 1? minor strokes.
- **Fix:** Pattern tiles are stroke-only again; single background rect supplies the stone fill beneath both layers.
- **Verify:** `/coordinator/dashboard` ? 50? room shows 1? minor lines with darker 5? accents; zoom to 100%+ for clearest cells.

## Active work ? category proximity edge gaps + Arrange layout in header (local, not deployed)
- **Issue:** Same-category booths (color) could sit flush adjacent after **Arrange layout** ? proximity used center-to-center distance, so large booths cleared the 4-col / 2-row rule while touching. **Arrange layout** floated over the canvas instead of the dashboard header bar.
- **Fix:** `category-rules.ts` ? `boothEdgeGapsInGridSpaces` measures edge-to-edge gaps; auto-arrange, patron-centric layout, and unified solver updated. **Arrange layout** moved to header bar blank space (`ml-auto` in `canvas-toolbar-static.tsx`); wired via `handleArrangeLayoutInRoom` in `floor-plan-v2.tsx`; removed canvas overlay button.
- **Verify:** `npx tsx scripts/verify-category-rules.ts` ? PASS. `npx tsx scripts/verify-auto-arrange.ts` ? 31/31 PASS. Smoke: dashboard HubGrid ? **Arrange layout** in top header (right of hall tools) ? grid packs with no same-color neighbors touching.

## Active work ? patron path overlay pathfinding fix (local, not deployed)
- **`PathfindingService.ts`:** Door threshold terminals via `evaluateTrafficFlowPrerequisites` + inward projection; booth **approach nodes** (not centers); A*-distance TSP + 2-opt; LOS string-pull smoothing; segment routing without phantom chords; `missedBoothIds` / `missingDoors` flags; fixed `ftToGrid` ? `gridToFt` consistency.
- **`lib/floor-plan/grid-path-smoothing.ts` (new):** Bresenham line-of-sight + string-pull for grid paths.
- **UI:** `PatronTrafficPathOverlay` renders multiple polylines per leg; toasts for missing doors / unreachable booths; missed booths highlighted with bottlenecks.
- **Verify:** `npx tsx scripts/verify-layout-pathfind.ts` ? all checks PASS. Smoke: enable patron path on packed room with entry/exit doors ? path starts at entrance, visits every vendor booth in aisles, ends at exit.

## Active work ? layout help overlap + wizard dual-screen restore (local, not deployed)
- **Issue:** Floating green **Layout help** FAB overlapped wizard footer (Save market / Back); **Presenter** / **Wall Cast** dual-screen buttons missing on setup Step 3 and full layout editor.
- **Root cause:** `LayoutEditorHelpFab` fixed to bottom-right while toolbar already has Layout help; `onLaunchDualScreen` gated to `variant === 'dashboard'` only.
- **Fix:** Hide floating FAB when toolbar exposes help (`showFloatingFab={isDashboard}`). Enable dual-screen launch on all floor-plan surfaces; add `FloorPlanDualScreenBridge` for wizard/spatial sync. Add `dual-screen` to default toolbar order.
- **Verify:** Setup Step 3 ? no FAB over footer; toolbar shows Presenter + Wall Cast + Full screen; open Presenter ? booth matrix connects. Command center dashboard still has floating FAB + dual-screen.

## Active work ? test suite dense fill + progress (local, not deployed)
- **Issue:** Test suite placed only ~12 booths in Main Hall (deterministic grid capacity cap) with no in-flight progress UI.
- **Root cause:** `estimateRoomFillCapacity` / `fillRoomWithTables` deterministic grid allows 12 slots in 50??50? with 6??2? vendor tables (aisle rules); shelf-pack fits all 58.
- **Fix:** `fill-room-with-tables.ts` ? `packMode: 'dense'` uses `packVendorBoothsInRoomGrid` (QA/test-suite path). `populate-test-suite-canvas.ts` requests full `tableSlots` count via dense pack. `test-suite-populate-button.tsx` ? staged toast + inline progress bar (seed ? place ? assign); warns when placed &lt; target.
- **Verify:** Command center with Main Hall visible ? **Test suite** ? progress stages visible ? 58 vendor booths placed and assigned for 48-vendor seed. `npx tsx` dense fill probe: 58/58 in 50?50.

## Active work ? patron table toolbar horizontal layout (local, not deployed)
- **Issue:** Patron layout controls (circle/rect size pickers + Fill) stacked vertically in the placement toolbar row.
- **Fix:** `PatronTableSizeRows` uses a horizontal flex row; patron block wrapper uses `flex-nowrap` so Fill stays on the same line.
- **Verify:** Event layout or dashboard ? expand **Patron & vendor** toolbar row ? circle + 5?/6?/8?, rectangle + 5?/6?/8?, and Fill appear on one horizontal strip.

## Active work ? booth label vertical alignment (local, not deployed)
- **Issue:** Booth labels (e.g. "Booth 1") overlapped the top stroke ? SVG baseline offset was too small and ignored padY.
- **Fix:** `canvas-objects.tsx` `renderObjectLabel` centers wrapped text with padY inset and ~0.75em baseline offset so cap height stays inside the box.
- **Verify:** Event layout or dashboard floor plan ? vendor booths with short labels render fully inside the green rect, not clipped on the top border.

- **Issue:** Quick-start Step 1 said "Use these tabs" while the tour card sat on top of the room picker ? unclear what it referred to.
- **Fix:** Step 1 copy now points at the green outline, room name buttons, and + Add room in the left panel. Tour card moves beside left-rail targets (into the canvas area) instead of below them so the highlighted controls stay visible.
- **Verify:** `/coordinator/events/{id}/layout` ? start quick-start tour ? Step 1 card sits to the right of the green outline; Main Hall tab and + Add room remain visible.

- **Issue:** "Add room" preset dropdown was clipped on the left in the layout planner left rail (~240px) ? menu used `absolute` positioning inside `overflow-hidden` ancestors.
- **Fix:** `layout-room-bar.tsx` ? preset picker now uses portaled `Popover` (`RoomPresetPicker`) so the menu renders above scroll/overflow containers with viewport-aware positioning.
- **Verify:** Setup Step 3 or `/coordinator/events/{id}/layout` left rail ? click chevron on **Add room** ? full preset list visible (Empty room, Kitchen Area, etc.).

## Shipped ? Supabase RLS security audit (2026-06-17, Popup Hub prod verified)
- **Alert context:** Supabase `rls_disabled_in_public` email listed Popup Hub (`ensbggtbgabogvynqsqt`) and Tipsy Fox Escapes (`joimnchtgxhhzoeopxdv`). This repo only uses Popup Hub (`supabase/config.toml`, `scripts/push-migrations.ps1`). Tipsy Fox Escapes is a **separate Supabase project** ? not referenced in this codebase (Tipsy Fox here is the vendor/Square operator brand only).
- **Popup Hub finding:** `coordinator_escrow_holds` was created in `101_coordinator_escrow_vouch.sql` without RLS; `transaction_log` view used SECURITY DEFINER.
- **Fix (already applied on remote):** `110_escrow_holds_rls_transaction_log_invoker.sql` ? RLS on `coordinator_escrow_holds` with read-only policies (`escrow_holds: coordinator read own`, `escrow_holds: vendor read own transactions`); `transaction_log` recreated with `security_invoker = true`. Migration `110` shows applied on remote via `npx supabase migration list`.
- **Live audit (2026-06-17):** All 52 `public` tables on `ensbggtbgabogvynqsqt` have `relrowsecurity = true`. Only `audit_security_logs` has RLS with zero policies (intentional ? service-role append-only). No new migration needed for Popup Hub.
- **Tipsy Fox Escapes:** Fix in that project's repo/dashboard ? enable RLS + policies on any exposed tables there; not actionable from popup-hub.
- **Verify:** Supabase Dashboard ? Popup Hub ? Database ? Linter ? `rls_disabled_in_public` should be clear. Re-run linter on Tipsy Fox Escapes project separately.

## Active work ? community league hall venue verification (local, not deployed)
- **Issue:** Publish failed with ?Coordinates point to a street address only? for community league halls ? Google reverse geocode often returns only `street_address` + `route` for these buildings.
- **Fix:** `verify-venue-coordinates.ts` now scans all geocode results (not just the first), accepts known Edmonton hall registry matches, and accepts named public venues (community league/hall, recreation centre, legion, etc.) when a pin is dropped with a complete address. `locationName` is passed through verify API + publish toggle.
- **Verify:** `npx tsx scripts/verify-venue-coordinates.ts` ? PASS. Publish a market at a community league hall with venue name like ?Kilkenny Community League? and pin on the building.

## Active work ? application board status UX (local, not deployed)
- **Issue:** Approved+paid cards still showed Review / Waitlist / Decline; no way to move cards between columns.
- **Fix:** Card actions are status-aware (approved/pending insurance/rejected ? View only; pending ? full workflow; waitlisted ? Approve/Decline). Drag handle on each card; drop on column updates status (Declined column prompts for optional message).
- **Verify:** `/coordinator/events/{id}/applications` ? approved paid vendors show View only; drag grip to Pending / Waitlist / Declined columns.

## Active work ? sticky vendor/patron table placement (local, not deployed)
- **Regression:** Wizard/layout editor reverted to Select after each booth stamp; only dashboard stayed armed.
- **Fix:** `handleAfterDrawCommit` keeps draw+booth armed (clears selection only); `stickyDrawPlacement` on wizard canvas too.
- **Verify:** Setup Step 3 or `/coordinator/events/{id}/layout` ? arm Vendor or Patron table ? click to place repeatedly until picking Select, wall, or another tool.

## Active work ? vendor booth light green (local, not deployed)
- **Canvas:** Well-placed vendor booths (`good` clearance band) tint light green (`#bbf7d0`); draw preview fallback matches.
- **Toolbar:** Vendor table draw button + size chips use light emerald (`VENDOR_BOOTH_TOOLBAR`) instead of amber/dark forest.
- **Verify:** `/coordinator/dashboard` or event layout ? place vendor booth with ?4? clearance ? light green fill; draw tool + size pill highlight emerald when armed.

## Active work ? setup wizard capacity URL step fix (local, not deployed)
- **Issue:** Capacity & pricing showed as `?step=3` in the URL while the UI labeled it Step 2 (legacy 4-step mapping).
- **Fix:** `setupWizardStepToUrlParam(2)` now writes `?step=2`; legacy `?step=3` capacity links still parse correctly and normalize to `?step=2` on load. Floor plan stays at `?step=4` to avoid colliding with old capacity bookmarks.
- **Also:** Quarter-auction copy on Step 1 now says "step 2" for caps; skip-layout layout redirect uses `?step=2`.
- **Verify:** `npx tsx scripts/verify-setup-step-url.ts` ? PASS. Open setup ? Capacity ? URL shows `?step=2`; old `?step=3` bookmark lands on Capacity and URL updates to `?step=2`.

## Active work ? vendor contract signing (local, not deployed)
- **`109_vendor_contract_signatures.sql`:** `booth_contract_signed_at` + `booth_contract_signature_method` on `booth_applications`.
- **`BoothContractSnapshot`:** `signature_method`, `signed_name`, `signature_image_url`, `signed_document_url`, `signed_at`.
- **`signature-pad.tsx` + `booth-contract-signing.tsx`:** Digital canvas sign (name + draw) or print/upload signed PDF/scan tabs in apply dialog.
- **`lib/booth-contract/print-contract.ts`:** Print clauses or open coordinator PDF.
- **Apply flow:** `apply-button.tsx` uploads signature/doc; `app/api/vendor/apply/route.ts` validates and stores snapshot; coordinator notified on uploaded signed copy.
- **Coordinator review:** `vendor-review-drawer.tsx` shows digital signature image or uploaded signed document link.
- **Verify:** Run migration `109` on Supabase. `npx tsx scripts/verify-booth-contracts.ts` ? PASS. Smoke: vendor apply dialog ? Sign digitally (name + draw) OR Print & upload ? submit; coordinator application review shows signature or signed copy.

## Active work ? coordinator saved layouts (local, not deployed)
- **`108_coordinator_saved_layouts.sql`:** New table for coordinator-owned floor plan templates keyed by venue (`location_name` + `address`), with optional `is_public` for sharing at the same venue.
- **`lib/coordinator/saved-layouts.ts` + `saved-layout-snapshot.ts`:** List/save/delete/touch helpers; vendor assignments stripped on save; fresh room/cell ids on load.
- **`components/coordinator/saved-layout-picker.tsx`:** Load dropdown (Your layouts / Shared at this venue), save dialog with public toggle, quick-delete chips for own layouts.
- **UI:** Spatial layout toolbar (`/coordinator/events/{id}/layout`) and setup Step 3 header (`/coordinator/events/{id}/setup?step=4`).
- **Verify:** Run migration `108` on Supabase. Coordinator ? event layout ? build rooms/fixtures ? **Save layout for reuse** ? new event at same venue ? **Load saved layout**. Toggle **Share at this venue** and confirm another coordinator account sees it under Shared.

## Active work ? fill room with tables (local, not deployed)
- **`lib/floor-plan/fill-room-with-tables.ts`:** Replace vendor or patron tables in the active room with N tables of the selected size, then grid-pack via `autoArrangeInRoom`. Capacity estimate uses `maxDeterministicGridSlotCount`.
- **`fill-room-control.tsx` + toolbar:** Number input (defaults to max fit) + **Fill room** button in Vendor Booths and Patron Tables sections (dashboard + layout editor sidebar).
- **Verify:** Coordinator dashboard or event layout ? select a room ? Vendor Booths: set size, enter count, **Fill room** ? grid of vendor booths; Patron Tables: same for guest round/rect tables. Existing tables of that type in the room are replaced.

## Active work ? canvas label grow-to-fit (local, not deployed)
- **`canvas-label-text.ts`:** `wrapTextInContainer` and `fitTextInContainer` now scale **up** to the largest font that fits (short labels fill booth boxes) as well as shrinking/wrapping when text overflows. Optional `maxFontSize` override added.
- **Verify:** Coordinator dashboard ? short booth labels (e.g. "Booth", category names) render larger inside yellow vendor cells; long vendor names still wrap or ellipsis without clipping.

## Active work ? Supabase migrations pushed (2026-06-13)
- **`npx supabase db push --yes`:** Migration **088** (`market_booth_pricing_schema_repair`) was already applied on remote; pending **104**?**107** applied successfully.
- **Verify:** `npx tsx scripts/verify-events-schema.ts` ? PASS (`events.booth_price_cents`, `events.multi_table_discount_percent`, `booth_applications.table_count`).

## Active work ? reinstate vendor spacing clearance warnings (local, not deployed)
- **`booth-clearance-visual.ts`:** Added `vendorBoothClearanceWarningBand` (uses `minVendorBoothClearanceFt` incl. neighbours); canvas + preview probe + legend summary use it again. `minVendorBoothBoundaryClearanceFt` kept for boundary-only checks.
- **`booth-clearance-summary.ts` + `booth-clearance-warning-panel.tsx`:** Copy updated ? yellow at 3??4? edge clearance to neighbours/walls/fixtures; red below 3?. Toast/toggle copy: yellow = may be too close; red = too close (vendor, table, wall, or fixture); legend + triangle toggle hint.
- **Verify:** `npx tsx scripts/verify-object-overlaps.ts` ? PASS (3? pair ? yellow `tight`). Place two vendor booths 3? apart ? yellow tint + legend alert; ?4? ? no tint.

## Active work ? zoom in/out regression fix (local, not deployed)
- **Root cause:** `frameActiveRoom` in production `floor-plan-canvas.tsx` depended on the `viewport` API object (recreated every render, including each zoom tick). That re-ran `fitViewportToContent` continuously ? toolbar zoom and Ctrl+wheel appeared dead as the camera snapped back to fit.
- **Fix:** Restored `viewportRef` + `frameActiveRoomRef` pattern from QA mirrors; framing effects keyed on `viewportFramingKey` / room dimensions only (not `originX`/`originY` drags); ResizeObserver reframes once when viewport first becomes measurable.
- **Verify:** `/coordinator/dashboard` and `/coordinator/events/{id}/layout` ? zoom +/- steps 50/75/100/125%; Ctrl+wheel zoom holds; pan after zoom does not snap back.

## Active work ? spatial layout compact header (local, not deployed)
- **`chrome="spatial"`** on `FloorPlanV2` ? drops redundant internal "Layout tools" bar; rooms stay in command bar.
- **`spatial-layout-toolbar.tsx`** ? single compact row: back, title + event name + help inline, actions on the right (`h-7`/`py-1.5`).

- **`layout-editor-help-tours.ts` + `layout-editor-help-tour.tsx`:** 5-step quick-start tour with step card (Back/Next/Done), scroll-into-view on targets.
- **Overlay UX:** steady full-screen dim for entire tour (no scrim flicker); static emerald ring on highlighted control (no pulse).
- **Positioning:** viewport-clamped highlight box, header clearance on step 1 rooms bar, card portaled to `document.body` (avoids wizard shell clipping), measured card height + prefer-below when target is near top.
- **`data-layout-help` anchors:** rooms bar, navigation (V/H), draw tools, vendor booths, canvas, save actions, optimize, layout help button ? wired in command bar, spatial toolbar, and canvas host.
- **Entry points:** first visit auto-tour (~1.2s), banner **Guide me on the page**, help dialog **Start interactive tour** / per-topic **Show me on the page**.
- **Verify:** `/coordinator/events/{id}/layout` ? Step 1 rooms bar fully visible (not clipped under header); page dim stays steady; only target control pulses.

## Active work ? layout help first-time UX (local, not deployed)
- **Prominent green "Layout help"** button in spatial header (beside title) and canvas toolbars.
- **Dismissible getting-started banner** above the canvas until dismissed (localStorage).
- **Floating "Layout help" pill** bottom-right with "New? Start here" hint until first open.
- **Auto-opens quick-start guide** once on first visit (~900ms delay).
- **Quick-start help topic** + richer welcome header in the search dialog.

## Active work ? remove legacy join/merge and stage tools (local, not deployed)
- Removed **Merge / Unjoin** room controls from the layout editor toolbar and deleted join-plan handler wiring in `floor-plan-v2.tsx`.
- Removed **Stage** from draw tools (`CREATION_SHAPES`) and blocked new stage placement in `use-canvas-pointer.ts`.
- Updated layout editor help topics ? dropped join/unjoin guide and stage references.
- Legacy layouts may still contain stage objects or joined zones; rendering/hydration unchanged.

## Active work ? layout editor help search (local, not deployed)
- **`lib/floor-plan/layout-editor-help-content.ts`:** 19 searchable topics covering rooms, tools, vendors, patrons, optimize, view, save, and keyboard shortcuts.
- **`lib/floor-plan/search-layout-editor-help.ts`:** Token-based smart search with synonym keywords and category grouping.
- **`layout-editor-help.tsx`:** Help dialog with Sparkles search UI, topic list + step detail panel, `?` keyboard shortcut.
- **UI:** Help button on spatial layout toolbar (`/coordinator/events/{id}/layout`) and canvas utilities (command center + wizard floor plan).
- **Verify:** Open layout editor ? Help or `?` ? search "auto arrange", "join rooms", "save draft" ? matching topics with step-by-step instructions.

## Active work ? patron path density & cross-aisle (local, not deployed)
- **`lib/floor-plan/layout-density.ts`:** 4? ideal pedestrian aisles, 6? cross-aisle highways, density assessment, minimum room sizing, `shouldInjectCrossAisle`.
- **`deterministic-market-layout.ts` + `auto-arrange.ts`:** Grid generation skips cross-aisle bands; auto-arrange scales room W?L when density fails (probe via `maxDeterministicGridSlotCount`).
- **`PathfindingService.ts`:** Clearance-biased A* with strict?relaxed fallback; bottleneck booth ids for red canvas highlight.
- **`ai-auto-arrange.ts`:** Prompt requires cross-aisle + 4? aisles for dense halls.
- **UI:** Density toasts on grid auto-arrange; patron path partial route (orange); bottleneck booths tinted red when Patron Path is on.
- **Verify:** `npx tsx scripts/verify-layout-density-patron-path.ts` ? PASS.

## Active work ? layout route uses production editor (local, not deployed)
- **Root cause:** `/coordinator/events/[id]/layout` imported `SpatialLayoutEditor` from `src/qa_review/.../spatial-layout-editor_qa` (old FloorPlanV2 wizard QA build). Event overview ? Layout round-trip loaded that stale editor.
- **Fix:** `app/coordinator/events/[id]/layout/page.tsx` now imports from `@/components/coordinator/spatial-layout/spatial-layout-editor` (production FloorPlanV2).
- **Verify:** Layout page ? Event overview ? Layout ? same production spatial editor as command center / setup wizard.

## Active work ? toolbar row reorder (local, not deployed)
- **`toolbar-static-layout.ts`:** **DUAL-SCREEN** moved from tool strip to header row (`DASHBOARD_HEADER_SECTION_IDS`); tool strip order is **VENDOR BOOTHS** ? **PATRON TABLES** ? **SHAPES** ? **ALIGNMENT & SPACING**; shapes label dropped ?& BOOTHS?.
- **`canvas-toolbar-static.tsx`:** Restored `HeaderBarDualScreenCluster` in header portal (Presenter / Wall Cast + Full screen).
- **`canvas-command-bar-blocks.tsx`:** Full screen button renders in header dual-screen cluster when `headerBarLayout`.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? header row shows DUAL-SCREEN; tool strip order vendor ? patron ? shapes ? alignment.

## Active work ? test suite populate button (local, not deployed)
- **`persist-test-suite-applications.ts`:** Seeds diverse vendor suite as real auth users + passports + `booth_applications` with `approved` + paid (`CASH` / `COMPLETED`). Clears prior `@popuphub.seed` applications on the event before re-run.
- **API:** `POST /api/coordinator/events/[eventId]/seed-test-suite` ? coordinator-scoped; uses `createAdminClient()` for profile/passport writes (SSR service client still hit RLS). Set `DISABLE_COORDINATOR_TEST_SUITE=true` to block on a deploy.
- **UI:** Violet **Test suite** button in HubGrid **ALIGNMENT & SPACING** toolbar (Command center dashboard), plus event hub and Applications page headers. Also on spatial layout toolbar (`/coordinator/events/{id}/layout`) and setup Step 3 (`/coordinator/events/{id}/setup?step=3`).
- **Seed logic:** Fills up to **sum of category `max_slots`** (market capacity). Then **fills the live canvas room** from FloorPlanV2 dimensions, auto-arranges booths, and assigns approved vendors (paid). Not capped by stale `booth_layouts` DB dimensions.
- **Verify:** Command center ? **Test suite** ? toast reports grid placement (`N vendor booths placed`) or a clear warning if canvas not ready. Uses `populateTestSuiteCanvas` on the live floor-plan store (not toolbar callbacks).

## Active work ? CI lint fix (local, not deployed)
- **Root cause:** GitHub CI runs `npm run lint` before `npm run build`; `use-floor-plan-doc.ts` used `let nextDoc` where the variable is never reassigned ? `prefer-const` error (1 error, 435 warnings).
- **Fix:** `let nextDoc` ? `const nextDoc` in `updateRoomPerimeter()` (`components/coordinator/floor-plan-v2/state/use-floor-plan-doc.ts`).
- **Verify:** `npm run lint` exits 0; `npm run build` passes locally. Vercel production deploys were already succeeding ? failure was CI lint gate only.

## Active work ? manual layout orientation pattern (local, not deployed)
- **`booth-layout-engine.ts`:** `detectPlacedTableOrientationPattern` scans all orientable tables in the active room; when every booth shares the same table-length axis (horizontal E?W or vertical N?S), new placements inherit that axis regardless of row/column layout.
- **`table-placement-preview.ts`:** Unanimous pattern overrides perimeter snap and nearest-wall orientation for vendor booths and rectangular patron tables.
- **Verify:** `npx tsx scripts/verify-booth-row-orientation.ts` ? PASS. Dashboard ? place several booths at different positions but same rotation; ghost preview matches the established axis instead of snapping to the nearest wall.

## Active work ? map labels dropdown width (local, not deployed)
- **`canvas-command-bar-blocks.tsx`:** Map labels `<select>` widened from `max-w-[4.5rem]` / `max-w-[7.5rem]` to `w-[9.5rem]` so **Vendor name**, **Product category**, and **Booth ID / number** display without truncation.
- **Verify:** Coordinator dashboard ? HubGrid toolbar ? Map labels dropdown shows full option text for all three modes.

## Active work ? booth payment read-only in matrix (local, not deployed)
- **Rule:** Booths cannot be marked paid/unpaid from the floor-plan booth matrix. Payment is applicant-only (Applications board, offline confirm, Square/Stripe checkout); booth color/status reflects the assigned vendor's application.
- **Removed:** `MatrixStatusSelect` + `updateBoothPaymentStatus` + local `paymentOverrides` in `market-management-context.tsx`; `matrix_set_status` sync message.
- **Kept:** Vendor assignment via booth matrix `<select>`; VIP hold + offline **Mark applicant as paid** on telemetry desk (application API).
- **Verify:** Coordinator dashboard ? booth matrix Status column is read-only badge; assign vendor without changing payment; mark paid from Applications / telemetry desk only.

## Active work ? Square OAuth scope encoding fix (local, not deployed)
- **Root cause:** `formatSquareOAuthScopeParam` joined scopes with literal `+`, which `URLSearchParams` encoded as `%2B`. Square expects `+` as scope separators (or spaces); `%2B` yields a 400 and blank authorize page.
- **Fix:** Pass space-separated scopes to `URLSearchParams` so they encode as `+` per Square docs. Client validation rejects `%2B` in authorize URLs.
- **Verify:** Coordinator ? Payment Methods ? Connect with Square ? authorize URL contains `scope=MERCHANT_PROFILE_READ+PAYMENTS_WRITE+ORDERS_WRITE` (not `%2B`). Sandbox still requires an open Sandbox seller dashboard tab from Developer Console.

- **Root cause:** `POST /api/stripe/connect` returns 503 when `STRIPE_SECRET_KEY` is unset. Production Vercel env has Square keys but no `STRIPE_*` vars; local `.env.local` also lacks Stripe keys.
- **Fix:** `payment-settings` exposes `stripeConfigured`; Payment Methods page hides Connect Stripe button and wallet top-up when false, with operator-facing setup hint.
- **To enable Stripe:** Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env.local`, enable Connect (Express) in Stripe Dashboard, run `.\scripts\sync-vercel-env.ps1`, redeploy. Webhook endpoint: `https://popup-hub.vercel.app/api/stripe/webhook`.
- **Verify:** Without keys ? Payment Methods shows setup message, no toast on load. With keys ? Connect Stripe opens Stripe onboarding.

- **Manual checklist:** `docs/QA_FULL_WORKFLOW.md` ? coordinator/vendor/patron signup through publish, passport, apply, approve, assign, discovery (local + staging appendix).
- **Automated local:** `npm run qa:workflow` (seed ? RBAC ? Playwright workflow ? DB walkthrough); `npm run test:e2e:workflow` (browser only).
- **Staging HTTP smoke:** `npm run qa:workflow:staging` or `npm run verify:prod` with `PLAYWRIGHT_SMOKE_EVENT_ID`.
- **Seed:** `npm run seed:test-users` ? accounts + vendor passport + draft market ? `tests/e2e/workflow/.fixtures.json`.
- **Verify:** `npm run test:rbac-signup`; `npx tsx scripts/qa-full-workflow-walkthrough.ts` (needs Supabase env + optional local dev server for HTTP steps).

- **Root cause:** `pay-booth-modal.tsx` showed decorative HTML card fields that were not wired to Square, plus a separate Square iframe that failed to initialize (re-attach without destroy, missing location fallback).
- **Fix:** Single Square card input again; destroy/remount lifecycle on retry; `payment-config` resolves app id via `resolveSquareApplicationId()` and backfills `square_location_id` from Square API when missing.
- **Verify:** Vendor with approved unpaid booth ? open **Complete booth payment** ? Square card fields render in the modal; enter sandbox card ? Pay succeeds. Local dev may require `npm run dev:https` for Square SDK.

## Active work ? sticky site footer (local, not deployed)
- **`app/layout.tsx`:** `#site-layout-main` flex wrapper grows to fill viewport above `BuildVersionFooter`.
- **`app/globals.css`:** Remap legacy `min-h-screen` / `min-h-dvh` shells inside `#site-layout-main` to `flex-1` so they do not push the footer below the fold.
- **Layout shells:** Login, signup, shared/shopper/vendor layout chrome use `flex-1 min-h-0` instead of `min-h-screen`.
- **Verify:** Short pages (login, `/coordinator`, guest discover) ? build footer visible at bottom of viewport without scrolling; long pages ? footer still follows content after scroll.

## Active work ? polygon room reshape (local, not deployed)
- **`geometry/polygon-edit.ts`:** Pure helpers ? edge/vertex hit-testing, insert vertex on edge, translate ring, `isSimplePolygon` self-intersection guard, `syncFrameBoundsFromRing`, dual rect vs vertex handle mode (`isAxisAlignedRect`).
- **`state/use-floor-plan-doc.ts`:** `updateRoomPerimeter()` commits ring edits with undo; `moveRoomFrame()` now translates `perimeterRing`; rect resize re-syncs ring via `sanitizeRoomFrame`.
- **`interactions/use-canvas-pointer.ts`:** Vertex drag gesture (select tool); idle edge/vertex hover state; rAF-coalesced updates with snap (Shift = freeform).
- **`canvas/room-selection-overlay.tsx`:** Dashed ring outline; 8 corner handles for axis-aligned 4-vertex rects; vertex handles for non-rect / >4-vertex polygons; edge hover highlight.
- **`canvas/floor-plan-canvas.tsx`:** Cursor overrides (`crosshair` on edge, `grab` on vertex); double-click on room edge inserts vertex.
- **Data model:** Authoritative shape is existing `RoomFrame.perimeterRing` (`[x,y][]` in canvas feet); `widthFt`/`lengthFt` remain derived AABB cache. Default Main Hall still 50?50? via `frameToRing`.
- **Limitation:** Legacy save (`legacyRoomsFromDoc`) still writes AABB `venue_width`/`venue_length` only ? full polygon persists in `FloorPlanDoc` / local multi-room draft.
- **Verify:** `npx tsx components/coordinator/floor-plan-v2/geometry/polygon-edit.test.ts` ? PASS; `npx tsc --noEmit` ? PASS. Smoke: HubGrid ? select room ? drag vertex / double-click edge ? placement still respects polygon interior.

## Active work ? vendor apply event not found fix (local, not deployed)
- **Root cause:** `/api/vendor/apply` used an explicit `events` column list (including booth-contract fields from migration `105`) while the vendor detail page uses `VENDOR_EVENT_SELECT` (`*`). When optional columns are missing or the select fails, Supabase returns `data: null` and the route surfaced **Event not found** even for published markets.
- **Fix:** `VENDOR_APPLY_EVENT_SELECT` in `lib/queries/events.ts` (`*` + `event_days` + coordinator profile); apply route loads the event via service client, logs query errors, and returns **Could not load market details** on fetch failure.
- **Verify:** Open a published market ? Apply ? submit; should no longer toast **Event not found**. `npx tsc --noEmit` ? PASS.

## Active work ? apply dialog viewport fit (local, not deployed)
- **`components/events/apply-button.tsx`:** Apply dialog capped at `92dvh`, scrollable body, pinned submit footer; category list scrolls when long (`max-h-36`).
- **Verify:** Open Apply on a market with many passport categories + payment + contract ? dialog stays on screen at 100% zoom; submit button always visible.

## Active work ? automatic image compression for uploads (local, not deployed)
- **`lib/media/compress-image-for-upload.ts`:** Browser-side resize + re-encode (canvas) to keep JPEG/PNG/WebP under storage limits before upload.
- **Wired into:** passport story upload, market feed upload, flyer scan (`use-flyer-scan.ts`), feature-request screenshot picker.
- **Behavior:** Large phone photos are silently compressed; only fails if still over 5 MB after max shrink. PNG photos convert to JPEG for better compression.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: upload a 8?12 MB phone photo to passport story or market feed ? should publish without manual resizing.

## Active work ? MLM broad product category (local, not deployed)
- **`107_mlm_broad_category.sql`:** Adds **Multi Level Marketer (MLM)** as a broad (`is_broad=true`), MLM-flagged (`is_mlm=true`) vendor passport primary category.
- **Verify:** Apply migration `107`; vendor passport Step 2 shows the new bucket; coordinator wizard Step 2 lists it under Commercial / MLMs when MLM vendors are allowed.

## Active work ? vendor applied-market markers (local, not deployed)
- **`event-card.tsx` + `vendor-market-grid.tsx`:** Markets the vendor already applied to show an **Applied ? {status}** overlay badge and harvest ring on the card grid.
- **`apply-button.tsx` + `application-status-ui.ts`:** Block reapplication in UI (toast guard + terminal states for declined/cancelled/closed); 409 responses close the apply dialog.
- **`app/vendor/events/[id]/page.tsx`:** Pass `applicationId` to ApplyButton for follow-up actions.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: vendor with existing application ? `/vendor/events` card shows Applied badge + status action (no Apply Now); declined/cancelled markets show status link + ?Additional applications are not accepted.?

## Active work ? initial loader booth ring layout (local, not deployed)
- **`components/brand/initial-loader-reveal.tsx`:** Top row shifted one booth cell right; side columns trimmed to alternating tiles (left keeps 1st/3rd/5th, right keeps 2nd/4th/6th) for 3?3 symmetry with top/bottom rows.
- **Verify:** Reload app ? initial loader shows 3 booths per side, top row offset right of bottom row.

## Active work ? coordinator login home (local, not deployed)
- **`app/coordinator/page.tsx` + `components/coordinator/coordinator-home.tsx`:** Post-login coordinator landing with **Create a new market** and **View your markets** cards.
- **Redirects:** `getPortalHome('coordinator')`, `resolvePostLoginPath`, `accessDeniedRedirect`, dev mock login ? `/coordinator`.
- **Nav:** Coordinator **Home** link in app nav + workspace rail; command center stays at `/coordinator/dashboard`.
- **Verify:** `npx tsx scripts/verify-document-scroll-routes.ts` ? PASS. Smoke: sign in as coordinator ? `/coordinator` with both CTAs; **View your markets** ? command center.

## Active work ? dual-path coordinator community vouches (local, not deployed)
- **`106_coordinator_peer_vouches.sql`:** New `coordinator_peer_vouches` table (community-verified organizer ? organizer).
- **`lib/coordinator/escrow-policy.ts`:** `REQUIRED_VENDOR_VOUCHES = 10`, `REQUIRED_COORDINATOR_VOUCHES = 3`; dual OR logic; removed business-number escrow bypass.
- **`lib/coordinator/vouch.ts`:** Peer vouch eligibility + shared paid-vendor gate; `maybeMarkCommunityVerifiedFromVouches`.
- **`app/api/coordinator/peer-vouch/route.ts`:** POST peer vouch for organizers.
- **UI:** Dual progress bars in `coordinator-community-trust.tsx`; peer vouch button on `/coordinators/[id]`; FAQ + verification banner copy de-emphasizes tax ID.
- **Verify:** `npx tsx scripts/verify-coordinator-escrow.ts` ? PASS; `npx tsx scripts/verify-coordinator-verification.ts` ? PASS. Apply migration `106` before smoke-testing vouches in dev.

## Active work ? digital booth contracts (local, not deployed)
- **`105_event_booth_contracts.sql`:** `events.booth_contract_*` columns; `booth_applications.booth_contract_acknowledged_at` + `booth_contract_snapshot`; `event-assets` bucket with PDF support.
- **`lib/legal/booth-contract-templates.ts` + `lib/booth-contract/resolve-event-contract.ts`:** Platform default clauses (payment, refund, teardown, conduct, insurance, attendance); resolve/hash/snapshot helpers.
- **`components/coordinator/booth-contract-editor.tsx`:** Clause toggles, custom clauses, PDF upload, save, **Suggest an enhancement** ? feature request prefill.
- **Wizard / event form / autosave:** Wired into `wizard-step-event-details`, `market-setup-wizard`, `event-form`, `wizard-autosave`; readiness checklist item **Booth contract reviewed**.
- **Vendor apply:** `apply-button.tsx` shows contract + acknowledgment; `app/api/vendor/apply/route.ts` validates and stores snapshot.
- **Coordinator review:** `vendor-review-drawer.tsx` shows contract accepted timestamp + PDF link.
- **Feature requests:** `booth_contracts` target component; `FeatureRequestContext.openWithPrefill`.
- **Verify:** `npx tsc --noEmit` ? PASS; `npx tsx scripts/verify-booth-contracts.ts` ? PASS. Smoke: coordinator wizard Step 1 ? edit/save contract; vendor apply dialog shows clauses; suggest enhancement opens prefilled modal.

## Active work ? vendor apply map, passport routing, logo, billing inputs (local, not deployed)
- **`vendor-market-grid.tsx`:** List/Map toggle on **Apply for open markets** with `EventMap` + radius filter (matches Discover UX).
- **`vendor-event-venue-map.tsx` + `app/vendor/events/[id]/page.tsx`:** Google map for market coordinates on vendor apply detail; floor plan preview via `MarketApplicationLayoutView` when layout cells exist.
- **`app/vendor/dashboard/page.tsx`:** Incomplete passport CTA ? `/vendor/passport` (not `/profile/passport`).
- **`coordinator-passport-extras.tsx` + `passport-page-view.tsx`:** Coordinator passport at `/profile/passport` adds org name / business number / payment links; vendor wizard stays on `/vendor/passport` only.
- **`popup-hub-logo.tsx` / nav headers / `vendor-logo.tsx` / `brand-mark.tsx`:** Larger wordmark in nav; ~6% padding in white logo frames so marks fill the box.
- **`app/api/coordinator/payment-settings/route.ts`:** E-Transfer email + vendor instructions savable without payment-trust gate; trust check only when turning on acceptance flags.
- **`passport-wizard.tsx`:** Removed business/tax number and EIN step; wizard is now Business Info ? Category ? Photos (social handle only for identity).
- **`coordinator-passport-extras.tsx` + `coordinator-verification-banner.tsx` + verification API:** Organization name only ? no business registration field.
- **`lib/vendor/verification.ts`:** Applying to markets requires social handle only; business number no longer blocks apply.
- **UI cleanup:** Removed tax ID from apply preview and coordinator vendor review drawer.

## Active work ? dual-screen toolbar consolidation (local, not deployed)
- **`toolbar-static-layout.ts`:** Removed duplicate **DUAL-SCREEN** from header row (`DASHBOARD_HEADER_SECTION_IDS`); section lives only in the top tool strip.
- **`canvas-command-bar-blocks.tsx`:** **Full screen** labeled button moved into tool-strip **DUAL-SCREEN** cluster beside Presenter / Wall Cast; all three use light-green full labels (`border-emerald-300 bg-emerald-50`); fullscreen icon removed from header view/setup cluster.
- **`canvas-toolbar-static.tsx`:** Removed unused `HeaderBarDualScreenCluster`.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? header has no DUAL-SCREEN block; tool strip **DUAL-SCREEN** shows Presenter, Wall Cast, and Full screen with light-green styling.

## Active work ? dual-screen toolbar + room-scoped canvas bounds (local, not deployed)
- **`canvas-toolbar-static.tsx`:** `HeaderBarDualScreenCluster` restores visible **DUAL-SCREEN** section header with **Presenter** / **Wall Cast** buttons stacked beneath; header row uses `items-stretch` + `overflow-y-visible` so controls are not clipped.
- **`canvas-command-bar-blocks.tsx`:** Dual-screen block always renders labeled buttons (no icon-only header mode).
- **`toolbar-static-layout.ts`:** Dual-screen section also appears in the top tool strip for sidebar-style section layout.
- **`globals.css`:** Header toolbar portal + command-center header allow vertical overflow; dual-screen cluster min-width guard.
- **`floor-plan-canvas.tsx`:** Command-center scroll wrapper (`panContentRef`) sizes to the active room grid footprint (e.g. 74?74 ft) instead of the full 5? doc canvas ? SVG clips via offset + `overflow:hidden`; pointer origin follows room origin.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? **DUAL-SCREEN** shows Presenter + Wall Cast under header; canvas pan/zoom has no dead scroll beyond room walls.

## Active work ? room overlap boolean union (local, not deployed)
- **`state/room-joins.ts`:** `buildAutoUnionZones()` + `hitTestRoomStroke()` ? polygon-clipping union for overlap/touch room groups without explicit `joinGroupId`; interior walls dissolved to one outer perimeter.
- **`canvas/room-frames.tsx`:** Auto-union zones render merged perimeter strokes; member rooms suppress individual box walls.
- **`interactions/geometry.ts`:** `pointHitsFrameStroke` uses visible edge segments (not full AABB); `pointDistanceToSegment` for accurate wall hit-testing.
- **`interactions/use-canvas-pointer.ts`:** Room drag/select uses `hitTestRoomStroke` so hidden interior walls are not grabbable.
- **Verify:** `npx tsx scripts/verify-room-joins.ts` ? PASS (scenario 8: partial overlap). Smoke: overlap Room 2 into Main Hall ? no interior cross walls; single continuous outer perimeter.

## Active work ? middle-button pan GPU preview (local, not deployed)
- **`use-viewport.ts` / `floor-plan-canvas.tsx`:** Middle-mouse pan tracks live delta in refs; `requestAnimationFrame` applies `translate3d` on `panContentRef` during drag; scroll position commits on pointer-up only (space-drag / touch hand pan still use scroll).
- **Verify:** Command center floor plan ? middle-drag feels fluid (no per-move React scroll); release snaps scroll to final position; grid stays aligned after release.

## Active work ? Step 2 venue inputs + canvas viewport + strict arrange (local, not deployed)
- **`smart-populate-booth-caps.tsx`:** Venue width/length always visible; **Manual entry** toggle unlocks editable fields (draft string state); auto mode shows template dims disabled when preset-anchored.
- **`wizard-step-capacity.tsx` / `market-setup-wizard.tsx`:** Wired `onVenueWidthChange` / `onVenueLengthChange` to room state; `step2VenueWidth/Length` respects manual override vs template anchor.
- **`use-viewport.ts` / `floor-plan-canvas.tsx`:** Pan clamp keeps room grid partially on-screen; **100%** uses `resetViewport()`; fullscreen enter recenters; initial load uses `fitViewportToContent` with 40px safe zone.
- **`auto-arrange.ts` / `wizard-initial-layout.ts`:** `dropUnplacedBooths` omits booths that violate spacing; 5? perimeter (`PERIMETER_WALL_CLEARANCE_FT`); door/exit obstacles expanded; seed count capped via `maxDeterministicGridSlotCount`.
- **`floor-plan-canvas.tsx`:** **Arrange layout** uses `autoArrangeInRoom` grid mode (not shelf-pack); placed vendor count drives Step 3 validation.
- **Verify:** `npx tsx scripts/verify-wizard-initial-layout.ts` ? PASS. Smoke: Step 2 toggle Manual entry ? edit 74?74; Step 3 grid centered; middle-drag cannot lose grid; Arrange layout omits overflow booths.

## Active work ? wizard Step 3 auto seed + grid pack (local, not deployed)
- **`lib/floor-plan/wizard-initial-layout.ts`:** Builds generic vendor booths from Step 2 category caps (round-robin, clamped to `layoutCapacity`) and runs `autoArrangeInRoom` grid mode top-left inside Main Hall.
- **`floor-plan-v2.tsx`:** One-time wizard initial layout on blank canvas; forwards `configuredCategorySlots`.
- **`market-setup-wizard.tsx`:** Auto-adds Main Hall at Step 1 venue dimensions on Step 3 entry; switched import to production `wizard-step-floor-plan` (was QA mirror).
- **`wizard-step-floor-plan.tsx`:** Gates **Save market** until vendor booths are placed when caps exist.
- **Verify:** `npx tsx scripts/verify-wizard-initial-layout.ts` ? PASS (7/7 in 74?74). Smoke: `/coordinator/events/new` ? Step 2 caps ? Step 3 ? booths appear in grid; Save market enables.
- **Build fix:** `booth-clearance-visual.ts` ? spread `objects`/`rooms` when building `VendorCollisionContext` (readonly ? mutable); unblocks `next build` TS check.

## Active work ? wizard Step 2 single-column layout (local, not deployed)
- **`wizard-step-capacity.tsx`:** Capacity & pricing step ? **Physical & pricing setup** and **Inventory & category limits** stacked in a centered single column (`flex flex-col items-center w-full`); each `WizardZone` uses `w-full max-w-4xl mx-auto`. Quarter-auction copy updated ("below" vs "on the right").
- **Verify:** `/coordinator/events/new` ? Step 2 ? both cards centered, full width up to `max-w-4xl`, physical/pricing card above inventory/limits.

## Active work ? publish blocked by server Geocoding key (local, not deployed)
- **Root cause:** Publish runs server-side venue verification via Geocoding REST API (`verify-venue-coordinates.ts`). Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) has **Website** referrer restrictions ? Vercel server requests have no matching referer ? Google returns *"This API key is not authorized?"* and publish fails.
- **Fix (GCP + Vercel):** Create a **second** API key: Application restrictions = **None** (or IP, not Websites); API restrictions = **Geocoding API** only. Set `GOOGLE_MAPS_SERVER_API_KEY` on Vercel production (+ preview), redeploy. Keep existing browser key for maps/Places with website restrictions unchanged.
- **Code:** `verify-venue-coordinates.ts` now falls back to `GOOGLE_MAPS_API_KEY` (already on Vercel but was unused); clearer error when key has browser-only restrictions. `sync-vercel-env.ps1` + `PRODUCTION_NEXT_STEPS.md` document the two-key setup.
- **Verify:** After server key + redeploy ? draft market ? Pre-Flight Review ? Publish succeeds (no Google authorization toast).

## Shipped this session (deploy script auto-handoff, deployed 2026-06-12)
- **`scripts/get-deploy-commit-message.ps1`:** Commit message from Shipped sections ? Active work sections ? `feat: ship local changes`; UTF-8 handoff read; fix empty-array return that blocked deploy.
- **`scripts/deploy-popuphub.ps1`:** Deploy proceeds when uncommitted work exists (no manual Shipped section rename); clean tree with nothing undeployed ? no-op only.
- **`scripts/update-session-handoff.ps1` / `ship.ps1`:** Active work sections used for deploy flip to Shipped deployed after release.

## Shipped this session (Google OAuth PKCE callback fix, deployed 2026-06-12)
- **`lib/supabase/client.ts`:** `detectSessionInUrl: false` ? OAuth codes exchange only on the server at `/api/auth/callback` (avoids client/server race on `?code=`).
- **`app/api/auth/callback/route.ts`:** Read PKCE verifier from `request.cookies`; attach session `Set-Cookie` headers directly on the redirect response (Next.js 15+ does not always propagate `cookies().set` onto redirects).
- **`lib/supabase/middleware.ts`:** Skip session refresh on `/api/auth/callback` so middleware does not touch cookies before the code exchange.
- **Verify:** `/login` ? Continue with Google ? lands signed in (no ?PKCE code verifier not found? on `/login?error=auth_callback_failed`). Repeat after sign-out. If it still fails on a preview URL, add that origin to Supabase Auth redirect URLs.

## Active work ? booth validation: physical overlap vs boundary warnings (local, not deployed)
- **`interactions/geometry.ts`:** `physicalOverlapProbesForObject` ? overlap validation uses each booth's stored W?H only (no sub-table probe splits, no 3? padding). `placedObjectsClearanceOverlap` unchanged for intentional aisle-buffer gates.
- **`booth-clearance-visual.ts`:** `minVendorBoothBoundaryClearanceFt` + `vendorBoothBoundaryWarningBand` ? yellow/red only for walls/fixtures; perimeter-snapped rear wall excluded; vendor-vendor spacing not tinted.
- **`canvas-objects.tsx`:** Red = physical intersection only; clearance toggle applies boundary bands when not `good`.
- **`engine/auto-arrange.ts`:** `packVendorBoothsInRoomGrid` row-packs selected/unplaced vendor booths in the active room with snap + exact W?H collision; `placeBoothsAtSlots` uses physical overlap only.
- **`canvas/floor-plan-canvas.tsx`:** **Arrange layout** floating action triggers `packVendorBoothsInRoomGrid`.
- **Root cause:** Sub-table probes + clearance-expanded overlap checks flagged staggered rows as red; aisle-gap coloring treated neighbour spacing as yellow even with clear separation.
- **Verify:** `npx tsx scripts/verify-object-overlaps.ts` ? PASS (incl. table-cluster case). `npx tsx scripts/verify-booth-clearance-visual.ts` ? PASS. Grid rows ? no false red; yellow only on real wall/fixture conflicts; **Arrange layout** packs Main Hall cleanly.

## Active work ? middle-mouse grid pan (local, not deployed)
- **`use-viewport.ts` / `use-canvas-pan-zoom.ts`:** Middle-button pan starts in pointer capture phase (before SVG/grid handlers), calls `preventDefault` + `stopPropagation`, and blocks browser autoscroll on `mousedown`/`auxclick`.
- **`floor-plan-canvas.tsx`:** SVG pointer handler skips non-primary mouse buttons so dashboard grid pan is not swallowed.
- **`virtualized-layout-canvas.tsx` / `svg-layout-canvas.tsx`:** Wired `useCanvasPanZoom` on large 8? grids; grab/grabbing cursor + hint copy.
- **Verify:** `/coordinator/dashboard` and booth planner ? middle-drag pans the grid; cursor shows grab/grabbing; no autoscroll icon.

## Active work ? floor plan canvas tight grid sizing (local, not deployed)
- **`floor-plan-canvas.tsx`:** `tightToGrid` mode (`commandCenterViewport` or `scrollHost=false`) drops infinite `padFt`; outer wrapper is `h-auto` when content-sized; embedded wizard clips to active room grid (`widthFt ? lengthFt`) with overflow hidden; pointer mapping uses clip viewport + `surfaceOriginFt`.
- **`use-viewport.ts`:** `fitToBounds` supports `fillMode: 'cover'` for command-center framing (fills height, no top/bottom letterboxing on wide rooms).
- **`floor-plan-v2.tsx` + `globals.css`:** Embedded wizard host uses `floor-plan-canvas-host--content-sized` (`h-auto`, no `absolute inset-0` stretch).
- **`use-canvas-pointer.ts` / `geometry.ts`:** Optional `clipViewportRef` + `surfaceOriginFt` on `ViewportTransform` for clipped content-sized canvas.
- **Verify:** `/coordinator/dashboard` ? grid fills canvas column edge-to-edge vertically on wide rooms. `/coordinator/events/new` Step 3 (embedded) ? canvas wrapper height matches room grid with no stone dead space above/below.

## Active work ? wizard step scroll-to-top (local, not deployed)
- **`lib/wizard/wizard-scroll-anchor.ts`:** Reset `.setup-wizard-body`, `#site-main`, and window on step change (setup pages scroll inside the body shell, not the window). Removed step-3 `scrollIntoView` to floor plan ? always land at page top.
- **`market-setup-wizard.tsx`:** `useEffect` on `currentStep` calls `resetWizardScrollAnchor` so reactive step changes (skip layout, missing event id) also scroll to top.
- **Verify:** `/coordinator/events/new` ? scroll down on Step 1, click Proceed ? Step 2 opens at top; repeat Step 2 ? Step 3; Back also resets scroll.

## Active work ? wizard venue template sync on venue pick (local, not deployed)
- **`lib/booth-planner/edmonton-venue-registry.ts`:** `matchEdmontonVenuePreset()` ? match Places/saved picks to Edmonton hall templates by coordinates (~200 m), street address, or venue name.
- **`components/coordinator/market-setup-wizard.tsx`:** `syncVenueTemplateFromSelection()` updates the Venue Template dropdown + room preset when a venue is picked from autocomplete, saved-venue chips, or geocode ? without overwriting the selected address/pin. Template dropdown still loads full location when chosen directly.
- **`scripts/verify-edmonton-venue-match.ts`:** PASS (name, address, coords, unknown venue).
- **Verify:** `/coordinator/events/new` ? search and click ?Kilkenny Community League? in venue name ? Venue Template switches to Kilkenny; pick a non-registry venue ? template resets to Blank; pick a saved venue chip ? template follows stored/matched hall.

## Active work ? booth 3? safety buffer + pathfinding aisle routing (local, not deployed)
- **`lib/booth-planner/layout-clearance-constants.ts`:** `BOOTH_SAFETY_BUFFER_FT = 3.0` per side; `BOOTH_PAIR_MIN_EDGE_GAP_FT = 6.0` between physical borders; grid pitch `BOOTH_CORE_SEPARATION_CELLS = 6`.
- **`lib/booth-planner/expanded-footprint.ts`:** Removed back-to-back clearance bypass; `validateBoothPlacementCoordinate` rejects any expanded-footprint intersection (3? buffer each booth).
- **`lib/floor-plan/deterministic-market-layout.ts`:** `BACK_TO_BACK_ROW_GAP_FT = 6?`; grid/stagger/perimeter slot loops use hard safety-barrier validator before accepting coordinates.
- **`auto-arrange.ts`:** All vendor slot acceptance via `validateBoothAgainstPlaced`; `validateClearances` checks expanded footprints for vendor pairs; grid passes `tableEdgeGapFt: 6?`.
- **`engine/PathfindingService.ts`:** Navigation grid marks each booth footprint + 3? buffer as impassable (`MIN_CLEARANCE_FT`); paths route through green aisle bands only.
- **Root cause:** Grid layout used `BACK_TO_BACK_ROW_GAP_FT = 0` and 1.5? collision probes ? booths packed flush back-to-back and A* cut through vendor squares.
- **Verify:** `verify-vendor-booth-clearance.ts` ? PASS. `verify-auto-arrange.ts` ? 31/31. `verify-layout-pathfind.ts` ? PASS (path stays in aisles). Smoke: auto-arrange grid room ? no red clearance warnings on back-to-back pairs; patron path overlay avoids booth interiors.

## Active work ? patron pathfinding booth obstacle grid (local, not deployed)
- **`engine/PathfindingService.ts`:** `buildNavigationGrid` now explicitly blocks every active layout booth (via `collectLayoutObstacles` + optional `booths` override); uses `objectFootprintAabb` for compound table clusters; two-pass carve (strict footprint, then `BOOTH_SAFETY_BUFFER_FT` aisle clearance) plus corner pinch guard; A* reads final `walkable[][]` so blocked cells drop graph edges implicitly.
- **Root cause:** Grid obstacle pass used raw `rotatedAabb` and only `objectsInRoom` impassables ? paths could clip through booth/table footprints not fully represented on the walkability grid.
- **Verify:** `npx tsc --noEmit` ? PASS. `npx tsx scripts/verify-layout-pathfind.ts` ? PASS. Smoke: `/coordinator/dashboard` ? enable patron path overlay on a packed room; dashed path stays in green aisle bands and does not cut through booth rects.

## Active work ? booth clearance coordinator warnings + toggle (local, not deployed)
- **`lib/coordinator/booth-clearance-summary.ts` (new):** Per-doc clearance issue rollup + explanatory copy (yellow 3??4?, red <3? / ?2? critical).
- **`lib/coordinator/booth-clearance-warnings-pref.ts` (new):** `localStorage` preference for clearance warning overlay (default on).
- **`components/coordinator/booth-clearance-warning-panel.tsx` (new):** Legend-rail alert listing affected booths and how to disable warnings.
- **`canvas-legend.tsx`:** Embeds warning panel when issues exist; legend copy clarifies ?2? critical red band.
- **`floor-plan-v2.tsx`:** Toggle state, one-time toast when issues appear, passes `showClearanceWarnings` to canvas + toolbar.
- **`canvas-command-bar-blocks.tsx` / `canvas-command-bar.tsx`:** Header triangle toggle (amber when on) beside patron flow.
- **`canvas-objects.tsx` / `floor-plan-canvas.tsx`:** Yellow/red vendor booth tints gated by toggle.
- **`dashboard-next-step-cta.tsx`:** Clearer blocked-step copy referencing color bands.
- **Verify:** `npx tsc --noEmit` ? pre-existing duplicate import in `auto-arrange.ts` only. Smoke: `/coordinator/dashboard` ? place booths <4? apart ? yellow/red tints + legend alert; click triangle in header ? tints and alert hide (preference persists).

## Active work ? perimeter + grid hard clearance validator (local, not deployed)
- **`lib/booth-planner/expanded-footprint.ts`:** Central `validateBoothPlacementCoordinate` / `validateBoothAgainstPlaced` ? 3? wall inset, expanded footprint (width+6, length+6), back-to-back grid exception.
- **`lib/booth-planner/layout-clearance-constants.ts`:** `MIN_CLEARANCE_FT = 3.0` (canonical).
- **`auto-arrange.ts`:** All vendor slot acceptance uses expanded-footprint validator; grid `tableEdgeGapFt` = 6?; staging scan uses `perimeterStepFt`; `validateClearances` aligns vendor walls to 3?.
- **`deterministic-market-layout.ts`:** Grid/perimeter slot loops use validator + 6? column pitch for vendors (`VENDOR_TABLE_EDGE_GAP_FT`); patron tables keep 2? default gap.
- **`ai-auto-arrange.ts`:** AI prompt + `applyAiPlacementsToBooths` reject coordinates that fail the hard constraint.
- **Verify:** `verify-deterministic-market-layout.ts` 10/10; `verify-auto-arrange.ts` 31/31.

## Shipped this session (sitemap build fix, deployed 2026-06-11)
- **`lib/supabase/public.ts`:** Added `hasPublicSupabaseConfig()` helper.
- **`lib/seo/collect-sitemap-entries.ts`:** Return static sitemap entries when `NEXT_PUBLIC_SUPABASE_*` is missing at build time ? fixes Vercel preview `npm run build` failure on `/sitemap.xml`.
- **Root cause:** Preview deployments lack Supabase env during static prerender; `createPublicSupabaseClient()` threw and aborted the build.
- **Verify:** `npm run build` without `.env.local` ? PASS (sitemap.xml prerenders with static URLs only).

## Active work ? dashboard header uniform button sizing (local, not deployed)
- **`globals.css`:** Header row controls (tabs, pill toggle, toolbar buttons) normalized to `--dashboard-toolbar-height`; `overflow-x: hidden` on command-center header.
- **`dashboard-command-center-header.tsx`:** Tighter header gaps.
- **`command-center-exit-link.tsx`:** Compact+prominent exit link matches toolbar height (`h-7`).
- **`canvas-toolbar-static.tsx`:** Dual-screen cluster inline (no section label stack); tighter portal gaps.
- **`canvas-command-bar-blocks.tsx`:** Header-specific compact view/setup (icon fullscreen, narrow map labels, square zoom); dual-screen icon-only; hall history undo/redo only; room rotate/join hidden in header.
- **`layout-room-bar.tsx`:** `headerBar` mode ? inline W/L fields, truncated room tabs, no horizontal scroll.
- **`command-button.tsx`:** Toolbar icon/control heights use `--dashboard-toolbar-height`.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? HubGrid header row fits without horizontal scrollbar; all controls same height.

## Active work ? canvas delete INP / deferred pathfinding (local, not deployed)
- **`hooks/use-pathfinding.ts`:** Replaced synchronous `useMemo` + `CalculateOptimalPath` with `useDeferredValue` + `setTimeout(0)` + `startTransition` so booth delete paints before A*/TSP runs.
- **`hooks/use-patron-aisle-overlay.ts` (new):** Same deferral pattern for patron aisle corridor overlay.
- **`floor-plan-v2.tsx`:** `handleDeleteSelected` keeps `store.removeObjects` urgent (outside transition); locked-fixture toast deferred via `startTransition`.
- **Root cause:** Patron path overlay (`usePathfinding`) ran heavy grid pathfinding synchronously during the same render pass as `removeObjects`, blocking INP ~2s when path overlay enabled.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? enable patron path overlay, delete a booth ? element disappears immediately; path overlay refreshes shortly after without UI freeze.

## Active work ? dashboard header Event setup + Dual-Screen section (local, not deployed)
- **`dashboard-command-center-header.tsx`:** ? Event setup exit link moved to the main header row (left of workspace tabs), using `CommandCenterExitLink` + `useMarketManagement`.
- **`toolbar-static-layout.ts` / `canvas-toolbar-static.tsx`:** New header section **DUAL-SCREEN** with grouped **Presenter** + **Wall Cast** buttons (`HeaderBarDualScreenCluster`); view/setup cluster keeps fullscreen, map labels, patron path, zoom, save.
- **`canvas-command-bar-blocks.tsx` / `toolbar-order.ts`:** New `dual-screen` toolbar block; removed duplicate Event setup + prefixed dual-screen buttons from utilities strip; dropped generic **Launch Dual-Screen Mode** in favor of paired Presenter/Wall Cast controls.
- **`globals.css`:** `.dashboard-header-dual-screen` min-width guard.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? header row shows ? Event setup | HubGrid | Allocation Ledger | view/setup tools | **DUAL-SCREEN** (Presenter + Wall Cast grouped) | hall management; no standalone Launch Dual-Screen button.

## Active work ? vendor/patron size chips only highlight when armed (local, not deployed)
- **`table-size-pill.tsx`:** Vendor and patron size buttons no longer show forest/violet active fill from the default placement template alone; chips highlight only when the corresponding draw tool is armed (`vendorPlacementActive`, `roundPlacementActive`, `rectPlacementActive` / `placementActive`).
- **`canvas-command-bar-blocks.tsx`:** Passes `isTablePlacementActive(...)` into `TableSizePill` and `VendorSidebarSizeGrid`.
- **Root cause:** `defaultPlacementSpec` always seeds vendor 6? for draw math, so the 6? chip appeared selected even in Select mode.
- **Verify:** `npx tsx scripts/verify-table-size-default.ts` ? PASS. Smoke: `/coordinator/dashboard` ? on load / Select tool, vendor 6? (and other sizes) stay neutral white; click vendor draw square ? matching size lights forest green; switch to Select ? sizes dim again.

## Active work ? door wall snap (long edge, no booth rules) (local, not deployed)
- **`structural-wall-snap.ts`:** Doors/exits snap flush to nearest room wall with **long edge along the wall** (`orientLongEdgeAlongWall` + rotation 0? horizontal / 90? vertical); default 3?1 ft footprint; live drag uses `structuralLayoutMovePatch` (not booth grid/clamp).
- **`is-point-in-room.ts`:** Doors skip booth interior-centroid and strict boundary validation; nearest-room resolution via `findRoomIdForStructuralPlacement`.
- **`use-canvas-pointer.ts` / `table-placement-preview.ts`:** Tap/draw/hover preview wall-snaps doors; draw commit propagates snapped width/height/rotation.
- **`scripts/verify-structural-wall-snap.ts`:** Horizontal + vertical long-edge orientation + placement regression.
- **Verify:** `npx tsx scripts/verify-structural-wall-snap.ts` ? PASS. Smoke: `/coordinator/dashboard` ? draw Door near each wall; long edge runs along wall; move door ? stays wall-snapped; no booth clearance bands on doors.

## Active work ? HubGrid preview fullscreen (local, not deployed)
- **`command-center-fullscreen-context.tsx`:** Preview mode enters native fullscreen (`command-center-canvas-fullscreen` + browser FS); Esc exits preview; `data-dashboard-preview` on `<html>`.
- **`dashboard-command-center-header.tsx`:** Restored Edit/Preview pill toggle ? preview shows only the toggle (fixed top-right overlay).
- **`floor-plan-v2.tsx` / `floor-plan-canvas.tsx`:** `viewOnly` disables draw/select/drop/keyboard edits; pan/zoom still works.
- **`globals.css`:** Preview hides tool strip, footer, verification banner, side rails; canvas fills viewport.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? flip Preview ? fullscreen canvas, no tools/rails; flip Edit or Esc ? restore editing chrome.

## Active work ? main hall grid sizing + food truck wall collision (local, not deployed)
- **`layout-room-bar.tsx`:** Editable Width/Length (ft) fields for the highlighted room (Main Hall) in the hall-management toolbar; commits via `onPatchRoomDimensions`.
- **`floor-plan-v2.tsx` / `use-floor-plan-doc.ts`:** `handlePatchRoomDimensions` resizes the room frame and syncs wizard `venue_width`/`venue_length`; `readDoc()` for immediate post-resize sync.
- **`floor-plan-canvas.tsx`:** Placement grid is drawn at the active/selected room frame (size + origin), so editing Main Hall resizes the visible grid.
- **`canvas-open-placement.ts` / `use-canvas-pointer.ts`:** Food trucks rejected when overlapping solid `wall` objects (draw, tap-place, and drag-drop revert).
- **`scripts/verify-food-truck-placement.ts`:** Wall overlap regression cases.
- **Verify:** `npx tsx scripts/verify-food-truck-placement.ts` ? PASS; `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? edit Main Hall W/L in header; grid matches; food truck cannot sit on a wall.

## Active work ? table size units sync across size grids (local, not deployed)
- **`table-size-units.tsx`:** `useTableSizeUnits` broadcasts changes via custom event so all toolbars stay in sync; added `formatDimensionDisplay` / `formatFootprintDisplay` helpers.
- **`table-size-pill.tsx` / `table-size-selector.tsx`:** Patron table size chips now respect ft/m toggle (were hardcoded `6?`, etc.).
- **`layout-room-bar.tsx` / `object-resize.ts` / `floor-plan-v2.tsx`:** Room metrics badge and selection dimension chip follow the active unit preference.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? toggle ft/m on vendor sizes; patron table chips, room dimensions, and selection metrics all switch units together.

## Active work ? notification bell dot when caught up (local, not deployed)
- **`components/nav/app-nav.tsx`:** Removed amber placeholder dot on the bell when `unreadCount === 0`; badge only when unread notifications exist (matches notifications page ?You're all caught up?).

## Active work ? canvas legend/ledger matching side rails (local, not deployed)
- **`canvas-side-rail.tsx`:** Shared 200px body + 28px tab side-rail shell for legend and ledger popouts.
- **`canvas-legend.tsx` / `canvas-ledger.tsx`:** Both use flex side rails inside the canvas host (no absolute overlay); canvas grid sits between them and no longer sits under the panels.
- **`floor-plan-v2.tsx`:** Dashboard canvas host is `flex-row` ? legend | canvas | ledger.
- **`dashboard-split-workspace.tsx`:** Removed 35% ledger column; ledger moved into canvas right rail.
- **`booth-matrix-panel.tsx`:** New `docked` variant ? compact scroll cards for 200px rail.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` (? lg) ? legend + ledger same width; expand/collapse each rail; floor plan does not render under either panel.

## Active work ? booth clearance preview + 3? yellow band (local, not deployed)
- **`lib/coordinator/booth-clearance-visual.ts`:** `clearanceBand` uses `BOOTH_CLEARANCE_TIGHT_FT` (3?) ? red below 3?, yellow at ?3? and <4?, green at ?4?; added `vendorBoothClearanceThemeForProbe` for draw/hover preview.
- **`floor-plan-canvas.tsx` / `canvas-overlays.tsx`:** Vendor booth draw drag, tap-to-place ghost, and cursor hover preview show clearance band colours before commit; overlap still wins (red violation); guest/patron previews stay sky-blue.
- **`UnifiedLayoutSolver.ts`:** Reuses shared `clearanceBand`.
- **`canvas-legend.tsx`:** Critical legend updated to `<3?`; tight remains `?3? and <4?`.
- **`scripts/verify-booth-clearance-visual.ts`:** Band thresholds + 3? preview-probe regression.
- **Verify:** `npx tsx scripts/verify-booth-clearance-visual.ts` ? PASS. Smoke: `/coordinator/dashboard` ? draw vendor booth near neighbor ? preview turns red below 3?, yellow at 3??4?, green at ?4? before click; overlap still red.

## Active work ? booth clearance diagonal distance fix (local, not deployed)
- **`lib/coordinator/booth-clearance-visual.ts`:** `edgeClearanceBetweenRects` computes true diagonal corner gaps.
- **`canvas-objects.tsx`:** Patron/guest tables use `isGuestTableBooth` (purple dashed, no vendor clearance bands).
- **`scripts/verify-booth-clearance-visual.ts`:** Regression tests for diagonal separation and scatter layout.

## Active work ? dashboard header trim (local, not deployed)
- **`dashboard-command-center-header.tsx`:** Edit/Preview toggle restored at header right (HubGrid only); workspace tabs + portaled room/canvas toolbar use `overflow-hidden` (no horizontal scrollbar). +New market removed from header row.
- **`canvas-command-bar.tsx` / `canvas-toolbar-static.tsx` / `globals.css`:** Header bar layout no longer scrolls horizontally.

## Shipped this session (dashboard and floor-plan editor polish, deployed 2026-06-11)
- **Header row:** Uniform `--dashboard-toolbar-height` on tabs, Event setup, view/setup, dual-screen, hall management, Edit/Preview; compact icon controls; no horizontal scrollbar (`globals.css`, `dashboard-command-center-header.tsx`, `canvas-command-bar-blocks.tsx`, `layout-room-bar.tsx`, `command-button.tsx`).
- **Header layout:** Event setup in main row; DUAL-SCREEN Presenter/Wall Cast cluster; hall W/L dimension fields; Edit/Preview restored (`command-center-exit-link.tsx`, `canvas-toolbar-static.tsx`, `toolbar-static-layout.ts`).
- **Canvas UX:** Legend + allocation ledger as matching 200px side rails inside canvas host; preview fullscreen mode; deferred pathfinding/patron aisle overlay for faster booth delete INP.
- **Floor-plan tools:** Vendor/patron size chips highlight only when draw tool armed; ft/m sync across size grids; door long-edge wall snap; food truck wall collision; Main Hall editable W/L resizes grid; booth clearance preview bands (3? yellow / diagonal gap fix).
- **Nav/footer:** Bell badge only when unread; Next step CTA single-line footer layout.
- **Verify:** `npx tsc --noEmit` ? PASS; `npx tsx scripts/verify-booth-clearance-visual.ts` + `verify-structural-wall-snap.ts` + `verify-food-truck-placement.ts` ? PASS. Smoke: `/coordinator/dashboard` ? header fits one row; legend/ledger rails; preview toggle; patron path delete feels instant.

## Shipped this session (HubGrid two-row dashboard layout, deployed 2026-06-11)
- **Row 1 (header):** `dashboard-command-center-header.tsx` ? HubGrid | Allocation Ledger tabs, then portaled view/setup cluster (labels, Event setup, dual-screen, fullscreen, zoom) + hall management (Main Hall bar, undo/redo); no market title row.
- **Row 2 (tool strip):** `toolbar-static-layout.ts` + `canvas-toolbar-static.tsx` ? four labeled sections: SHAPES & BOOTHS (primitives only), VENDOR BOOTHS, PATRON TABLES (renamed), ALIGNMENT & SPACING; vendor/patron each own section with one horizontal icon row.
- **Portal split:** `canvas-command-bar.tsx` ? `headerBarLayout` ? `view-setup` + `hall-management`; `topBarLayout` ? tool-strip sections only (`DASHBOARD_HEADER_SECTION_IDS` / `DASHBOARD_TOOLSTRIP_SECTION_IDS`).
- **Payout banner:** removed from `market-dashboard-client.tsx` / `app/coordinator/dashboard/page.tsx`; `CoordinatorCommunityTrustBanner` on coordinator `app/profile/page.tsx` via `loadCoordinatorEscrowContext`.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? two rows (nav + tools), four tool sections; `/profile` ? Full payout access card for coordinators.

## Shipped this session (dashboard layout toolbar compaction + shared footer, deployed 2026-06-11)
- **SHAPES & BOOTHS single row:** `canvas-toolbar-static.tsx` + `globals.css` ? primitives, vendor booths, and patron elements render in one horizontal row to maximize canvas height.
- **ROOM & CANVAS in header:** Room/canvas controls portaled into HubGrid header via `DashboardHeaderToolbarPortalTarget`; top toolbar strip now shows Shapes & Booths + Alignment only (`toolbar-static-layout.ts` section filter, `floor-plan-v2.tsx` dual command-bar portals).
- **Shared footer:** `dashboard-workspace-footer.tsx` ? same `DashboardNextStepCta` footer on HubGrid and Allocation Ledger views (`Dashboard_qa.tsx`); removed duplicate ledger-pane footers.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? room tools in header row; shapes/booths one row; footer visible on both workspace tabs.

## Active work ? Next step CTA single-line layout (local, not deployed)
- **`dashboard-next-step-cta.tsx`:** Label + detail text on one row (was stacked `flex-col` in footer button); arrow pinned right; `truncate` on overflow.

## Shipped this session (initial loader side booth stagger + right-align scale, deployed 2026-06-11)
- **`components/brand/initial-loader-reveal.tsx`:** Left/right perimeter stalls use half-cell brick stagger (24 px offset on alternating rows); tables sit bottom-aligned in each 48?48 square; scale-in animation anchors on the inner/right edge of each square (not center) so sides read as right-aligned in their cells; inner ring inset updated for stagger extent.
- **Verify:** Hard refresh (clear `popup-hub-initial-loader-shown` in sessionStorage if needed) ? side columns show brick stagger; each stall grows from its square?s right edge toward the ring center.

## Shipped this session (dual-screen presenter vs wall-cast differentiation, deployed 2026-06-11)
- **Bug:** Both **Dual-Screen: Presenter** and **Dual-Screen: Wall Cast** opened `/coordinator/dashboard/ledger` with the same interactive table ? only the header label differed.
- **Fix:** `dashboard-ledger-window-client.tsx` ? **Presenter** keeps compact light UI with clickable booth names that focus the canvas; **Wall Cast** is read-only with dark high-contrast projection layout (large type, status-colored rows, canvas selection highlight + auto-scroll, no click handlers).
- **Window sizing:** `floorplan-sync.ts` ? wall-cast popup defaults to 1920?1080; presenter stays 1024?900; distinct window names unchanged.
- **Verify:** `/coordinator/dashboard` ? open both dual-screen buttons; presenter = light interactive ledger, wall cast = dark read-only display; selecting a booth on canvas highlights the row on wall cast; clicking a booth in presenter focuses canvas.

## Shipped this session (header nav UI/UX ? profile in menu, logo +15%, menu scroll, deployed 2026-06-11)
- **`app-nav.tsx` / `shopper-top-bar.tsx`:** Removed profile avatar from header right rail; profile access via `AppMenuSheet` (avatar + name banner + Profile settings). Shopper top bar hamburger now visible on all breakpoints for signed-in users.
- **`app-menu-sheet.tsx`:** Fixed menu cut-off ? `h-dvh` sheet height, safe-area padding on header/nav children (not outer shell), scrollable `overflow-y-auto` nav body.
- **Logo +15%:** `popup-hub-logo.tsx` default nav lockup; `app-nav`, `guest-nav`, `shopper-top-bar` header class overrides; `--app-nav-height` 3.15rem ? 3.625rem in `globals.css`.
- **Verify:** Sign in ? header shows logo (larger), bell + hamburger only (no header avatar); open menu ? profile banner at top, all links scroll on narrow/mobile viewports; guest nav logo scales up without overlap.

## Shipped this session (coordinator event hub side-panel navigation fix, deployed 2026-06-10)
- **`lib/coordinator/coordinator-event-route.ts`:** `isCoordinatorEventHubPath()` ? detects primary event overview (`/coordinator/events/[id]`) vs sub-routes.
- **`coordinator-workspace-rail.tsx` / `coordinator-context-panel.tsx`:** On event hub, hide self-referencing ?Event overview? buttons; top exit links to command center (`/coordinator/dashboard`). On sub-routes (layout, check-in, review, applications, etc.), ?Event overview? uses `router.push` to `/coordinator/events/{eventId}`.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/events/{id}` ? no dead ?Event overview? in left/right panels; ?Command center? exit works. Sub-route `/coordinator/events/{id}/applications` ? ?Event overview? returns to hub.

## Shipped this session (coordinator pre-flight review & publish page, deployed 2026-06-10)
- **Route:** `/coordinator/events/[id]/review` ? Pre-Flight Review & Publish for draft markets after floor plan work.
- **Layout snapshot:** `lib/coordinator/layout-telemetry-summary.ts` ? vendor booth totals, category breakdown, patron seating/amenities from saved layout; link back to HubGrid (`/coordinator/dashboard?event=`).
- **Review cards:** Inline save for event logistics, shopper details (parking, wheelchair toggle + notes, pet policy), pricing & category waitlist caps (`CategoryLimitEditor` + unified booth fee).
- **Publish:** `PATCH /api/coordinator/events/[eventId]` with `{ status: 'published' }` ? publish gate, venue verify, booth-fee checks; client button disabled while publishing; success toast + redirect to event overview.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: draft market with layout ? `/coordinator/events/{id}/review` ? edit cards save ? Publish ? lands on event hub with live toast.

## Shipped this session (platform FAQ copy refresh, deployed 2026-06-10)
- **`lib/legal/faq-content.tsx`:** Added coordinator value-prop FAQ (vs. DMs/spreadsheets); expanded pricing answer (vendor pass-through, coordinator fee toggle, offline-payment trust note); expanded fee rationale with mobile-app funding paragraph.
- **`app/legal/faq/page.tsx`:** Updated last-modified date to June 10, 2026.
- **Verify:** `/legal/faq` ? new ?Why should I choose Popup Hub?? entry visible; pricing and fee answers show structured multi-paragraph copy.

## Shipped this session (HubGrid toolbar element panel entry animation, deployed 2026-06-10)
- **Motion config:** `toolbar-element-panels-motion.ts` ? shared Framer Motion variants with `x: 0` start/end so vendor and patron asset tables animate on a strict vertical center axis (`y` spring only).
- **SHAPES & BOOTHS:** `canvas-toolbar-static.tsx` ? VENDOR BOOTHS (top) and PATRON ELEMENTS (bottom) stacked in `flex flex-col items-center justify-center`; `TopBarAssetTablePanel` + staggered container entry; `useReducedMotion` bypass.
- **CSS:** `globals.css` ? `data-toolbar-section='shapes-booths'` and `.toolbar-element-panel(s)` centering rules.
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? reload HubGrid toolbar; vendor booth size row and patron element row fade/slide in centered (no horizontal drift); reduced-motion shows panels instantly.

## Shipped this session (dashboard toolbar layout refactor, deployed 2026-06-10)
- **ROOM & CANVAS:** Removed duplicate Full screen from `dashboard-command-center-header.tsx`; primary control lives in top toolbar next to ? Event setup with `Dual-Screen: Presenter` / `Dual-Screen: Wall Cast` (`launchDualScreen('presenter'|'wall-cast')` via `openDualScreenWindow` in `floorplan-sync.ts`).
- **SHAPES & BOOTHS:** `canvas-toolbar-static.tsx` ? VENDOR / PATRON sub-labels; vendor sizing (`vendor-sizes`) moved from Alignment into Shapes; patron tools forced horizontal (`PatronSidebarControls` + `flex-row`).
- **ALIGNMENT & SPACING:** Auto-Arrange relabeled **AI Auto-Arrange** with `w-32 px-3 whitespace-nowrap` top-bar button (no text clipping).
- **Verify:** `npx tsc --noEmit` ? PASS. Smoke: `/coordinator/dashboard` ? Full screen only in ROOM & CANVAS strip; dual-screen buttons open separate presenter/wall-cast ledger windows; vendor/patron tool groups visually separated.
- **Build fix:** Split pure escrow math into `escrow-policy.ts` so client `apply-button.tsx` ? `booth-checkout.ts` no longer pulls `lib/supabase/server.ts` through `escrow.ts` audit imports; `npm run build` ? PASS.

## Shipped this session (coordinator onboarding relaxation + escrow criteria, deployed 2026-06-10)
- **Optional tax ID:** `coordinator-verification-banner.tsx` + `POST /api/coordinator/verification` ? organization name required; business registration / tax ID optional; invalid BN rejected only when provided.
- **Square/Stripe onboarding:** Payment trust path (Square OAuth complete or Stripe) satisfies publish checklist ? verification banner hidden when `paymentTrustComplete`; `enable-coordinator` no longer forces `pending`; connect CTA when not linked.
- **DB publish guard:** `104_coordinator_onboarding_relaxation.sql` ? `coordinator_can_publish_event` allows org name alone (no BN required) to match TS `hasOfflineOrganizerProfile`.
- **Escrow rules:** `coordinatorEscrowExempt` / `coordinatorRequiresEscrowHold` in `lib/coordinator/escrow.ts` ? 75% hold applies when organizer lacks **both** verified business tax ID (`hasVerifiedBusinessTaxId`) **and** 3 vendor vouches; Square-connected organizers still subject to escrow until tax ID or vouches.
- **Checkout/payout:** `resolve-booth-checkout.ts` + `distributeCoordinatorBoothPayout` use escrow exemption; `GET /api/events/[id]/payment-config` returns `coordinatorEscrowExempt`; vendor `apply-button.tsx` checkout preview reflects 75% hold for unverified organizers.
- **UI:** `market-dashboard-client.tsx` ? trust banner + verification banner wired with correct props; Square-connected coordinators skip corporate-doc banner.
- **Verify:** `npx tsx scripts/verify-coordinator-verification.ts` + `verify-coordinator-escrow.ts` ? PASS; `npx tsc --noEmit` ? PASS.
- **Apply migration:** Run `104_coordinator_onboarding_relaxation.sql` on Supabase before prod smoke-test.

## Shipped this session (coordinator escrow + vendor vouch + pass-through fees, deployed 2026-06-10)
- **Schema:** `101_coordinator_escrow_vouch.sql` ? `coordinator_is_verified`, `coordinator_successful_events_count`, `wallets.escrow_balance`, `coordinator_vouches`, `coordinator_escrow_holds`; `102_pass_fees_to_vendor.sql` ? `events.pass_fees_to_vendor`, `coordinator_escrow_holds.processor_transfer_id`.
- **Checkout math:** `lib/monetization/booth-checkout.ts` ? gross-up `(base + flat) / (1 - bps)` for pass-through; combined Square/Stripe `app_fee` = platform fee + 75% escrow hold on base booth for unverified organizers.
- **Escrow:** `lib/coordinator/escrow.ts` ? 25% immediate / 75% held; Square release credits coordinator wallet via `lib/square/coordinator-escrow-release.ts`; cron releases 24h post-event when no disputes.
- **Payments:** Square `createBoothPayment` uses dynamic `appFeeCents` + CAD; Stripe booth-payment/webhook parity; `record-transaction` splits escrow on `baseBoothCents`.
- **Pass-through toggle:** `MarketBoothPricingFields` + `event-form.tsx` checkbox; vendor checkout preview in `apply-button.tsx` + `pay-booth-modal.tsx`.
- **Vouch fast-track:** `POST /api/coordinator/vouch` (existing) + `VendorCoordinatorVouchButton` after approved application; `CoordinatorCommunityTrustBanner` on coordinator dashboard.
- **Auto-verify:** 3 vendor vouches or verified business tax ID (or admin approve) ? full payouts; 2 successful events increments counter only (per-event cron still releases held funds).
- **Cron:** `/api/cron/coordinator-escrow-release` daily 08:00 UTC in `vercel.json`.
- **Verify:** `npx tsx scripts/verify-coordinator-escrow.ts` ? PASS; `npx tsc --noEmit` ? PASS.
- **Apply migrations:** Migrations `100`?`103` applied to Supabase (`ensbggtbgabogvynqsqt`) via `npx supabase db push --yes` on 2026-06-10. Renamed duplicate `098_vendor_passport_tiktok.sql` ? `103_vendor_passport_tiktok.sql` to resolve version conflict with `098_platform_operator_patron_access.sql`.

## Shipped this session (coordinator fraud hardening, deployed 2026-06-10)
- **Schema:** `100_coordinator_fraud_mitigation.sql` ? `profiles` gains `coordinator_verification_status`, `coordinator_organization_name`, `coordinator_business_number`, `coordinator_risk_score`, `coordinator_account_status`; conservative backfill for Stripe/Square/venue-verified coordinators; DB trigger blocks event ? published/active when organizer fails publish trust path.
- **Lib:** `lib/coordinator/verification.ts` ? BN/EIN validation reuse, risk scoring, publish/payment/apply block reasons; trust paths: admin-verified OR Stripe OR Square OR offline org+BN (publish only for pending offline).
- **API gates:** `enable-coordinator` sets pending + message; `coordinator/events/draft` publish; `payment-settings` PATCH; `booth-payment` + `stripe/booth-payment`; `vendor/apply` blocks suspended/banned organizer; new `POST/GET /api/coordinator/verification`; new `POST /api/admin/coordinator-verification`.
- **UI:** `coordinator-verification-banner.tsx` on coordinator dashboard; client publish pre-checks in status toggle, setup wizard, spatial layout deploy.
- **Verify:** `npx tsx scripts/verify-coordinator-verification.ts` ? PASS; `npx tsc --noEmit` ? PASS.
- **Smoke test:** New shopper ? enable organizer ? dashboard banner ? submit org+BN ? publish blocked until submission; Stripe/Square coordinators publish without manual form; offline pending can publish but payment-settings / booth-payment blocked until verified; admin `POST /api/admin/coordinator-verification` with `{ coordinatorId, action: "approve" }` unlocks offline collection.

## Shipped this session (legend left-collapsible overlay, deployed 2026-06-10)
- **Legend panel:** `canvas-legend.tsx` ? docked/sidebar variants slide horizontally off the left canvas edge; collapsed state leaves a flush chevron tab (`>` expand / `<` collapse); semi-opaque white panel with right border + shadow overlays the grid without affecting drag coordinates.
- **Canvas width:** Removed fixed `168px` legend rail from `floor-plan-v2.tsx`; legend lives inside the canvas host as an overlay so the grid uses full width when collapsed.
- **CSS:** `globals.css` ? replaced `.dashboard-canvas-legend-rail` with `.canvas-legend-panel` (hidden below `lg`, visible on dashboard canvas host).
- **Verify:** `/coordinator/dashboard` (? lg) ? expand legend overlays grid; collapse slides panel left leaving chevron tab; canvas grid fills full host width; pan/drag unchanged under overlay margins.

## Shipped this session (manual drag ? no wall magnet snap, deployed 2026-06-10)
- **Drag fix:** `booth-layout-engine.ts` ? removed perimeter magnet snap from `boothLayoutMovePatch` / `boothLayoutCommitPatch`; manual drag uses 1? grid (5? with Shift) only; booths can sit at 2?, 3?, or 4? from walls without snapping flush.
- **Pointer cleanup:** `use-canvas-pointer.ts` ? dropped locked-wall-edge hysteresis during drag; commit re-quantizes grid without wall override.
- **Clearance colors:** unchanged live path in `canvas-objects.tsx` + `booth-clearance-visual.ts` (red ?2?, yellow >2? and <4?, green ?4?).
- **Verify:** `npx tsx scripts/verify-booth-manual-drag-grid.ts`, `verify-vendor-wall-snap.ts`, `verify-booth-clearance-visual.ts` ? PASS.
- **Smoke test:** `/coordinator/dashboard` ? drag vendor booth toward wall at 1? steps; hold Shift for 5? steps; stop at 2?/3?/4? clearance ? booth stays put (no flush snap); colors update live (red/yellow/green).

## Shipped this session (manual placement free + row wall orientation, deployed 2026-06-10)
- **Manual placement:** Removed same-category proximity and collision-buffer rejection from drag commit, draw commit, keyboard nudge, and booth resize ? coordinators can place booths freely; auto-arrange engines still enforce distance rules.
- **Row orientation snap:** `booth-layout-engine.ts` ? when a vendor booth shares a row (center Y within 1?), manual drag/draw/preview inherit the row peer's wall-facing rotation; `table-placement-preview.ts` ghost matches.
- **Verify:** `npx tsx scripts/verify-booth-row-orientation.ts` ? PASS.

## Shipped this session (canvas layout engine ? grid snap, wall clearance, booth colors, deployed 2026-06-10)
- **Layout engine:** `engine/booth-layout-engine.ts` ? shared drag/nudge loop: 1? default snap, 5? with Shift (`resolveBoothMoveSnapFt`); wired in `use-canvas-pointer.ts` (Shift key listener + drag frames) and `selection-keyboard-nudge.ts`.
- **Wall placement:** Perimeter snap uses strict `< 4?` threshold (`perimeter-booth-orientation.ts`, `vendor-booth-placement.ts`) so booths can sit exactly 4? from walls without snap jitter; `verify-vendor-wall-snap.ts` adds 4? regression.
- **Clearance colors:** `booth-clearance-visual.ts` ? red ?2?, yellow &gt;2? and &lt;4?, green ?4?; structural walls count as obstacles; isolated booths default green (fixes gray/wrong fills); legend copy updated.
- **Map labels:** Unchanged toggle path ? `resolveBoothMapLabelText` + clearance fills compose independently in `canvas-objects.tsx`.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts`, `verify-vendor-booth-clearance.ts`, `verify-booth-clearance-visual.ts` ? PASS.
- **Smoke test:** `/coordinator/dashboard` ? drag booth with 1? steps; hold Shift for 5?; place booth exactly 4? from wall (no snap fight); pair booths at 2? both turn red; toggle Map labels (vendor / category / booth ID).

## Shipped this session (two-pane map?ledger sync + Map Labels, deployed 2026-06-10)
- **Unified booth state:** `use-booth-entities.ts` ? single reactive array (id, dimensions, x/y, clearance band, vendor, category, payment status) feeding Booth Matrix and canvas label meta (`dashboard-floor-plan.tsx`).
- **Bidirectional ledger:** `booth-matrix-panel.tsx` ? vendor `<select>` calls `assignVendorToBoothByVendorId`; payment status is read-only (derived from applicant); canvas labels + clearance fills re-render instantly; `floorplan-sync.ts` + `floorplan-sync-bridge.tsx` relay `matrix_assign_vendor` from dual-screen ledger window.
- **Map Labels:** `lib/coordinator/booth-map-label.ts` + toolbar **Map labels** select (`canvas-command-bar-blocks.tsx`); `canvas-objects.tsx` wraps vendor booth text via `wrapTextInContainer` (vendor / category / booth ID modes); mode persisted in `localStorage`.
- **Chrome:** `app-nav.tsx` logo ? `/`; matrix control height tokens in `globals.css`.
- **Verify:** `/coordinator/dashboard` ? change vendor/status in split-pane matrix ? canvas label + clearance color update; toggle Map labels; dual-screen ledger stays synced; Full screen + Launch Dual-Screen Mode unchanged.

## Shipped this session (traffic-aware auto-arrange engine + spring animation, deployed 2026-06-10)
- **Layout engine:** Replaced generic Turf shelf-scan in `AutoArrangeEngine.ts` with traffic-aware path optimization ? maps entrance/exit flow terminals (`traffic-flow-prerequisites.ts`), builds serpentine patron pathway (`buildPatronPathway`), treats corridor as no-fly zone (`buildTrafficNoFlyRects`), packs booths along path margins via `calculatePatronCentricLayout`, shifts occluded booths for path frontage, enforces 3? clearance (`VENDOR_BOOTH_AISLE_FT`), Turf-validates merged zones.
- **Spring animation:** `hooks/use-layout-spring.ts` ? damped spring rAF; `canvas-objects.tsx` + `floor-plan-canvas.tsx` accept `layoutSpringPoses`; `floor-plan-v2.tsx` `commitVendorPackWithSpring` animates booths from pre-arrange positions on Auto-Arrange / Auto-Layout.
- **Verify:** `npx tsx scripts/verify-auto-arrange-engine.ts` and `npx tsx scripts/verify-layout-pathfind.ts` ? both PASS.
- **Smoke test:** `/coordinator/dashboard` ? place entry + exit doors on perimeter; run Auto-Arrange; booths spring from overlap line into serpentine traffic layout with 3? clearance bands.

## Shipped this session (coordinator dashboard premium refactor ? clearance + workflow, deployed 2026-06-10)
- **Clearance physics:** `lib/coordinator/booth-clearance-visual.ts` ? 3? baseline; red ?1? / orange &lt;3? / green ?3? booth fills during drag; `layout-clearance-constants.ts` safety buffer 3?; snap grid drift fix in `geometry.ts`.
- **Autosave:** `dashboard-layout-save-context.tsx` ? Saving? only after debounced commit; green Saved after 1s hold; `floor-plan-v2.tsx` schedules on `onLayoutCommit` (drag end) not continuous doc fingerprint.
- **Workflow CTA:** `dashboard-next-step-cta.tsx` ? static footer; Blueprint ? Ledger when clearance valid; Ledger ? overview when allocations complete; clearance tooltip blocks advance.
- **Toolbar / chrome:** Compressed dashboard gutters; ALIGNMENT & SPACING section unhidden in top bar; vendor matches panel removed; legend docked rail + clearance key; nav contrast fixes; logo ? `/coordinator/dashboard`.
- **Verify:** `/coordinator/dashboard` ? drag booth shows clearance colors; Saving? after drag release; Next step disabled when orange/red clearance; valid layout opens Allocation Ledger tab.

## Shipped this session (virtual split-pane + native dual-screen workspace, deployed 2026-06-10)
- **Virtual split-pane:** `dashboard-split-workspace.tsx` ? HubGrid ~65% + Allocation Ledger ~35%; collapse toggle on ledger header (`dashboard-workspace-view-context.tsx` persisted state); wired in `Dashboard_qa.tsx`.
- **Dual-screen engine:** `lib/coordinator/floorplan-sync.ts` + `floorplan-sync-bridge.tsx` ? `BroadcastChannel('floorplan_sync')`; toolbar **Launch Dual-Screen Mode** (`canvas-command-bar-blocks.tsx`, `floor-plan-v2.tsx`); secondary window `/coordinator/dashboard/ledger` (`dashboard-ledger-window-client.tsx`).
- **Density + layout:** `--dashboard-gutter` tightened; split-pane CSS in `globals.css`; **Full screen** labeled button (browser fullscreen via `command-center-fullscreen-context.tsx`); reactive autosave chip (yellow Saving? ? green Saved to cloud).
- **Booth matrix:** Coordinates column removed; even 25% columns; semantic status badges; `aria-live` on table region; **Next step** CTA anchored in static footer (`dashboard-allocation-ledger.tsx`, split footer); VENDOR MATCHES removed from toolbar.
- **Canvas physics:** Vendor booth drag uses `snapToGrid` during move + commit (`use-canvas-pointer.ts`); status labels wrap via `wrapTextInContainer` (`canvas-label-text.ts`, `canvas-objects.tsx`).
- **Verify:** `/coordinator/dashboard` ? split pane + collapse expand; **Launch Dual-Screen Mode** opens ledger window with live matrix sync; booth click in ledger focuses canvas; Full screen fills monitor; logo ? `/`; ALIGNMENT & SPACING + Auto-Arrange visible in top bar.
- **Deploy fix (2026-06-10):** Production build `5b45e5d` failed ? `dashboard-split-workspace.tsx` referenced `ledgerPaneCollapsed` before `dashboard-workspace-view-context.tsx` exported it (TS error on Vercel). Working tree now complete; `get-deploy-commit-message.ps1` sanitizes bat REM preview (ASCII-only) to avoid Windows `'et' is not recognized` after failed deploy.

## Shipped this session (coordinator dashboard density + UX polish, deployed 2026-06-10)
- **Global chrome:** `app-nav.tsx` ? Popup Hub logo links to `/`; nav pills use high-contrast `text-stone-900`; unified `--dashboard-gutter` aligns header, toolbar, and booth matrix left edges.
- **Autosave chip:** `dashboard-layout-save-context.tsx` ? debounced `scheduleAutosave` with yellow saving ? green saved ? idle fade; `floor-plan-v2.tsx` uses doc fingerprint (fixes stuck ?Saving??).
- **Edit/Preview:** `dashboard-command-center-header.tsx` ? full-width pill toggle with custom track/thumb (single click target).
- **Canvas:** Legend moved to persistent left rail (`canvas-legend.tsx` `variant="docked"`); dashboard viewport fill restored over QA scroll class; zoom min 25% with viewport-center anchor; booth name/status text no longer overlap (`canvas-objects.tsx`).
- **Vendor matches:** `vendor-matches-panel.tsx` ? illustration empty state, inline invite CTA, fixed plural strings (`1 booth` not `booth s`).
- **Booth matrix:** `booth-matrix-panel.tsx` ? collapsible accordion header, denser rows, wider coordinates column, semantic badges; single accessible table (no duplicate SR table).
- **Verify:** `/coordinator/dashboard` ? logo ? `/`; edit canvas ? Saving? then Saved to cloud; zoom 50/75/100% from viewport center; legend rail; collapse booth matrix; vendor matches empty state + invite button inline.

## Shipped this session (semver build versioning, deployed 2026-06-10)
- **`lib/build-info.ts`:** `formatAppVersion` now returns `major.minor.patch` from `package.json`; build counter stays separate in footer (`v1.0.0 ? build 68`). Added `parseSemver` / `semverComponentsChanged`.
- **`scripts/bump-build-number.mjs`:** Resets build to `1` when major, minor, or patch changes; stores semver components in `build-number.json`.
- **`package.json`:** Added `version:patch`, `version:minor`, `version:major` scripts (`npm version * --no-git-tag-version`).
- **Verify:** Footer shows `v1.0.0 ? build N` (not `v1.0.N`); bump patch via `npm run version:patch` resets build to 1 on next build.

## Shipped this session (coordinator dashboard premium UI refactor, deployed 2026-06-10)
- **Design tokens:** `globals.css` ? `--dashboard-radius`, `--dashboard-toolbar-height`, `--dashboard-panel-gap`; utility classes `.dashboard-panel`, `.dashboard-toolbar-section`, `.dashboard-pill-toggle`, `.dashboard-save-chip`.
- **Nav + header:** `app-nav.tsx` pill active tabs; `dashboard-command-center-header.tsx` ? autosave chip via `DashboardLayoutSaveProvider`, full-pill Edit/Preview, deduped bell/actions; `market-dashboard-client.tsx` wires save context.
- **Toolbars:** `toolbar-static-layout.ts` merges optimize into alignment-spacing; `vendor-sizes` renders in top bar; discrete zoom (`discrete-zoom.ts`, `use-viewport.ts`); `table-size-pill.tsx` segmented strip + imperial/metric toggle; `layout-room-bar.tsx` edit/delete divider.
- **Canvas:** Full-bleed command-center viewport (hidden scrollbars, grab cursor); legend docked left (`canvas-legend.tsx` `variant="sidebar"`); status-driven booth colors + wrapped status labels; booth keyboard focus (`use-canvas-object-keyboard.ts`).
- **Vendor matches:** `vendor-matches-panel.tsx` ? empty state, pluralization fix, inline Send Priority Invites CTA.
- **Booth matrix:** `booth-matrix-panel.tsx` ? semantic badge pills, fixed columns, `aria-live`; removed duplicate `booth-matrix-a11y-table.tsx`; CTA inline in matrix header (`dashboard-next-step-cta.tsx` `inline`).
- **Wizard parity:** `booth-planner.tsx`, `table-size-selector.tsx`, `canvas-utility-toolbar.tsx` share dashboard token styling.
- **QA mirrors:** `canvas-command-bar-blocks_qa.tsx` vendor-sizes top-bar fix; `floor-plan-canvas_dashboard_qa.tsx` zoom min 0.75.
- **Verify:** `/coordinator/dashboard` ? one bell (app nav); header autosave + Edit/Preview pill; alignment section shows Auto-Arrange + table sizes; zoom 50/75/100%; legend left; tab booths; vendor matches empty state; single matrix + inline CTA; wizard Step 3 room bar + table strip match dashboard chrome.

## Shipped this session (event dashboard layout ? top toolbar, mobile booth matrix, deployed 2026-06-10)
- **Top toolbar strip:** Layout tools (Room & Canvas, Shapes, Alignment, Floor Plan) moved from left rail to horizontal bar below dashboard header via `dashboard-top-toolbar-strip.tsx` + `topBarLayout` on `CanvasCommandBar` / `CanvasToolbarStatic`; `floor-plan-v2.tsx` portals into top strip on all viewports.
- **Dashboard shell:** `dashboard-app-shell.tsx` drops fixed left column; `Dashboard_qa.tsx` wires toolbar strip + preview mode; header compact (`py-1.5`).
- **Command center header:** Edit / Preview toggle (`command-center-fullscreen-context` `previewMode`); live notification badge placeholder; subtitle updated.
- **Site nav:** `--app-nav-height` 4.5rem ? 3.15rem (~30% reduction); `CenteredHeaderRow` grid centers inline links; hamburger on all breakpoints; Bell notification slot in header; `app-menu-sheet` Profile settings first in nav list.
- **Booth matrix:** `booth-matrix-panel.tsx` ? desktop table, mobile accordion; shared `use-booth-matrix-rows.ts`.
- **Workflow CTA:** `dashboard-next-step-cta.tsx` ? high-contrast **Next step** button over canvas (invites / payments / overview).
- **Google Maps:** `google-maps-provider.tsx` documents Maps JS / Places / Geocoding API restriction errors ? `GoogleMapsApiFallback`.
- **Verify:** `/coordinator/dashboard` ? tools in top bar (not left); phone ? booth matrix accordion; Edit/Preview hides toolbar + dims canvas; **Next step** routes to applications or payments; break Maps key ? amber fallback on wizard/discover.

## Shipped this session (app menu density ? semantic sections, deployed 2026-06-10)
- **`app-menu-sheet.tsx`:** Rebuilt slide-out menu with semantic `<nav>` / `<section>` / `<ul>` lists; tighter padding, `min-h-10` row targets, grouped Navigate / Account / Actions sections; 2-column grid for 4+ primary links; dropped duplicate Profile settings when profile header is shown; removed heavy Button wrappers.

## Shipped this session (side menu / sidebar scroll, deployed 2026-06-10)
- **`dashboard-toolbar-portal.tsx`:** Replaced `flex-shrink-0` with `min-h-0 flex-1` so the command-center left rail scrolls when layout tools exceed viewport height.
- **`dashboard-app-shell.tsx`**, **`dashboard-tablet-tools-dock.tsx`:** Constrain drawer/aside overflow so the portaled toolbar scrolls inside the panel.
- **`app-menu-sheet.tsx`:** Fixed mobile hamburger drawer flex chain (`max-h-[100dvh]`, `overflow-hidden` shell, scrollable nav region).
- **`command-center-shell.tsx`:** Left/right workspace rails scroll independently on desktop when content exceeds viewport.
- **Verify:** Command center ? expand all layout-tool accordions; bottom sections reachable via sidebar scroll. Phone ? open hamburger menu with admin/extra links; scroll to Sign out.

## Shipped this session (header nav ? logo left, hamburger restored, profile first, deployed 2026-06-10)
- **`centered-header-row.tsx`:** Restored three-zone flex layout ? logo flush left (`mr-auto`), middle fills with portal tabs + inline nav links, actions right.
- **`app-nav.tsx`**, **`guest-nav.tsx`**, **`shopper-top-bar.tsx`:** Replaced profile-only `UserProfileMenu` dropdown with hamburger (`Menu` + `AppMenuSheet` on `md:hidden`); profile avatar/link is the **first** right-rail action (guests get user icon ? login); logo in `left` slot; coordinator Dashboard / New Event / Wallet inline with role tabs on `md+`.
- **Suggest:** Remains in `AppMenuSheet` only (no desktop nav button).
- **Verify:** Phone ? logo far left, profile icon then hamburger right; drawer opens with profile header first; desktop ? logo + role pill + nav links aligned in one row.

## Shipped this session (deploy noop exit code fix, deployed 2026-06-10)
- **`Deploy-popuphub.bat` / `get-deploy-commit-message.ps1`:** When deploy script returns exit 2 (nothing to ship), bat normalizes to exit 0 so double-click does not show "Deploy failed".

## Shipped this session (deploy script already-shipped guidance, deployed 2026-06-10)
- **`deploy-popuphub.ps1`:** When no `not deployed` handoff sections exist, print baseline branch/commit and how to add a section or run `-SkipCommit`; exit 2 (noop) if tree is clean, exit 1 only when uncommitted work lacks a handoff section.
- **`Deploy-popuphub.bat`:** Exit code 2 shows "Nothing to deploy" instead of "Deploy failed"; PowerShell invoke uses safe `if defined DEPLOY_PS_ARGS` branch (no `PS_ARGS` parse error).
- **Handoff:** Deploy gate note at top of this file.

## Shipped this session (mobile UX, nav/footer overhaul, auth flows, deployed 2026-06-10)
- **Navigation:** Removed hamburger menus; `UserProfileMenu` dropdown (profile/user icon) holds nav links, notifications, sign-out, and **Suggest an Improvement** on all breakpoints. Desktop inline nav links remain on `lg+` in `app-nav.tsx`.
- **Header:** `CenteredHeaderRow` uses a 3-column grid ? logo centered; mobile logo height capped (`h-14`/`h-16`) to prevent clipping; `safe-top` minimum padding increased globally.
- **Footer:** Removed footer logo from `build-version-footer.tsx`; root layout uses `min-h-dvh` + `flex-1` shells so footer pins without extra white space; mobile shopper bottom-nav padding tuned (keyboard-safe, not fixed).
- **Patron auth:** `/favorites` is public with guest CTA (Browse Markets / Sign In); favorite save still gates on click. Landing hero unchanged.
- **Coordinator mobile:** Middleware login/signup redirect uses `resolvePostLoginPath` (mobile-aware); `/coordinator/events/[id]/layout` server-redirects phones to event overview; market-day shell hides Spatial Planner tab on mobile.
- **Coordinator typography:** `PortalRoleBadge` shared label styling on mobile overview + empty dashboard state.
- **Admin / ops safe-area:** Extra top padding on `/admin` and market-day operations headers.
- **Suggestion control:** Removed desktop nav button + floating FAB; entry only via profile dropdown.
- **Address cleansing:** `lib/addresses/sanitize-address.ts` ? heuristic Canadian address normalizer; wired into `wizard-step-venue.tsx` before AI/geocode.
- **Platform operator:** Migration `098_platform_operator_patron_access.sql` keeps `bradmulders@gmail.com` on shopper/vendor role with `is_admin`; favorite errors now surface Supabase message.
- **Verify:** Phone ? centered logo, profile dropdown nav, compact footer pinned; guest `/favorites` ? sign-in CTA not redirect; coordinator phone login ? `?overview=mobile`; layout route blocked on phone; venue wizard messy address geocodes; suggest only in profile menu.

## Shipped this session (Vercel Analytics, deployed 2026-06-10)
- **`@vercel/analytics`:** Installed and wired in `app/layout.tsx` via `<Analytics />` for page-view tracking on Vercel deployments.

## Shipped this session (floor plan designer exit navigation ? Full canvas fail-safe, deployed 2026-06-10)
- **Root cause:** Command-center **Full canvas** (`command-center-canvas-fullscreen`) and native wizard fullscreen hide site nav; coordinators had no persistent route back to event setup.
- **`command-center-exit-link.tsx`:** `resolveDesignerExitHref` / `resolveDesignerExitLabel` ? draft markets ? `/coordinator/events/[id]/setup?step=3`; published ? event overview; `CommandCenterExitButton` for toolbar/fullscreen overlays (`z-[10001]`, `pointer-events-auto`).
- **Dashboard:** Sticky **Back to Event Setup** in `dashboard-left-panel.tsx`, `Dashboard_qa` left rail, `dashboard-tablet-tools-dock` drawer, and immersive header (`dashboard-command-center-header.tsx`); exits fullscreen before navigate.
- **Canvas toolbar:** Utilities row in `canvas-command-bar-blocks.tsx` ? prominent exit link adjacent to Full canvas toggle; wired via `floor-plan-v2.tsx` + `dashboard-floor-plan.tsx` + `spatial-layout-editor.tsx`.
- **Native fullscreen:** `fullscreenExitToolbar` in `floor-plan-v2.tsx` pairs **Back to Event Setup** with **Exit Fullscreen**.
- **Verify:** `/coordinator/dashboard` ? select draft market ? **Full canvas** ? left rail + header + utilities show green **Back to Event Setup**; click returns to setup step 3; `/coordinator/events/[id]/layout` native fullscreen shows same escape hatch.

## Shipped this session (profile copy ? coordinator accountability, deployed 2026-06-09)
- **`app/profile/page.tsx`:** Coordinator Accountability helper text now reads *"Your public rating reflects on-time vs. late venue cancellations."*

## Shipped this session (header nav layout ? hamburger menu, profile in drawer, logo left, deployed 2026-06-09)
- **`centered-header-row.tsx`:** Three-zone flex ? brand `mr-auto` flush left, flexible middle (`min-w-0 overflow-x-hidden`), actions right; `justify-start` on row.
- **`app-nav.tsx`**, **`guest-nav.tsx`**, **`shopper-top-bar.tsx`:** Mobile hamburger (`Menu` icon, `md:hidden`) toggles `AppMenuSheet`; desktop profile avatar link unchanged (`md:inline-flex`); logo in `left` slot; `overflow-x-hidden` on `<nav>`/`<header>`.
- **`app-menu-sheet.tsx`:** `menuProfile` prop ? avatar + name header inside slide-out panel (links to `/profile`); `overflow-x-hidden` on sheet + nav scroll area; guest menus keep "Menu" title.
- **`portal-tabs.tsx`:** Role toggle pill bar `overflow-x-auto` ? `overflow-x-hidden`.
- **Verify:** Phone ? logo far left, hamburger far right; drawer opens with profile header (signed-in) or Menu title (guest); no horizontal scrollbar in header chrome; desktop nav unchanged.

## Shipped this session (booth wall bounce fix ? 0? flush, footprint clamp, deployed 2026-06-09)
- **4? deadzone + 5? bounce:** Vendor drag no longer uses `snapToGrid` (grid loses to wall flush); live drag uses `positionOnly` wall snap (no per-frame `orientVendorBoothToNearestWall` fight); drag commit clamps instead of reverting to pre-drag origin.
- **`footprintClampDeltaForRoom`:** Independent X/Y clamp via `objectFootprintAabb` ? `minX/maxX/minY/maxY` with 0? vendor inset; guest tables keep 4? `ROOM_PLACEMENT_CLEARANCE_FT`.
- **Wall band:** `VENDOR_WALL_SNAP_THRESHOLD_FT = 4` ? within 4? of a wall, snap flush to interior edge instead of bouncing to grid.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts`; drag vendor booth along each wall ? flush at 0?, no 9? bounce.

## Shipped this session (booth canvas ? wall snap, E/W flush placement, arrow-key nudge, deployed 2026-06-09)
- **E/W 4? regression:** `VENDOR_WALL_INSET_FT = 0` in `boundary-constraints.ts` ? vendor booths flush to west/east room bounds; guest tables keep 4? `ROOM_PLACEMENT_CLEARANCE_FT`. Axis-dominant perimeter picking + cross-axis preservation in `perimeter-booth-orientation.ts`; snap-before-clamp in `use-canvas-pointer.ts` and `selection-keyboard-nudge.ts`.
- **Corner flicker:** `pickPerimeterEdgeWithHysteresis` + locked wall edges during drag in `use-canvas-pointer.ts`.
- **Arrow-key nudge:** `selection-keyboard-nudge.ts` + `useSelectionKeyboardNudge` in `floor-plan-canvas.tsx` ? Arrow 1?, Shift+Arrow 5?.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts`; layout editor ? drag booth to west/east wall (flush, no flicker); arrow keys nudge selection.

## Shipped this session (coordinator mobile dashboard, maps provider, address AI geocode, deployed 2026-06-09)
- **Coordinator mobile dashboard:** `MarketDashboardClient` routes phones to `CoordinatorMobileOverview` (`isMobileDevice()` or `?overview=mobile`); dashboard page wraps client in `Suspense` for `useSearchParams`.
- **Post-login redirect:** OAuth callback uses `resolvePostLoginPath` (user-agent aware) instead of `getDefaultDashboard`; `Login_qa` passes `userAgent` only.
- **Google Maps provider:** `event-form`, `wizard-step-venue`, and `event-map` use shared `GoogleMapsProvider` + `GoogleMapsApiFallback` instead of raw `APIProvider`.
- **Venue wizard:** `venue-places-autocomplete` shows manual input fallback on Places `API_ERROR`; `wizard-step-venue` runs unstructured addresses through `useNormalizeAddressAi` before geocoding.
- **Layout:** `market-day-shell` main column `flex-1` so footer pins on short pages.
- **Verify:** Coordinator login on phone ? mobile overview list (no canvas); OAuth callback lands on mobile overview; wizard venue step geocodes messy pasted address; break Maps key ? fallback UI on map + Places fields; `/discover` map still renders with fallback list.

## Shipped this session (mobile UX, auth flows, maps/address AI, deployed 2026-06-09)
- **Mobile shell:** `safe-top` on admin Operations Console, market-day ops header, guest nav; root `min-h-screen` flex column + `flex-1` main in shopper/shared shells so `BuildVersionFooter` pins to viewport bottom; `CenteredHeaderRow` centers logo in `app-nav`, `shopper-top-bar`, `guest-nav`.
- **Navigation:** Removed hamburger triggers ? mobile profile/user icon opens `AppMenuSheet`; desktop profile still links to `/profile`; Suggest FAB hidden below `md` (menu + nav bar retain entry).
- **Patron auth:** Landing hero ? prominent **Browse Markets** + **Sign In** only; `/discover` and browse routes remain public (favorites/wallet still gate on save actions).
- **Coordinator mobile login:** `resolvePostLoginPath` + `CoordinatorMobileOverview` ? phones land on `/coordinator/dashboard?overview=mobile` (event list, no canvas mount); login form + OAuth callback use shared helper.
- **Maps:** `GoogleMapsProvider` + `GoogleMapsApiFallback` (Maps JS / Places / Geocoding key guidance); `lib/addresses/parse-address-ai.ts` + `POST /api/parse-address` normalizes unstructured addresses before geocode in venue wizard.
- **Verify:** Phone PWA safe-area on `/admin`, `/coordinator/events/.../operations`; guest `/` ? Browse Markets without login; coordinator login on phone ? overview list not layout canvas; venue wizard paste messy address ? AI normalize + pin; break Maps key ? fallback alert.

## Shipped this session (CanvasEditor Auto-Arrange ? Turf packBooths, deployed 2026-06-09)
- **`floor-plan-v2.tsx`:** Inspector **Auto-Arrange** button (`CanvasEditor`) now calls `PackBooths` / `AutoArrangeEngine.packBooths` (Turf-validated shelf scan inside `merged_zone`) instead of legacy `autoArrangeInRoom`; clears booth positions, packs with 5? aisles, `store.replaceObjects`; unplaced booths stay off-canvas (`x/y = -999`).
- **`scripts/verify-auto-arrange-engine.ts`:** Smoke test for merged_zone polygon + stage obstacle ? Turf overlap/containment.
- **Verify:** `npx tsx scripts/verify-auto-arrange-engine.ts`; `npx tsx scripts/verify-layout-pathfind.ts`; layout editor ? deselect all ? **Auto-Arrange** packs vendor booths into merged zone.

## Shipped this session (layout editor ? auto-arrange refactor, patron flow overlay, OpenRouter fix, deployed 2026-06-09)
- **Auto-arrange grid (`auto-arrange.ts` + `deterministic-market-layout.ts`):** Back-to-back double-row blocks with mandatory **6? patron aisles** (`PATRON_AISLE_MIN_FT`); strict collision via `placedObjectsOverlap` + expanded obstacle probes; removed greedy fallback packer that caused overlaps; unplaced booths stage to open slots or are omitted with `removedOverlapCount` + toast: *"Could only fit X booths safely. Removed Y overlapping items."*
- **Patron flow overlay:** `lib/floor-plan/patron-aisle-overlay.ts` + `PatronAisleOverlay` (green dashed 6? corridor bands); **Toggle Patron Flow** (Route icon) in ROOM & CANVAS utilities sidebar; combines with existing `PatronTrafficPathOverlay` when doors exist.
- **OpenRouter:** `lib/ai/openrouter.ts` uses `getURL()` for `HTTP-Referer`; dev console hints when `OPENROUTER_API_KEY` missing; `/api/layout/recommend` + client handle `AI_UNAVAILABLE` without breaking the inspector panel.
- **Env:** `GOOGLE_MAPS_API_KEY` added on Vercel production (2026-06-09). Client reads `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; redeploy picks up maps/Places after key sync.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` (31 pass); layout editor ? Auto-Arrange (grid) no overlapping booths; Toggle Patron Flow shows green aisles; Ask AI shows panel error cleanly when key unset (set `OPENROUTER_API_KEY` in `.env.local` for live feedback); `/coordinator/events/new` Step 1 Places autocomplete + `/discover` map pins after prod redeploy.

## Shipped this session (AI layout recommendation panel, deployed 2026-06-09)
- **`app/api/layout/recommend/route.ts`:** Coordinator-gated POST; OpenRouter Claude 3.5 Sonnet (`layout_recommend` task) evaluates active-room layout for safety/traffic flow; returns `recommendedObjects`, `changelog`, `rationale`.
- **`lib/floor-plan/ai-layout-recommend.ts` + `request-layout-recommend.ts`:** Server prompt/parse/clip; client payload build (room-local coords), fetch, merge back to global `FloorPlanDoc`.
- **UI:** Left-rail **?? Ask AI for Layout Feedback** (`canvas-command-bar-blocks` utilities); right inspector **AI Spatial Assessment** card with changelog bullets + **Apply AI Layout Changes** (`ai-spatial-assessment-panel.tsx`); wired in `floor-plan-v2_wizard_qa.tsx` for `/coordinator/events/[id]/layout` only (`!isDashboard`).
- **Verify:** `npx tsx scripts/verify-ai-provider-fallback.ts` (layout_recommend ? claude-3.5-sonnet); layout route with `OPENROUTER_API_KEY` ? Ask AI ? panel shows rationale/changelog ? Apply moves objects (undo works).

## Shipped this session (spatial layout editor ? save draft, auto-arrange, patron path, deployed 2026-06-09)
- **Save draft:** `SpatialLayoutToolbar` + canvas utilities row ? **Save draft** persists `booth_layouts` via `persistLayoutDraft` without publishing the event; **Save & deploy** unchanged. Loading states + success toasts on both paths.
- **Auto-arrange grid:** `floor-plan-v2.tsx` grid mode uses `autoArrangeInRoom` (reads active room bounds e.g. Main Hall 50??50?, distributes vendor booths with aisle gaps). Traffic-flow door prereqs only gate staggered/perimeter/AI modes ? grid works immediately with booths placed.
- **Patron path tool:** Route icon in shape selector toggles `PatronTrafficPathOverlay` (dashed sky-blue walk path via `usePathfinding`). Wired in production `floor-plan-v2` + `floor-plan-v2_wizard_qa` canvas.
- **Toolbar UX:** Command ribbon uses `flex-nowrap overflow-x-auto` instead of chaotic double-row wrap; tooltips remain portaled to `document.body` via `TooltipWrapper`.
- **Sidebar utilities fix:** Left-rail `utilities` block restored fullscreen (Expand icon), labels toggle, save draft, and save deploy ? previously only zoom was rendered in `sidebarLayout` mode.
- **Verify:** `/coordinator/events/[id]/layout` ? Save draft (no deploy) ? reload confirms layout; Auto-Arrange Floor Plan (grid) spreads overlapping vendor booths; Patron Path toggle shows/hides walk overlay.

## Shipped this session (spatial layout ? vendor-only capacity counting, deployed 2026-06-09)
- **Root cause:** `placedCount` used `store.doc.objects.length`, so walls, doors, exits, and other structural fixtures inflated the "X of Y max" badge and canvas object counter.
- **`floor-plan-v2.tsx`:** `placedCount` / `onPlacedCountChange` now use `vendorBoothsInRoom(store.doc, activeRoomId).length` ? vendor booths only, scoped to the active room (matches Step 2 `layoutCapacity`). Canvas status badge label ? "vendor booths placed".
- **`property-inspector.tsx`:** Multi-select header shows "N Vendors Selected" when vendor booths are in the selection; structural/non-vendor picks are called out in the subtitle instead of inflating the vendor tally.
- **`layout-planner-stats.tsx`:** Wizard left-rail counter label aligned to "vendor booths placed".
- **Note:** Structural assets already use distinct `kind` values (`wall`, `door`, `emergency_exit`, etc.) ? no schema change required.
- **Verify:** `/coordinator/events/[id]/layout` ? place vendor booths + walls/doors ? toolbar badge counts vendors only; multi-select 39 booths + 1 wall ? "39 Vendors Selected".

## Shipped this session (vendor table wall orientation fix, deployed 2026-06-09)
- **Root cause:** Wall orientation only updated `rotation` without normalizing footprint (`width`/`height`), so a table stored as 2?6 could present its short edge to the wall. Auto-pack and placement preview also skipped orientation when outside the 3? snap threshold.
- **`perimeter-booth-orientation.ts`:** Exported `boothSpanAndDepth()` (uses `tableLengthFt` when set) and `orientBoothToNearestWallEdge()` ? long back edge toward nearest wall, center preserved.
- **`vendor-booth-placement.ts`:** Added `orientVendorBoothToNearestWall()`; `vendorBoothPerimeterSnapPatch()` now snap-or-orients on every draw/drag commit.
- **`BoothArrangementEngine.ts`:** Pack post-step uses full wall orientation (not rotation-only).
- **`table-placement-preview.ts`:** Ghost preview orients toward nearest wall even beyond 2? snap.
- **`auto-arrange.ts`:** Direct perimeter slots normalize span?depth before rotation.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts` ? place/drag vendor table near any wall ? long edge flush, opening inward; interior placement still auto-rotates toward closest wall.

## Shipped this session (layout designer ? left sidebar, portal tooltips, auto-arrange fix, deployed 2026-06-09)
- **`tooltip-wrapper.tsx`:** Tooltips portaled to `document.body` (escapes `overflow: hidden` on layout tools rail).
- **`floor-plan-v2_wizard_qa.tsx`:** Left sidebar `bg-white` + `border-r`; wired `handleAutoArrangeFloorPlan` via `autoArrangeInRoom` (reads active room e.g. Main Hall 50??50?, grid-packs placed objects).
- **Verify:** `/coordinator/events/[id]/layout` ? tools in left column; hover tooltips not clipped; Auto-Arrange Floor Plan moves booths when objects exist.

## Shipped this session (spatial layout editor ? left panel section headers + rigid toolbar, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** Left-rail sidebar regrouped into **ROOM & CANVAS**, **SHAPES & BOOTHS**, and **ALIGNMENT & SPACING** (new `vendor-sizes` block for 5??20? grid chips).
- **`canvas-toolbar-static.tsx` + `canvas-toolbar-static_qa.tsx`:** Section headers (`text-xs font-semibold text-muted-foreground`), `border-t` dividers, `shrink-0` section shells.
- **`canvas-command-bar-blocks.tsx` + `_qa.tsx`:** Icon rows `flex-nowrap`; zoom % fixed width; selection metrics in absolute badge; labels toggle in alignment section.
- **`floor-plan-v2_wizard_qa.tsx`:** `/coordinator/events/[id]/layout` uses a fixed 300px left **Layout tools** rail (`staticLayout` + `sidebarLayout`); status badges use fixed-height slots so counts do not shift tool rows.
- **Verify:** Open event layout editor ? left panel shows three labeled sections; place/select objects ? toolbar icon rows do not wrap or jump.

## Shipped this session (Step 2 Capacity & Pricing layout refactor, deployed 2026-06-09)
- **`wizard-step-capacity.tsx`:** Two-column desktop layout ? left **Physical & pricing setup** (floor stats + booth fee), right **Inventory & category limits** (suggested caps, MLM guard, accordion category editor). Removed `TableSizeSelector` from Step 2 (table size still driven via wizard context / floor plan).
- **`smart-populate-booth-caps.tsx`:** Floor math breakdown (gross floor, aisle subtractions, etc.) moved into a hover tooltip on **Usable floor** via `FloorCalculationBreakdown`.
- **`category-limit-editor.tsx`:** Flat 40-row table replaced with collapsible accordions grouped by broad type (Makers & Crafts, Art & Prints, Food & Beverage, Apparel, Commercial / MLMs); CSS grid aligns max-slot and fee inputs; Quick Start top, Add Category Slot bottom.
- **`market-booth-pricing-fields.tsx`:** Added `compact` prop for nested left-column layout.
- **`mlm-tier-guard.tsx`:** Grid alignment for Max MLMs input.
- **Verify:** Market wizard Step 2 ? two columns on `lg+`; category sections collapse/expand with slot totals in headers; usable-floor (?) shows calculation tooltip; no table-size picker on this step.

## Shipped this session (coordinator dashboard ? no forced initial room modal, deployed 2026-06-09)
- **Root cause:** `dashboard-bootstrap.tsx` and `Dashboard_qa.tsx` auto-mounted `InitialRoomModal` (full-screen overlay + body scroll lock) whenever a selected market had zero saved rooms ? intercepting login before the dashboard shell was usable.
- **`dashboard-no-room-empty-state.tsx`:** Inline empty state in the canvas column (room dimensions form + "Open layout designer") ? no portal, no scroll hijack.
- **`dashboard-bootstrap.tsx` + `Dashboard_qa.tsx`:** Removed mandatory `InitialRoomModal`; dashboard header + left rail render immediately; canvas shows inline empty state until first room is added.
- **`market-dashboard-client.tsx`:** Zero-events path button label ? **Create New Market** (unchanged route `/coordinator/events/new`).
- **Verify:** Coordinator with a market but no rooms ? lands on dashboard shell (header, left panel) with inline "Set up your floor plan" ? not a blocking modal. Coordinator with zero markets ? centered empty state + Create New Market.

## Shipped this session (Square OAuth blank-page hardening, deployed 2026-06-09)
- **`lib/square/app-credentials.ts`:** `resolveSquareApplicationId()` now reads `NEXT_PUBLIC_SQUARE_CLIENT_ID` and `SQUARE_SANDBOX_CLIENT_ID` (sandbox) in addition to existing keys; rejects literal `"undefined"` / `"null"` strings.
- **`lib/square/connect-url.ts`:** `buildSquareOAuthAuthorizeUrl` validates `client_id`, `redirect_uri`, and `state` before building; `tryBuildSquareOAuthAuthorizeUrl` catches/logs failures instead of crashing the page.
- **`app/api/square/oauth/callback/route.ts`:** Top-level try/catch; safe redirect base from `NEXT_PUBLIC_APP_URL` or request origin (fixes `Invalid URL` crash when env unset); JSON 500 fallback when redirect impossible.
- **`app/coordinator/payment-methods/`:** Server uses `tryBuildSquareOAuthAuthorizeUrl`; wired `SquareConnectAlerts`, `SandboxSquareOAuthNotice`, and dev sandbox bypass panel.
- **`connect-button.tsx`:** Client-side authorize URL validation blocks navigation when `client_id`/`state` missing; logs to console.
- **Verify:** Coordinator ? Payment Methods ? with valid env, Connect button href includes non-empty `client_id`; with missing app id, inline config message (not blank page); OAuth callback errors redirect to `/coordinator/payment-methods?error=?`.

## Shipped this session (market wizard draft save RLS fix, deployed 2026-06-09)
- **Root cause:** Production wizard called `persistEventDraft` from the browser Supabase client. `coordinator_id` came from a server-rendered prop, but RLS requires `auth.uid() = coordinator_id` on the JWT attached to the insert ? a mismatch (or missing client session) triggers Postgres `42501`.
- **`lib/wizard/wizard-autosave.ts`:** `resolveCoordinatorIdForPersist()` reads the live session via `auth.getUser()` for direct client saves. Added `persistEventDraftViaApi()` so browser autosave posts to a server route. `persistEventDraft()` accepts `{ coordinatorId }` for server-verified writes with the admin client.
- **`app/api/coordinator/events/draft/route.ts`:** POST handler authenticates via cookie-backed `createClient()`, verifies coordinator role, checks draft ownership on update, then persists with `createAdminClient()` and explicit `coordinator_id: user.id`.
- **`components/coordinator/market-setup-wizard.tsx`:** Autosave / "Proceed to Capacity Settings" now calls `persistEventDraftViaApi` instead of a direct client-side `events` insert.
- **Verify:** Sign in as coordinator ? `/coordinator/events/new` ? complete Step 1 ? Continue ? Network shows `POST /api/coordinator/events/draft` 200 with `eventId`; no 42501 in response.

## Shipped this session (portal tab sync with patron routes, deployed 2026-06-09)
- **`lib/portals/active-portal.ts`:** Added `isPatronPortalPath()` for browse routes (`/discover`, `/favorites`, `/supplies`, `/events/*`, `/auctions/*`); `resolveActivePortal()` now prefers the current URL over the `active_portal` cookie on those paths so the Patron pill highlights correctly on `/discover` even when the cookie still says Coordinator/Vendor. Shared routes like `/wallet` still honor the cookie.
- **`lib/supabase/middleware.ts`:** Patron browse deep links sync the `active_portal` cookie to `patron` (same pattern as vendor/coordinator prefixed routes).
- **`lib/portals/qa-active-portal.ts`:** Updated assertions for discover + wallet behavior.
- **Verify:** Sign in as coordinator ? visit `/discover` directly ? Patron tab is active; switch to Coordinator ? lands on `/coordinator/dashboard`; `/wallet` keeps prior portal tab.

## Shipped this session (initial loader tagline ? Markets Made Easy, deployed 2026-06-09)
- **`components/brand/initial-loader-reveal.tsx`:** Tagline changed from "Plan ? Host ? Grow" to "Markets Made Easy"; extended SVG viewBox bottom padding, widened progress bar, reduced letter-spacing, and removed uppercase transform so the full phrase renders without clipping during the reveal animation.

## Shipped this session (Market Setup Wizard flyer upload fallback + toast, deployed 2026-06-09)
- **`hooks/use-flyer-scan.ts`:** Flyer parse failures log `console.warn` instead of throwing; JSON parse and `applyParsedFlyer` wrapped so the wizard stays interactive for manual entry.
- **`components/coordinator/flyer-parse-error-toast.tsx`:** Rose-themed top-right toast (`flex flex-row ? max-w-sm`) with ? dismiss and 5s auto-close via Sonner `toast.custom`.
- **`wizard-step-event-details.tsx`:** Removed full-step parsing overlay so Event name, Description, and Start date/time stay focusable while AI runs in the background (`FlyerCoverUpload` inline status only).

## Shipped this session (auto commit message in Deploy-popuphub.bat, deployed 2026-06-09)
- **`Sync-DeployCommitMessageArtifacts`:** Refreshes `REM Next commit (auto):` in `PM/Deploy-popuphub.bat` and `PM/deploy-commit-message.txt` whenever handoff updates or deploy runs ? no manual message editing.
- **`Deploy-popuphub.bat`:** Removed commit-message arg; double-click ships with auto-derived message from undeployed handoff sections.

## Shipped this session (deploy pipeline ? duplicate Vercel builds + commit message, deployed 2026-06-09)
- **`vercel.json`:** `git.deploymentEnabled.master/main: false` ? git push no longer triggers a production build; CLI `vercel deploy --prod` is the sole prod deploy path (fixes two builds per commit).
- **`scripts/get-deploy-commit-message.ps1`:** `Get-DeployCommitMessageFromHandoff` aggregates all `## Shipped this session (... , not deployed)` titles into the deploy commit message; `Mark-ShippedSectionsDeployed` flips them to `deployed yyyy-MM-dd` after handoff update.
- **`PM/Deploy-popuphub.bat`:** Removed stale hardcoded default message; omits `-Message` when arg 1 not passed so PowerShell derives message from session handoff.
- **`scripts/deploy-popuphub.ps1`:** Resolves commit message from handoff when `-Message` omitted; logs chosen message before commit.

## Shipped this session (Turf.js AutoArrangeEngine + canvas editor, deployed 2026-06-09)
- **`engine/AutoArrangeEngine.ts`:** `packBooths(roomPolygon, boothList)` ? shelf scan inside merged_zone; largest-first sort; **5? aisle** buffer; Turf `booleanPointInPolygon`, `booleanWithin`, `booleanOverlap` for room containment and collision with booths/stages/walls; unplaced booths ? off-canvas sentinel (`x/y = -999`).
- **`engine/BoothArrangementEngine.ts`:** `PackBooths()` now delegates to AutoArrangeEngine; perimeter wall orientation preserved post-pack.
- **`canvas/canvas-editor.tsx`:** **Auto-Arrange** button (inspector canvas panel when nothing selected).
- **`floor-plan-v2.tsx`:** `handleAutoArrange` ? `replaceObjects`; fixed `usePathfinding` hook order (TS2454).
- **Dependency:** `@turf/turf` added.
- **Verify:** `npx tsx scripts/verify-layout-pathfind.ts` ? 4/4 booths placed + path visits all.

## Shipped this session (floor-plan A* pathfinding, deployed 2026-06-09)
- **`PathfindingService.ts`:** Navigation grid from merged_zone / room boundary polygons (`buildNavigationGrid`); walkable cells inside boundary rings; booth/stage/wall impassable; A* with Euclidean heuristic f(n)=g(n)+h(n); nearest-neighbor TSP booth order; entrance/exit optional.
- **`hooks/use-pathfinding.ts`:** `usePathfinding(doc, roomId, { booths, roomBoundary, cellFt, enabled })` returns optimal path coordinates.
- **`canvas-overlays.tsx`:** Patron path rendered as dashed SVG `<polyline>` (`strokeWidth={2}`, `pointerEvents="none"`).
- **`floor-plan-v2.tsx`:** Wired hook after auto-layout; path stays in sync with doc edits while enabled.
- **Verify:** `npx tsx scripts/verify-layout-pathfind.ts` ? PackBooths + path visits all booths.

## Baseline
- Branch: `master` @ `1f12970` (pushed to `origin/master`)
- Production: https://popuphub.ca - **v1.107.0 build 1** | commit `19a2911` (handoff updated 2026-06-20 18:03)
- **Deploy script:** `PM/Deploy-popuphub.bat` [commit message] -> `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Stashed (not shipped):** `git stash` entry `loader WIP` - brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)


## Shipped this session (dynamic auth redirect base URL, deployed 2026-06-09)
- **`lib/url/public-app-url.ts`:** Added `getURL()` ? resolves origin from `NEXT_PUBLIC_SITE_URL` ? `NEXT_PUBLIC_APP_URL` ? `NEXT_PUBLIC_VERCEL_URL` / Vercel host envs ? browser origin ? `http://localhost:3000`; normalizes scheme and strips trailing slashes. Removed hardcoded `popup-hub.vercel.app` production fallback.
- **OAuth:** `getOAuthOrigin()` now uses live `window.location.origin` on any domain (including `popuphub.ca`); login/signup `signInWithOAuth` + signup `emailRedirectTo` use `buildOAuthCallbackUrl(getOAuthOrigin(), ?)`.
- **API:** `app/api/auth/callback/route.ts` resolves redirect origin from `x-forwarded-host` / `host` + `x-forwarded-proto` (or `request.url` origin) ? never env-based Vercel default; success redirect `${origin}${next}` default `/discover`.
- **`next.config.ts`:** Injected `NEXT_PUBLIC_APP_URL` via `getURL()` instead of hardcoded Vercel domain.
- **Manual (Supabase dashboard):** Set Site URL to `https://popuphub.ca`; add redirect wildcards `https://popup-hub.vercel.app/**`, `http://localhost:3000/**`.
- **Verify:** Set `NEXT_PUBLIC_SITE_URL=https://popuphub.ca` in Vercel production ? Google OAuth from popuphub.ca returns to `/api/auth/callback` on same origin.

## Shipped this session (vendor passport TikTok field, deployed 2026-06-09)
- **Migration `098_vendor_passport_tiktok.sql`:** `vendor_passports.tiktok_url` optional text column alongside `instagram_url` / `facebook_url`.
- **Forms:** TikTok input in Online presence (`/vendor/passport` wizard + `PassportSocialFields`); `normalizeTikTokUrl` coerces `@handle` / bare handle ? `https://tiktok.com/@handle` on save.
- **Public display:** `TikTokIcon` + `getPassportSocialLinks` renders TikTok on `PassportPublicCard` (and vendor link surfaces using shared social helpers).
- **Verify:** `/vendor/passport` ? enter `@mybrand` in TikTok ? save ? public passport card shows TikTok icon linking to `https://tiktok.com/@mybrand` in a new tab.

## Shipped this session (vendor passport story per-file captions, deployed 2026-06-09)
- **`passport-story-uploader.tsx`:** Replaced `PendingItem` with `StoryDraft` (`id`, `file`, `previewUrl`, `captionText`); vendors get per-story caption inputs in the upload queue with live preview overlay; publish sends each draft's `captionText` to `POST /api/passport/stories`.
- **Coordinator market promos:** Unchanged ? shared caption + hashtag rules still apply to the whole batch.
- **Verify:** `/vendor/dashboard` ? Passport stories ? queue 2+ files ? add different captions ? publish ? published list shows each caption.

## Shipped this session (admin console menu link, deployed 2026-06-09)
- **`buildAppMenuExtraLinks`:** Slide-out menu shows **Feature requests** + **??? Admin Console** (`/admin/feedback`) when `profile.is_admin`; wired in `AppNav` and `ShopperTopBar`.
- **Verify:** Sign in as admin ? open hamburger menu ? both links visible beneath Profile settings; non-admin sees neither.

## Shipped this session (admin feedback triage filters, deployed 2026-06-09)
- **`FeedbackAdminDashboard`:** Fourth metric card **Total Completed**; **Critical Urgency** excludes `status = completed`; incoming list hides completed rows; marking completed clears selection to next active item.
- **Verify:** Complete a ticket ? leaves triage list, completed count increments, critical count drops if applicable.

## Shipped this session (admin notified on feature request submit, deployed 2026-06-09)
- **Migration `099_feature_request_admin_notification.sql`:** `feature_request_submitted` notification type.
- **`notifyAdminsOfFeatureRequest`:** After `POST /api/feedback/submit`, inserts in-app notifications for every `profiles.is_admin` user; message includes role + urgency prefix (Critical / Blocked-workflow / New).
- **UI:** Notification feed icon (lightbulb), visible in all portal tabs; tap opens `/admin/feedback`.
- **Verify:** Migration `099` applied to remote Supabase (with `098`); deploy app code ? submit suggestion ? admin sees unread badge + notification; click ? `/admin/feedback`.

## Shipped this session (admin feedback route hardening + theme polish, deployed 2026-06-09)
- **Middleware:** `/admin/*` blocked unless `profiles.is_admin` or valid `ADMIN_SESSION_TOKEN` (`admin_session` cookie / Bearer header); non-admins redirect to role-appropriate dashboard via `accessDeniedRedirect`.
- **Layout + page:** Same gate with redirect (no blank page); header/back link use semantic `border-border`, `bg-card`, `bg-muted` tokens.
- **Dashboard:** Master-detail UI uses design tokens for dark/light (list cards, metric tiles, problem/solution blocks, role badges).
- **API:** `PATCH /api/feedback/update` unchanged ? saves `status` + `developer_notes` without page refresh.
- **Verify:** Non-admin ? `/admin/feedback` redirects to their portal home; admin (`is_admin`) ? triage console loads; PATCH save updates list + detail in place.

## Shipped this session (notification count portal filter fix, deployed 2026-06-09)
- **Root cause:** `useNotificationCount` counted all unread notifications for the user, while `NotificationList` filters by active portal (`filterNotificationsForPortal`). A user in Patron portal with an unread Vendor notification saw header "1 unread notification" but an empty feed.
- **Fix:** `notificationTypesForPortal()` in `lib/notifications/portal-filter.ts`; `useNotificationCount(userId, activePortal)` applies `.in('type', portalTypes)`; `AppNav` and `NotificationPageHeader` pass resolved `activePortal`.
- **Verify:** `npx tsc --noEmit` passes. Manual: switch portal tabs with cross-portal unread rows ? badge/subtitle should match visible list (or "You're all caught up" when filtered list is empty).

## Shipped this session (build + lint fixes, deployed 2026-06-09)
- **Lint:** `auto-arrange.ts` `prefer-const` (`let placed` ? `const placed`).
- **Compile:** Removed self-import in `lib/auth/rbac.ts` (`canActAsCoordinator` defined twice).
- **Types:** Wallet-topup null guard + `is_admin` select; `AccessProfile` loosened; `applyCoordinatorEventScope` simplified to avoid deep Supabase instantiation; dashboard revenue query inlined.
- **Toolbar:** Restored missing `case 'optimize'` for Auto-Arrange Floor Plan button.
- **Verify:** `npm run lint` (0 errors) and `npm run build` pass locally.

## Shipped this session (floor-plan canvas UX optimization, deployed 2026-06-09)
- **Room controls:** Sidebar **ROOM CONTROLS** ? undo, redo, rotate, delete, and copy icons in one horizontal row (`flex flex-row items-center gap-2 mt-2`) directly under the room picker; room rotate/join on a compact second row.
- **Placement preview:** Booth draw tool shows a semi-transparent cursor ghost (`opacity-40`) with predictive 2? wall snap + auto-rotation via `table-placement-preview.ts` and `PLACEMENT_PREVIEW_WALL_SNAP_FT`.
- **Toolbar compaction:** Patron/vendor size selectors use utility chip grids; auto-arrange **Pattern** row uses inline Grid / Staggered / Perimeter chips; sidebar section padding tightened.
- **Verify:** `/coordinator/dashboard` ? select vendor or patron table tool ? ghost follows cursor, snaps/flips near walls; room action icons stay on one line.

## Shipped this session (build verification ? local only, deployed 2026-06-09)
- **`npm run build`** passes on `master` @ `7c1654b` (TypeScript + static generation, build **46**).
- Prior Vercel prod failure (`51a871d`) was `b.category` on `BoothObject` in `request-ai-auto-arrange.ts` ? fixed on master as `b.categoryName`.
- Preview deploy `cursor/dev-environment-setup-4447` @ `8de61c8` also builds locally; Vercel log truncated after cache restore (likely stale cache / infra ? redeploy if still failing).

## Shipped this session (build fix ? local only, deployed 2026-06-09)
- **`geometry.ts`:** `placedObjectsOverlap` passes `ctx?.doc` (not whole `MergeOverlapContext`) to `collisionProbeForObject` ? fixes TS build failure.
- **`booth-access.ts`:** `EventAccessFields` uses `Pick<Event, ?>` so `venue_verification_status` matches `VenueGateEvent`.
- **`feature-request-modal.tsx`:** Select `onValueChange` guards against `null` before `setTargetComponent`.
- **`verify-vendor-wall-snap.ts`:** Added required `RoomFrame.name` field.
- **Verify:** `npm run build` succeeds (build **29**).

## Shipped this session (admin feature-request triage console, deployed 2026-06-09)
- **Migration `094_admin_feature_request_management.sql`:** `profiles.is_admin`; `feature_requests.status`, `developer_notes`, `updated_at`; admin RLS read/update policies.
- **Route `/admin/feedback`:** Layout + middleware gate on `profiles.is_admin` or `ADMIN_SESSION_TOKEN` cookie/header (`admin_session`); non-admins redirect to role-appropriate dashboard.
- **UI:** Master-detail dashboard ? metrics (Pending / Critical / Under Review), role + urgency badges, problem/solution preview, screenshot fullscreen dialog, status dropdown + developer notes, optimistic PATCH save.
- **API:** `PATCH /api/feedback/update` (admin-only).
- **Access:** `bradmulders@gmail.com` is sole platform **admin** (`is_admin` only ? not a market host, not a payment settlement account). Optional `ADMIN_SESSION_TOKEN` for headless API.
- **Platform fees (3% + $1):** **Square-only** for this operator ? card path ? Square `appFeeMoney` on the Popup Hub Square application (`thetipsyfoxyeg@gmail.com` / The Tipsy Fox). Offline path ? coordinators accrue `account_balances` (Stripe Checkout invoicing code exists but is unused/inactive for this operator). **Not** routed through coordinator Connect profiles; coordinator booth splits still go to each host's connected Square/Stripe.
- **Migrations `095`?`097`:** `platform_settings.platform_operator_id`, `platform_fee_email` (admin contact), `platform_square_email` (Square app owner); reverted mistaken coordinator promotion for operator login. Profile `a8356170-ac3b-4fd4-b59c-0efb39a00346`.
- **Script:** `npx tsx scripts/grant-platform-operator.ts` ? admin grant only.
- **Admin superuser (`is_admin`):** Bypasses role gates in middleware, portal switcher (Patron ? Vendor ? Coordinator), coordinator/vendor layouts, `canActAsCoordinator` APIs, and `assertEventCoordinator` / `applyCoordinatorEventScope` (view any market). Profile stays **vendor** ? not a market host. Nav menu ? **Feature requests** ? `/admin/feedback`.
- **Verify:** Sign in as `bradmulders@gmail.com` ? portal tabs show all three portals ? `/coordinator/dashboard` lists every market ? open another coordinator's event setup/ops ? `/admin/feedback` triage works without page refresh.

## Shipped this session (global feature-request module, deployed 2026-06-09)
- **`POST /api/feedback/submit`:** Multipart pipeline for title, role, target component, problem/dream copy, impact level, optional PNG/JPG screenshot (stored under `vendor-assets/{userId}/feature-requests/`).
- **`093_feature_requests.sql` + `094_admin_feature_request_management.sql`:** `feature_requests` table, user RLS, admin triage columns (`status`, `developer_notes`), `/admin/feedback` console.
- **Global entry points:** Navbar link + mobile menu item **Suggest an Improvement**; floating action button on patron/coordinator/vendor chrome (hidden on immersive viewport-fill routes like floor-plan canvas).
- **Modal UX:** Role-aware target dropdowns, required-field gating, drag-and-drop screenshot, success state **?? Idea Captured!**
- **Verify:** Sign in as coordinator/vendor/patron ? open suggestion modal from nav link or FAB ? submit ? row appears in `/admin/feedback` (admin profile).

- **Migration `092_venue_verification_and_vendor_invites.sql`:** `events` venue verification columns; `event_booth_slots` + `vendor_priority_invites`; `vendor_access_equality_until`; `priority_booth_invite` notification type.
- **Venue verification:** `lib/venues/verify-venue-coordinates.ts` + `POST /api/coordinator/venues/verify`; gates on wizard publish, event form, status toggle, spatial layout deploy, vendor apply, Square/Stripe booth payment.
- **Vendor Matches (no distance cap):** `lib/vendors/category-vendor-matches.ts` + dashboard sidebar **Vendor Matches** panel (`vendor-matches-panel.tsx`) with **Send Priority Invites**; `GET/POST /api/coordinator/events/[eventId]/priority-invites`.
- **Access phases:** 24h `priority_exclusive` window ? daily cron `vendor-priority-window-expiry` (7:00 UTC; Hobby plan limit) + lazy expiry on booth-access reads ? `public_release` + 90-day equal queue (`shouldDisableRankingPriorityForEvent` in FCFS queue).
- **Vendor UX:** `GET /api/vendor/events/[eventId]/booth-access`; apply-button badges (priority invite / opens to all / new-vendor-friendly).
- **Verify:** `npx tsx scripts/verify-venue-coordinates.ts`; `npx tsx scripts/verify-category-vendor-matches.ts`; `npx tsx scripts/verify-priority-window-expiry.ts`.

## Shipped this session (unified auto-arrange floor plan + traffic-flow prerequisites, deployed 2026-06-09)
- **`traffic-flow-prerequisites.ts`:** Validates perimeter-snapped Entry (`door`/`entrance`) + Exit (`emergency_exit` or `door`/`exit`) before optimization; exports door snapshots with coordinates, rotation, and wall edge.
- **`floor-plan-v2.tsx`:** Single `handleAutoArrangeFloorPlan` with `scope: 'all'` ? vendor + patron arranged in one pass; disabled until entry/exit prerequisites met.
- **`canvas-command-bar-blocks.tsx` + QA mirror:** New **`optimize`** toolbar block ? prominent **Auto-Arrange Floor Plan** button at top of sidebar **Floor Plan** section; separate vendor/patron auto-arrange controls removed.
- **`lib/floor-plan/ai-auto-arrange.ts` + `request-ai-auto-arrange.ts`:** Gemini 2.5 Pro payload includes entry/exit fixture geometry + `trafficFlow` loop hint (vendors face primary path, patron zones in low-velocity areas); deterministic fallback uses `autoArrangeInRoom` for `scope: 'all'`.
- **Verify:** Dashboard with no doors ? button disabled, hover tooltip: *Please place at least one Entry and one Exit door on your perimeter walls to optimize traffic flow.* Snap Door + Exit on walls, add booths/tables ? button enables ? one toast optimizes both asset types together.

## Shipped this session (floor-plan iron-dome + cyber-arcade fallback UI, deployed 2026-06-09)
- **`use-floor-plan-viewport-tier.ts`:** Iron dome ? `isPocketSizedViewport` when `width < 1024` **or** `height < 550` (blocks landscape phones, tablets, and short windows).
- **`floor-plan-viewport-advisory.tsx`:** Full-screen blueprint/cyber-arcade fallback (`bg-slate-950` grid, amber neon card, Ant-Man copy, pro-tip box); **Abort Mission & Go Back ??** uses `router.push` to event hub or `/coordinator/dashboard`.
- **Canvas:** Still fully unmounted when pocket-sized; tablet advisory banner removed (subsumed by iron dome).
- **Verify:** Phone portrait/landscape, iPad, and narrow windows ? fallback only; ?1024?550 desktop ? canvas loads.

## Shipped this session (mobile floor-plan gate exit + landscape phone block, deployed 2026-06-09)
- **`use-floor-plan-viewport-tier.ts`:** Tier detection uses width **and** height ? landscape phones (`height < 550`, short axis `< 600`) stay on the mobile block even when width exceeds 768px.
- **`floor-plan-viewport-advisory.tsx`:** Portal-mounted overlay at `z-[10001]` with working **Go back** `Link` (event hub when a market is selected, else `/coordinator/dashboard`); body scroll locked while blocked.
- **`Dashboard_qa.tsx`:** Skips initial-room modal while the mobile gate is active (was stacking above the overlay at `z-9999`).
- **`dashboard-toolbar-portal.tsx`:** Sidebar/tablet portal routing uses the same tier helper so landscape phones do not mount the tablet drawer layout.

## Shipped this session (dashboard floor-plan viewport tiers: mobile block + tablet layout, deployed 2026-06-09)
- **`hooks/use-floor-plan-viewport-tier.ts`:** Three-tier breakpoints ? mobile `<768`, tablet `768?1023`, desktop `?1024`; portrait detection for tablet advisory.
- **`floor-plan-viewport-advisory.tsx`:** `FloorPlanViewportLayoutProvider`, full-screen **Desktop Screen Required** overlay on phones, fixed portrait **Landscape Mode Recommended** banner on tablets.
- **`dashboard-tablet-tools-dock.tsx` + `dashboard-app-shell.tsx`:** Tablet rail ? 48px icon dock + sliding drawer for layout tools; grid `md:grid-cols-[3rem_1fr]` until `lg`.
- **`dashboard-toolbar-portal.tsx`:** Portals command bar into left rail on tablet (drawer) and desktop.
- **`Dashboard_qa.tsx`:** Canvas unmounted on mobile; portrait banner offset (`pt-11`) on canvas column.
- **`table-size-pill.tsx` + `command-button.tsx`:** Tablet touch padding on `5?`/`6?`/`8?` booth buttons; toolbar icons keep 48px targets through `lg`.
- **Verify:** `/coordinator/dashboard` ? phone shows desktop-required modal (no canvas); iPad portrait shows landscape banner + dock hamburger; iPad landscape / desktop unchanged full rail.

## Shipped this session (vendor 360? collision buffer, deployed 2026-06-09)
- **`vendor-booth-placement.ts`:** Vendor booths use 2? clearance on all four sides (6??4? ? 10??8? collision probe). Wall-snapped booths omit the rear buffer against the perimeter; left/right/front buffers remain.
- **`geometry.ts` / `checkCollision()`:** Expanded probes flow through `placedObjectsOverlap` with doc context for wall exception.
- **`auto-arrange.ts`:** Slot placement + obstacle rects use vendor collision probes; validation passes overlap context.
- **Canvas / pointer:** `mergeOverlapCtx` includes full doc slice for asymmetric wall probes.
- **Verify:** `npx tsx scripts/verify-vendor-booth-clearance.ts`

## Shipped this session (table rotation handle fix, deployed 2026-06-09)
- **Root cause:** Rotate handles lived under a `pointerEvents="none"` SVG group (clicks fell through to the grid/booth), and live vendor wall-snap during drag overwrote manual rotation whenever the booth stayed within 3? of a wall.
- **`canvas-overlays.tsx`:** Split `SelectionChrome` (non-interactive) + `SelectionRotateHandles` (interactive top layer with explicit `pointerEvents="auto"`).
- **`floor-plan-canvas.tsx`:** Render rotate handles **after** room selection overlay; removed debug `console.log`.
- **`canvas-grid.tsx`:** Grid layer `pointerEvents="none"` so it never intercepts transform handles.
- **`use-canvas-pointer.ts`:** Rotate/drag gestures mutually exclusive; rotate halt uses `rotatedAabb`; live vendor snap preserves non-cardinal manual rotation during drag (full orient snap still on pointer-up).
- **Verify:** Select vendor/patron table ? rotate handle visible above selection ? drag handle to rotate; manual angle persists when dragged away from walls.

## Shipped this session (vendor wall snap fix ? drag clamp + live snap, deployed 2026-06-09)
- **Root cause:** `boothClampDeltaForRoom` used 4? wall inset, preventing booths from entering the 3? snap zone; snapped positions then failed `footprintWithinBounds` (also 4?) and reverted on drop.
- **`boundary-constraints.ts`:** Vendor booths use 1? wall inset (`VENDOR_WALL_INSET_FT`); patron tables keep 4? clearance.
- **`use-canvas-pointer.ts`:** Live perimeter snap + rotation during drag (not only on pointer-up).
- **`vendor-booth-placement.ts`:** Snap distance measured against placement-surface bounds (union/merged rooms), not raw room frame only.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts` ? drag vendor within 3? of wall ? rear flush, faces inward; >3? ? no snap.

## Shipped this session (vendor wall snap + lateral clearance, deployed 2026-06-09)
- **`vendor-booth-placement.ts`:** 3? wall snap threshold with inward rotation (0/90/180/270?); lateral collision probe adds 2? per side (6??4? ? 10??4? effective).
- **`geometry.ts`:** `checkCollision()` / `placedObjectsOverlap` use lateral-expanded vendor probes.
- **`use-canvas-pointer.ts`:** Vendor snap on draw + drag commit (before overlap test); overlap blocks drop with red preview.
- **Verify:** Drag vendor booth within 3? of wall ? snaps flush, faces inward; place two booths <4? apart laterally ? blocked with violation styling.

## Shipped this session (vendor booth yellow canvas styling, deployed 2026-06-09)
- **`category-palette.ts`:** `VENDOR_BOOTH_PALETTE` ? fill `#FEF08A`, stroke `#EAB308`.
- **`canvas-objects.tsx` + QA mirror:** All vendor booths render solid yellow (status patterns retired; payment state via label text).
- **`placement-theme.ts` + `canvas-legend.tsx`:** Legend adds yellow **Vendor** swatch (`bg-yellow-200 ring-yellow-500`) synced with canvas.
- **Verify:** `/coordinator/dashboard` ? draw vendor booths ? yellow fill + amber border; legend top-right shows yellow **Vendor** chip.

## Shipped this session (Gemini auto-arrange + boundary physics + label clipping, deployed 2026-06-09)
- **`lib/ai/tasks.ts`:** New `auto_arrange_layout` task ? `google/gemini-2.5-pro` (fallback Claude 3.5 Sonnet).
- **`lib/floor-plan/ai-auto-arrange.ts` + `app/api/coordinator/auto-arrange/route.ts`:** OpenRouter optimization prompt (visibility, walkways, traffic flow); JSON placements returned to client.
- **`lib/floor-plan/request-ai-auto-arrange.ts`:** `runAutoArrangeWithAi` ? Grid/Staggered/Perimeter all route through Gemini first; deterministic engine fallback when API unavailable.
- **`lib/floor-plan/boundary-constraints.ts`:** Strict booth footprint validation + post-AI coordinate clipping inside room clearances.
- **`structural-wall-snap.ts` + `use-canvas-pointer.ts`:** Doors/exits snap flush to nearest perimeter wall with wall-aligned rotation on draw/drag.
- **`canvas-label-text.ts` + `canvas-objects.tsx`:** Dynamic font shrink + ellipsis for long labels ("Unassigned Vendor", "Patron", status pills).
- **`floor-plan-v2.tsx` + wizard QA mirror:** Async auto-arrange handlers with loading toast.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` (31/31); `npx tsx scripts/verify-ai-provider-fallback.ts` (26/26). Coordinator dashboard: vendor/patron Auto-Arrange with `OPENROUTER_API_KEY` ? success toast cites Gemini model; without key ? deterministic fallback. Draw door on room edge ? snaps flat to wall; drag booth past perimeter ? rejected.

## Shipped this session (dashboard floor-plan sidebar vertical stack, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** `getVisibleSidebarSections` / `getVisibleSidebarSectionsQa` ? four full-width blocks (Room Controls, Designer Tools, Patron Layout, Vendor Booths).
- **`canvas-toolbar-static.tsx` + `_qa`:** `sidebarLayout` renders stacked `SidebarToolbarSection` cards (no `grid-cols-2` split rows).
- **`dashboard-toolbar-portal.tsx`:** Portal host `flex flex-col gap-4 overflow-y-auto w-[300px] min-w-[300px] flex-shrink-0`.
- **`dashboard-app-shell.tsx` + `dashboard-bootstrap.tsx`:** Left rail fixed at 300px; **Full canvas** immersive mode keeps the left tools column (canvas expands, panel layout unchanged).
- **`floor-plan-v2.tsx`:** Dashboard always passes `sidebarLayout`; toolbar portals to left rail on desktop even in full canvas.
- **Verify:** `/coordinator/dashboard` ? four labeled sections stack vertically at 300px; toggle **Full canvas** ? left panel stays 300px with same section headers (no horizontal crush).

## Shipped this session (document scroll across portal pages, deployed 2026-06-09)
- **`portal-workspace-layout.tsx`:** `routeUsesViewportFill` is now an allowlist (command center, setup/layout wizards, experience designer) ? removed blanket `/coordinator/*` and vendor dashboard/applications locks that trapped scroll in the center column.
- **Vendor workspace:** `/vendor/events` and `/vendor/passport` included in the 3-column grid with `documentScroll` mode (same as supplies).
- **`scripts/verify-document-scroll-routes.ts`:** Smoke test for viewport-locked vs document-scroll routes.
- **Verify:** Scroll wheel works anywhere on vendor dashboard/applications/events/passport and coordinator payment-methods, event overview, applications board ? not only over list/card regions. Immersive routes (dashboard CAD, setup wizard, layout planner) still viewport-locked.

## Shipped this session (vendor supplies scroll fix, deployed 2026-06-09)
- **`site-app-shell.tsx`:** Non-viewport-fill routes use document scroll on `#site-main` (removed nested `overflow-y-auto`).
- **`portal-workspace-layout.tsx` + `command-center-shell.tsx`:** `/vendor/supplies` in vendor workspace grid; supplies uses `documentScroll` mode (no inner `overflow-y-auto` on center column).
- **`app/vendor/supplies/page.tsx`:** `min-h-screen w-full` page shell with horizontal padding.
- **`vendor-supplies-section.tsx`:** Grid/cards no longer use `h-full` height locks.
- **Verify:** `/vendor/supplies` ? scroll wheel works over header, search, filters, and side rails; not limited to the card grid.

## Shipped this session (vendor supplies setup-order sort, deployed 2026-06-09)
- **`lib/vendor/supplies-catalog.ts`:** Each curated item has a `setupOrder` integer (phases 1?5: shelter ? power ? merchandising ? POS ? takeaway). `filterVendorSupplies` sorts filtered results by `setupOrder` so the **All** tab follows chronological booth setup; category tabs still filter exclusively and inherit the same within-group order.
- **`scripts/verify-vendor-supplies.ts`:** Asserts All-view id sequence and booth-tab order.
- **Verify:** `/vendor/supplies` ? **All** shows tent ? weights ? table ? tablecloth ? extension cord ? lights ? display ? signage ? tools ? packaging; **Packaging** tab shows only kraft bags + tissue paper.

## Shipped this session (nav role switcher tab deck, deployed 2026-06-09)
- **`components/nav/portal-tabs.tsx`:** Patron / Vendor / Coordinator switcher styled as a rounded segmented track (`rounded-full`, muted stone track, inset shadow); active tab elevated white pill with forest text + market shadow; inactive tabs muted with hover lift.
- **`components/nav/app-nav.tsx`:** Role switcher grouped with vertical divider + gap before contextual nav links (Dashboard, My Passport, etc.) on `md+`.
- **Verify:** Sign in as vendor or coordinator ? header shows pronounced tab deck; active role pops above track; divider separates role block from page links on desktop.

## Shipped this session (Step 3 floor-plan layout ? sidebar + toolbar wrap, deployed 2026-06-09)
- **`floor-plan-v2.tsx` + `floor-plan-v2_wizard_qa.tsx`:** Wizard layout uses a viewport row (`flex-row`, `overflow-hidden`, `h-full` embedded / `h-[calc(100vh-64px)]` standalone) ? middle column holds wrapping command bar + scrollable canvas (`flex-1 max-w-full`); right properties panel fixed at `w-[320px] min-w-[320px] shrink-0 h-full`.
- **`canvas-command-bar.tsx` + `_qa`:** Non-static ribbon container uses `flex flex-wrap gap-2` so tool groups wrap instead of forcing one line.
- **`table-size-pill.tsx`:** Size chip rows use `flex-wrap gap-2` (was `flex-nowrap`).
- **`floor-plan-canvas.tsx`:** Canvas scroll host adds `min-w-0 max-w-full` so flex middle column can shrink without crushing the inspector.
- **Verify:** `/coordinator/events/[id]/setup?step=3` ? properties sidebar stays 320px readable; toolbar wraps on narrow widths; canvas pans/zooms in middle column only.

## Shipped this session (simplify populate caps UX, deployed 2026-06-09)
- **`smart-populate-booth-caps.tsx`:** Renamed panel to "Suggested category caps"; plain-language description; compact preview (max booths, usable floor, suggested split); technical breakdown collapsed under "How we calculated this"; button "Apply suggested caps"; hide venue dimension inputs when `venueReadOnly`.
- **`booth-planner.tsx`:** Canvas action renamed "Auto-arrange booths" (was "Smart Populate Layout"); simplified tooltip; max-booths copy in Step 2.
- **`wizard-step-capacity.tsx`, `spatial-layout-toolbar.tsx`, `layout-planner-stats.tsx`, `floor-plan-stats-panel.tsx`, `floor-plan-inventory-panel.tsx`:** Replaced C_max jargon with "Max booths" / plain language.
- **Verify:** Market setup wizard Step 2 ? apply suggested caps fills category editor; booth planner Step 3 ? "Auto-arrange booths" distinct from cap panel; event form still shows editable venue dims.

## Shipped this session (wizard venue map auto-pin on address, deployed 2026-06-09)
- **`components/coordinator/wizard/wizard-step-venue.tsx`:** Address side-effect listeners ? debounced geocode (400ms) plus immediate geocode on bulk fills (template, flyer OCR, paste); bootstrap geocode when Maps API loads with a pre-filled address; sync `lastGeocodedAddressRef` when parent drops pin (template/saved venue) to avoid duplicate lookups.
- **`components/map/map-recenter.tsx`:** After external coordinate/pin updates, trigger `resize` + `idle` refresh so Advanced Markers paint without requiring a map click; pan + zoom on first pin drop even when coords were set externally.
- **Verify:** `/coordinator/events/new` ? pick Edmonton venue template or upload flyer with address ? red pin appears and map pans immediately; type a full address manually ? pin updates after brief debounce.

## Shipped this session (sign-out redirect fix, deployed 2026-06-09)
- **`lib/auth/sign-out.ts` (new):** Shared `signOutAndRedirectToLogin()` ? sets intentional-signout flag, calls `supabase.auth.signOut()`, then `window.location.replace('/login')` for a clean login page without `redirectTo`.
- **`components/nav/app-nav.tsx` + `components/shopper/shopper-top-bar.tsx`:** Sign out menu actions use the shared helper instead of soft `router.push`.
- **`components/auth/auth-session-guard.tsx`:** Skips `redirectTo` query on intentional sign-out; falls back to plain `/login`.
- **Verify:** Sign in, open app menu ? Sign out ? lands on `/login` with no query params; no stuck protected-route error state.

## Shipped this session (flyer auto-detect quarter auction listing type, deployed 2026-06-09)
- **`lib/flyer/listing-type.ts` (new):** Maps AI `listing_type: "quarter_auction"` ? wizard `garage_yard_sale`; text fallback for "Quarter Auction" / "Live Auction".
- **`lib/flyer/parse-flyer-vision.ts`:** OpenRouter prompt adds `listing_type` with auction visual/text cues; quarter auctions forced to `single_day`.
- **`lib/flyer/apply-parsed-flyer.ts` + `market-setup-wizard.tsx`:** Flyer scan calls `handleListingTypeChange` so LISTING TYPE toggles to Quarter auction immediately.
- **Verify:** `/coordinator/events/new` ? upload quarter/live auction flyer ? Quarter auction segment selected; community market flyer unchanged.

## Shipped this session (flyer date extraction ? next occurrence + multi-day, deployed 2026-06-09)
- **`lib/flyer/normalize.ts`:** `resolveNextOccurrenceDate`, `parseMultiDayDateSpan`, and upgraded `normalizeFlyerDate` ? month/day without year rolls to next calendar year when already passed; stale/wrong years (e.g. 2006) re-resolve to current/next occurrence; parses "Oct 5-6" spans.
- **`lib/flyer/parse-flyer-vision.ts`:** OpenRouter/Gemini prompt now requests `schedule_type`, `start_date`, `end_date`; explicit multi-day span rules; dynamic current-year guidance; snake_case coercion + schedule normalization.
- **`lib/flyer/apply-parsed-flyer.ts` + types + `/api/parse-flyer`:** Multi-day flyer results set wizard `multi` schedule, populate `dayRows` via `buildDayRowsForDateRange`, and assign independent start/end dates.
- **`scripts/verify-flyer-date-normalize.ts`:** 7/7 pass.
- **Verify:** `/coordinator/events/new` ? upload flyer with "Oct 5-6" ? Multi-Day selected, 2026-10-05 / 2026-10-06; month-only date after today uses 2026, before today uses 2027.

## Shipped this session (discover date filters + Add to Calendar, deployed 2026-06-09)
- **`lib/shopper/discover-date.ts`:** New presets `this_week` and `this_month` for URL `when=` param.
- **`lib/shopper/events.ts`:** `getThisWeekEndDate`, `getThisMonthEndDate`, `filterEventsByDateRange` ? week runs today through upcoming Sunday; month runs today through end of calendar month.
- **`components/shopper/discover-screen.tsx` + `discover-date-filter.tsx`:** "This Week" and "This Month" buttons in WHEN row; date summary shows range labels.
- **`lib/shopper/calendar-export.ts`:** `buildEventCalendarPayload` ? event name, times, venue address, description with popuphub event URL.
- **`components/shopper/add-to-calendar-button.tsx` (new):** Touch-friendly button downloads `market-event.ics` via blob.
- **`discover-event-cards.tsx`:** Directions + Add to Calendar side-by-side on each card.
- **`event-action-bar.tsx`:** Event detail sticky bar uses ICS download (labeled on mobile, icon on desktop).
- **Verify:** `/discover` ? tap This Week / This Month; market cards show Add to Calendar; open `/events/[id]` on mobile ? calendar button downloads `.ics`.

## Shipped this session (discover page copy + flyer upload removal, deployed 2026-06-09)
- **`components/shopper/discover-screen.tsx`:** Removed "Have a flyer?" upload section; page title changed from "Discover Community Markets" to "Popup Hub Community Markets".
- **Removed:** `components/shopper/discover-flyer-upload.tsx`, `lib/shopper/parse-flyer-image.ts` (shopper-only flyer heuristic; coordinator flyer OCR unchanged).
- **Verify:** Open `/discover` ? no flyer upload card; heading reads "Popup Hub Community Markets".

## Shipped this session (initial loader logo clip + transparency fix, deployed 2026-06-09)
- **`components/brand/initial-loader-reveal.tsx`:** Restored full transparent `/popup-hub-brand.png` lockup (icon + wordmark); removed inner clip path that was cropping the logo during scale; `fitLogoInRing()` sizes by aspect ratio so the full mark fits inside the stall ring without overlap.
- **Verify:** Hard refresh ? full "Popup Hub" wordmark visible, no checkerboard/solid box behind logo, nothing clipped at bottom during fade-in.

## Shipped this session (initial loader perimeter + logo overlap fix, deployed 2026-06-09)
- **`components/brand/initial-loader-reveal.tsx`:** Perimeter stalls now skip corners (top/bottom rows inset between side columns; side count capped so sides do not overlap bottom row). Logo uses square `/popup-hub-icon.png`, sizes to inner ring bounds, clips to inner rect, and fades in only after stalls finish (progress 0.58+).
- **Verify:** Hard refresh `/` or login ? stalls form a clean ring with no corner overlap; logo glow and icon stay inside the ring during fade-in.

## Shipped this session (multi-instance Stage tool on layout designer, deployed 2026-06-09)
- **`lib/floor-plan/stage-placement.ts` (new):** Default 12?8? tap footprint and `nextStageLabel()` ? auto labels "Stage 1", "Stage 2", ? from existing `objects[]` count.
- **`use-canvas-pointer.ts` (+ wizard QA mirror):** Stage draw uses centered default footprint on click (like food trucks); each commit appends a new stage with incrementing label ? no replace/move of prior stages.
- **`canvas-objects.tsx`:** Stage outline-only rect (`fill="none"`), `cursor: move`, stroke stays visible when joined to a room perimeter.
- **`floor-plan-canvas.tsx` + `canvas-overlays.tsx`:** Selection overlay skips duplicate dashed box on stages; draft preview shows outline-only for stage placement.
- **Verify:** `npx tsx scripts/verify-canvas-state-smoke.ts` ? 27/27 pass. Smoke `/coordinator/dashboard` ? arm Stage in Designer Tools, click canvas repeatedly ? multiple labeled stages; select + drag + trash each independently.

## Shipped this session (sticky placement tools on dashboard canvas, deployed 2026-06-09)
- **`floor-plan-v2.tsx`:** `handleAfterDrawCommit` ? dashboard keeps draw tool armed after placement (clears selection only); wizard still reverts to Select. `stickyDrawPlacement={isDashboard}` on canvas.
- **`use-canvas-pointer.ts`:** `stickyDrawPlacement` option + hover ghost preview (`placementHoverRect` / `placementHoverKind`) between stamp clicks.
- **`floor-plan-canvas.tsx`:** Merges draft + hover preview for `DraftPreview`; crosshair cursor unchanged while draw tool armed.
- **Deactivation unchanged:** pointer/hand toolbar icons, different size/tool selection, `Escape` ? Select.
- **Verify:** `tsc --noEmit` clean; smoke `/coordinator/dashboard` ? arm vendor `6?`, click canvas repeatedly without re-selecting tool; ghost outline follows cursor between clicks.

## Shipped this session (layout designer sidebar row layout refactor, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** `STATIC_ROW_HEADERS`, `SIDEBAR_STATIC_ROW_SEGMENTS`, `getStaticRowSegments()` ? sidebar moves undo/redo left with room controls; tools + zoom right.
- **`canvas-toolbar-static.tsx` (+ QA):** Split headers ("Room Controls" | "Designer Tools", "Patron Layout" | "Vendor Booths"); `sidebarLayout` two-column grid with vertical divider; bare block clusters (no per-block border crush).
- **`canvas-command-bar.tsx` (+ QA):** Passes `sidebarLayout` into block context and static toolbar.
- **`canvas-command-bar-blocks.tsx` (+ QA):** Sidebar branches ? patron toggles-on-top + Grid dropdown; vendor 4-col size grid + Perimeter dropdown; primitives flex-wrap tool grid; zoom-only utilities.
- **`table-size-pill.tsx`:** `PatronSidebarControls`, `VendorSidebarSizeGrid`; vendor active sizes use `bg-forest`; patron sizes use violet.
- **`layout-room-bar.tsx`:** `sidebar` prop ? vertical stack: room picker, dimensions (`40? ? 40?`), add room, undo/redo sibling block.
- **Verify:** `tsc --noEmit` clean; smoke `/coordinator/dashboard` at lg+ ? left rail shows split headers, room column vs tool grid, patron/vendor divider with stacked controls.

## Shipped this session (OpenRouter AI gateway + task-based models, deployed 2026-06-09)
- **`lib/ai/tasks.ts` (new):** Central registry maps workloads ? OpenRouter models ? `flyer_vision` / `vision_json` ? Gemini 2.5 Flash; `chat_json` ? GPT-4o mini; `creative_layout` ? Claude 3.5 Sonnet; `creative_generation` ? Claude Sonnet 4. Per-task env overrides: `OPENROUTER_MODEL_<TASK>` / `OPENROUTER_MODEL_<TASK>_FALLBACK`.
- **`lib/ai/openrouter.ts` (new):** Server-side OpenRouter chat client (`openRouterChatForTask`) with quota/rate-limit fallback to each task's secondary model.
- **`lib/ai/generate-json-vision.ts`:** Vision JSON now routes exclusively through OpenRouter (no direct Gemini/Groq API calls).
- **`lib/ai/env.ts`:** `OPENROUTER_API_KEY` is the primary gateway; legacy `GEMINI_*` / `GROQ_*` keys deprecated.
- **`lib/flyer/parse-flyer-vision.ts`:** Flyer OCR uses task `flyer_vision`; `meta.source` is `openrouter` (or `heuristic` when key missing).
- **`lib/build-info.ts`:** `/version` payload adds `openRouterConfigured`; `geminiConfigured` now reflects any AI key. Env checks inlined (no `@/lib/ai/env` import ? `next.config.ts` loads this file before path aliases resolve).
- **Verify:** `npx tsx scripts/verify-ai-provider-fallback.ts` ? 22/22 pass. Set `OPENROUTER_API_KEY` on Vercel before deploy.
- **Not migrated:** Experience Designer still proxies to external Master Generator backend ? wire via `creative_generation` task when that service moves in-app.

## Shipped this session (flyer AI parse ? Gemini 2.5 Flash, superseded by OpenRouter task routing, deployed 2026-06-09)
- **`lib/ai/env.ts`:** Flyer vision always uses `google/gemini-2.5-flash` (override via `FLYER_GEMINI_MODEL_ID` only); global `GEMINI_MODEL_ID` default bumped to 2.5 Flash for other callers.
- **`lib/ai/generate-json-vision.ts`:** Optional `geminiModelId` per call so flyer parse can pin a model without affecting other vision callers.
- **`lib/flyer/parse-flyer-vision.ts`:** Uses `resolveFlyerGeminiModelId()`; strips markdown JSON fences before `JSON.parse`.
- **Verify:** Upload a flyer on market setup wizard Step 1 ? fields populate; API `meta.source` is `gemini`; check Vercel logs if `GEMINI_API_KEY` missing (falls back to Groq or filename heuristic).

## Shipped this session (wizard event name + description limits, deployed 2026-06-09)
- **`copy-audit.ts`:** `DESCRIPTION_MAX_LENGTH = 2000` (was 800 in UI defaults).
- **`wizard-ui.tsx`:** New `WizardLabeledInput` ? static label above field; Step 1 event name uses it instead of floating label inside the box. `WizardDescriptionField` default max 2000.
- **`wizard-step-event-details.tsx` (+ QA step1):** Event name * label sits above the input, matching description field layout.
- **`event-form.tsx`:** Description `maxLength` 2000.
- **Verify:** Market setup wizard Step 1 ? event name label outside input; description accepts up to 2000 chars with counter `?/2000`.

## Shipped this session (vendor booth size ? auto-arm draw tool, deployed 2026-06-09)
- **`canvas-command-bar-blocks.tsx` (+ QA):** Vendor booth size pills (`5?`, `6?`, `8?`, ?) now call `activateTableSize` instead of `onTableSizeChange` only ? sets size and arms the square/booth draw tool in one click; square icon highlights via existing `isTablePlacementActive('vendor')`.
- **Verify:** Smoke `/coordinator/dashboard` ? click a vendor size in VENDOR BOOTHS; square icon turns amber-active and cursor places booths at that size without a second click on the square tool.

## Shipped this session (layout designer sidebar ? merged control rows, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** Four accordion rows collapsed to two merged rows ? `room-tools` (Room Controls + Designer Tools) and `placement` (Patron Layout + Vendor Booths); legacy localStorage row ids migrate on load.
- **`canvas-toolbar-static.tsx` + `canvas-toolbar-static_qa.tsx`:** Split-row flex layout ? `lg:flex-row lg:justify-between` with vertical divider; left/right segments per row; wraps on medium viewports.
- **`canvas-command-bar.tsx` + QA mirror:** Passes `layoutCtx` for segment visibility (tools hidden until first room exists).
- **`canvas-command-bar-blocks.tsx` (+ QA):** Patron/vendor blocks use inline flex-wrap for side-by-side segment content.
- **Verify:** `tsc --noEmit` clean; smoke `/coordinator/dashboard` ? sidebar shows 2 rows (room+tools, patron+vendor) on lg; canvas gains ~2 accordion header heights.


## Shipped this session (layout designer 1? grid calibration, deployed 2026-06-09)
- **`canvas-grid-spacing.ts`:** Layout designer canvas always uses 1? minor cells + major line every 5? (`CANVAS_GRID_MAJOR_EVERY`); removed table-size-based 2? mesh that made 50? rooms span only 5 major (10?) blocks.
- **`floor-plan-v2.tsx`:** `canvasGridDocPatch()` keeps `gridSpacingFt` / `snapFt` at 1? on load and table-size changes so pointer snap matches the visual grid.
- **`floor-plan-canvas.tsx`:** Grid layer reads calibrated spacing (unchanged API; now always 1?/5?).
- **Verify:** inline `canvasGridSpacingForTableFt(5..20)` ? `minorFt === 1`; smoke `/coordinator/dashboard` ? 50? ? 50? Main Hall spans 50 minor subdivisions per edge; booth drop/snap unchanged at 1?.

## Shipped this session (deploy script streaming fix, deployed 2026-06-09)
- **`scripts/git-sync.ps1`:** `Invoke-NativeCommand` streams stdout/stderr line-by-line instead of buffering until process exit ? `vercel deploy` no longer appears hung for 3-6 minutes with no output.
- **`Invoke-VercelProdDeploy`:** Sets `CI=1`, disables telemetry, passes `--non-interactive` for Explorer/bat launches.
- **`deploy-popuphub.ps1` / `ship.ps1`:** Use helper + hint that remote build takes several minutes.

## Shipped this session (patron table dimension lock + layout rows, deployed 2026-06-09)
- **`floor-plan-v2.tsx`:** Left-panel table size controls update the next-draw template only (`defaultPlacementSpec`); they no longer patch selected/placed booths when the pill changes after a draw auto-selects the new object.
- **`use-canvas-pointer.ts` (+ wizard QA):** `commitDraft` snapshots booth footprint via `boothPatchForTableSize` at drop time (`width`, `height`, `tableLengthFt`, shape/purpose, vendor clusters).
- **`table-size-pill.tsx` + `canvas-command-bar-blocks.tsx` (+ QA):** New `PatronTableSizeRows` ? circle row and rectangle row (`flex-col` / `flex-nowrap`) with 5?/6?/8? size pills; toolbar block wrappers use full width.
- **Verify:** `npx tsx scripts/verify-canvas-state-smoke.ts` ? 23/23 pass.

## Shipped this session (initial room modal ? table size removed, deployed 2026-06-09)
- **`initial-room-modal.tsx`:** Removed vendor table size selector (`Vendor table size` label, `TABLE SIZE` grid, caption) from **Create your first room**; modal now only collects Width/Length (ft) + **Open layout designer**.
- **`dashboard-bootstrap.tsx` + `Dashboard_qa.tsx`:** `onConfirm(widthFt, lengthFt)` passes footprint only; `appendLayoutRoom` defaults `baseline_table_length_ft` to 6? (`DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT`).
- **Verify:** `npx tsx scripts/verify-table-size-default.ts` ? 19/19 pass; `tsc --noEmit` clean. Smoke: `/coordinator/dashboard` on event with no saved rooms ? modal shows dimensions only; canvas opens with 6? baseline; table size changeable from designer toolbar.

## Shipped this session (tooltip height stretch fix, deployed 2026-06-09)
- **`components/coordinator/tooltip-wrapper.tsx`:** Anchor uses `relative inline-flex h-auto w-fit self-start` so flex toolbars no longer stretch the positioning box to full row height; bubble gets explicit `h-auto w-max`. Optional `className` prop (e.g. `w-full` for catalog rows).
- **`components/ui/tooltip.tsx`:** `TooltipTrigger` and `TooltipContent`/`Positioner` constrained with `h-auto w-fit self-start` ? HelpCircle triggers no longer inherit flex cross-axis stretch.
- **`wizard-filter-tooltip.tsx`**, **`tooltip-wrapper_qa.tsx`**, map pin tooltips (`wizard-step-venue*.tsx`): same anchor/bubble sizing guards.

## Shipped this session (vendor table size selector ? modular presets, deployed 2026-06-09)
- **`lib/booth-planner/layout-table-size.ts`:** Replaced single-dimension sizes (7?/9? removed) with modular vendor presets: 5/6/8? singles plus 10/12/15/16/18/20? combined footprints (`VENDOR_TABLE_SIZE_OPTIONS`).
- **`components/coordinator/table-size-selector.tsx`:** 3?3 grid with modular sub-labels `(5??2)` etc.; used by wizard capacity step and booth planner (not initial room modal).
- **`table-cluster-layout.ts` + `table-booth-consolidation.ts` + `use-canvas-pointer.ts`:** Contiguous multi-table clusters on draw/resize; geometry uses total length ? 2? depth.
- **`canvas-objects.tsx`:** Vertical dividers between sub-tables in clustered vendor booths.
- **Verify:** `npx tsx scripts/verify-table-size-default.ts` ? 19/19 pass; `tsc --noEmit` clean.

## Shipped this session (discover page scroll fix, deployed 2026-06-09)
- **`components/shopper/shopper-shell.tsx`:** Removed viewport-locked nested scroll (`min-h-[100dvh]` + `main` `overflow-y-auto` / `min-h-0` / `flex-1`). Browse routes (`/discover`, `/favorites`, etc.) now use `min-h-screen` and natural document scroll so footer and expanded flyer content are reachable.


## Shipped this session (layout merge engine ? polygon union, deployed 2026-06-09)
- **`src/utils/layoutMergeEngine.ts` (new):** `polygon-clipping` boolean union for room + stage; `unionLayoutParticipants`, `computeRoomStageUnion`, `resolvePerimeterUnionRingForRoom`, `runPatronPerimeterLayout` / `runVendorPerimeterLayout` (zero API tokens).
- **`room-union-merge.ts` + `geometry-sanitize.ts`:** Destructive merge stores multi-vertex `perimeterRing` (L-shapes preserved, not AABB-only).
- **`placement-surface.ts`:** Auto-unions touching stages into placement outer ring for perimeter auto-arrange.
- **`room-frames.tsx` + `canvas-objects.tsx` + `Canvas_qa.tsx`:** Unified perimeter path rendering; inner connecting wall suppressed on dissolved stages.
- **`floor-plan-v2.tsx`:** Dashboard perimeter auto-arrange routes through `layoutMergeEngine`.
- **`Dashboard_qa.tsx`:** Re-exports patron/vendor perimeter layout helpers.
- **Verify:** `npx tsx scripts/verify-layout-merge-engine.ts` ? 6/6 pass.


## Shipped this session (AI Theme Wizard removed, deployed 2026-06-09)
- **Removed:** AI Theme Wizard UI (`ai-generation-guardrails_qa.tsx`), OpenRouter proxy (`lib/ai/openrouter.ts`, `app/api/coordinator/ai-theme-layout/route.ts`), spatial codec (`spatialCompressor.ts`, `aiTokenGuard.ts`), verify script, and `js-tiktoken` dependency.
- **`Dashboard_qa.tsx`:** Left rail is toolbar portal only; `QaAccordionHeader` kept for canvas toolbar QA typography.
- **Kept:** `layoutMergeLocal.ts` + `floor-plan-v2.tsx` local merge validation (RBush, no AI).


## Last deploy
- 2026-06-20 17:24 - Deploy via deploy-popuphub.ps1 - `feat: ship local changes` (35843fd)


## Goal
**Native mobile apps (iOS first, Android later)** ? wrap the existing Next.js product for App Store distribution, then Play Store. Apple Developer Program account is enrolled (2026-06-08); Android follows after iOS TestFlight / App Store path is proven.

**Web (ongoing):** UX + QA dashboard wiring ? layout animation, mobile polish, booth pricing inputs, QA dashboard live on `/coordinator/dashboard`. Login QA Jurassic Park lockout shipped to prod (build 163).

### Native mobile ? current baseline
- **Web stack:** Next.js App Router on Vercel (`https://popuphub.ca`); PWA already ships (`public/manifest.json`, service worker, `use-install-prompt` iOS/Android coaches).
- **Apple:** Developer account active ? can create App ID, certificates, provisioning profiles, and App Store Connect listing.
- **Android:** Not started; defer until iOS shell + review flow validated.
- **Shell:** **Capacitor 7** ? `capacitor.config.ts`, bundle id `ca.popuphub.app`, loads `https://popuphub.ca` via `server.url` (v1 remote web app; see `mobile/README.md` tradeoffs).
- **Repo layout:** `mobile/www/` fallback shell, `ios/` Xcode project (generated), `scripts/mobile/` asset + sync helpers, `PM/ios-testflight.md` internal TestFlight checklist.
- **npm scripts:** `mobile:assets`, `mobile:sync`, `mobile:ios:open`, `mobile:ios:add`.
- **OAuth URL scheme:** `ca.popuphub.app://auth/callback` patched into `ios/App/App/Info.plist` ? add same redirect in Supabase Auth before TestFlight sign-in smoke.

## Shipped this session (discover map scope copy, deployed 2026-06-09)
- **`components/markets/distance-radius-picker.tsx`:** Active ?everywhere? banner now reads `Showing Popup Hub markets everywhere` (clarifies platform-registered markets only).

## Shipped this session (major version bump, deployed 2026-06-09)
- **`package.json` / `build-number.json` / `package-lock.json`:** Major version `0.1.0` ? `1.0.0`; build counter reset to `1` (footer display: `v1.0.1 ? build 1`).
- **`PM/ios-testflight.md`:** Version table updated to `1.0.0`.

## Shipped this session (footer copyright removed, deployed 2026-06-09)
- **`components/brand/build-version-footer.tsx`:** Removed `? {year}` from global footer; line now reads `Popup Hub ? v{version} ? build {n} ? {commit}` (version/build/commit unchanged).

## Shipped this session (legal contact email update, deployed 2026-06-09)
- Replaced `legal@popuphub.app` with `thetipsyfoxyeg@gmail.com` in `components/legal/legal-document.tsx` (About + all legal page footers), `app/legal/terms/page.tsx`, and `lib/legal/faq-content.tsx`.

## Shipped this session (About Us + FAQ fee transparency, deployed 2026-06-09)
- **`app/legal/about/page.tsx` (new):** Full Popup Hub story ? founders, fee breakdown (patrons/vendors/coordinators), trust/honesty policy, discovery vision.
- **`lib/legal/about-content.ts` (new):** Section copy for the About page.
- **`lib/legal/faq-content.tsx`:** Converted from `.ts` to support React answers; added middle-positioned **How much does Popup Hub cost?** (pricing + bypass rules) and **Why does Popup Hub charge fees?** (summary linking to `/legal/about`).
- **`lib/legal/links.ts`:** Footer nav includes **About Us**.
- **`app/legal/faq/page.tsx`:** Updated last-modified date; intro links to About Us.
- **Build fix:** QA floor-plan canvases (`floor-plan-canvas-wizard_qa.tsx`, `floor-plan-canvas_dashboard_qa.tsx`) synced to unified `SelectionOverlay` (removed obsolete `layer="outline"|"controls"` props). `npm run build` passes (build 177).

## Shipped this session (wizard Step 1 layout + venue/map reactivity, deployed 2026-06-09)
- **`wizard-ui.tsx` / `globals.css`:** Floating textareas `pt-6`; description + labeled textareas use static labels with counters in a flex row below the field (never inside the input).
- **`venue-places-autocomplete_qa.tsx`:** Wizard floating-label inputs (`placeholder=" "`) with bidirectional `place_changed` sync + `useEffect` DOM mirror for sibling/map updates.
- **`wizard-google-place-select_qa.ts`:** `fromMapGeocode` flag ? map click reverse-geocode fills venue name + address + pin without preserving stale typed venue draft.
- **`wizard-step-venue_predictive_search.tsx`:** Map click uses `resolveVenueNameFromMapGeocode` + `formatPlaceAddress`; shared `PlaceResult` type.
- **`map-recenter.tsx`:** Re-pans and re-zooms when pin moves (autocomplete, template, or map click).
- **`google-place-venue.ts`:** `resolveVenueNameFromMapGeocode` helper.

## Shipped this session (auto-layout & patron pathfind, deployed 2026-06-09)
- **`engine/BoothArrangementEngine.ts` (new):** `PackBooths()` ? greedy MaxRects guillotine bin-packing inside merged_zone / placement surfaces with **5? aisle** constraint; orients booths toward nearest perimeter wall via `rotationForPerimeterEdge`.
- **`engine/PathfindingService.ts` (new):** `CalculateOptimalPath()` ? custom lightweight A* on a walkability grid (booths + stages impassable); nearest-neighbor booth order; entrance ? all vendor booths ? exit.
- **`floor-plan-v2.tsx`:** Inspector action **Auto-Layout & Pathfind** ? clears vendor booth coords, packs, pathfinds, `replaceObjects`, stores path for overlay.
- **`canvas-overlays.tsx`:** `PatronTrafficPathOverlay` ? semi-transparent dotted sky-blue polyline.
- **`property-inspector.tsx`:** Sidebar button when no selection is active.
- **Verify:** `npx tsx scripts/verify-layout-pathfind.ts` ? 3/3 pass.

## Shipped this session (Google Places venue/address autocomplete fix, deployed 2026-06-09)
- **`venue-places-autocomplete_qa.tsx`:** Removed `placesReady` from input `key` ? remounting after Places loaded detached Google Autocomplete from the live input (predictions never appeared).
- **`wizard-step-venue.tsx`:** `APIProvider` now passes `libraries={['places']}` (parity with event form + QA provider).

## Shipped this session (canvas geometry revert ? pointer capture / blue mask, deployed 2026-06-09)
- **`floor-plan-canvas.tsx` (`LayoutCanvas`):** Reverted viewport-lock framing (`useCanvasViewportFraming`, `fitViewportToContent`, `contentFramingBounds`); restored pre-resize `frameActiveRoom` + scroll-container ResizeObserver; simplified `onPointerDown` (no capture swallow); added temp `console.log('Canvas Interaction State:', e.target)` on `onMouseDown`; single `SelectionOverlay` pass (no split outline/controls layer).
- **`canvas-overlays.tsx`:** Reverted object resize handles + dimension labels (removed `pointerEvents="all"` resize hit targets).
- **`canvas-objects.tsx`:** `merged_zone` render ? `fillOpacity={0}` (decorative mask no longer tints rooms blue/teal); layer stays `pointerEvents="none"`.
- **`canvas-grid.tsx`:** Grid layer `pointerEvents="auto"` so clicks reach the surface.
- **`geometry-sanitize.ts`:** Reverted stricter `isValidPlacementLocationBBox` (centroid-only gate) ? restores placement behavior consumed by `use-floor-plan-doc.ts` `isValidPlacementLocation`.
- **`use-floor-plan-doc.ts`:** No direct diff (unchanged since `a2e5286`); placement gate fix is via `geometry-sanitize` import.

## Shipped this session (event setup checklist reorder, deployed 2026-06-09)
- **`event-readiness-checklist.tsx`:** Reordered steps ? Square + booth layout now precede "Event published"; quarter auction step only when `listing_type` is quarter auction (`garage_yard_sale` via `isQuarterAuctionListing`).
- **`app/coordinator/events/[id]/page.tsx`:** Quarter Auctions panel and header Auctions link hidden for standard community markets.

## Shipped this session (layout canvas viewport init + 100% zoom, deployed 2026-06-09)
- **`use-layout-viewport.ts`:** `VIEWPORT_FIT_PADDING_PX` (40px safe-zone); `fitViewportToContent` returns target zoom and prefers pixel padding for baseline framing.
- **`use-viewport.ts`:** `fitToBounds` accepts `paddingPx`; tracks `baselineZoom` (100% toolbar readout); `getBaselineZoom()` exposed on `ViewportApi`.
- **`use-canvas-viewport-framing.ts` (new):** `ResizeObserver` on the layout background host; initial fit in `useLayoutEffect`; re-fit on container resize (toolbar/window/inspector).
- **`floor-plan-canvas.tsx`:** Container + scroll-host split (`scrollHost` prop); removed one-shot-only resize skip; normalized zoom readout via baseline; production host uses `absolute inset-0`.
- **`floor-plan-canvas-wizard_qa.tsx`:** Synced with production fit math; removed conflicting canvas-centre scroll effect; spatial layout uses `scrollHost` + `h-full overflow-auto` (wizard embedded keeps page-scroll QA classes).
- **`floor-plan-v2.tsx` / `floor-plan-v2_wizard_qa.tsx`:** Zoom reset + viewport reset call `fitViewportToContent` (100% = fit with 40px pad); canvas host `flex flex-col min-h-0 h-full`.

## Shipped this session (canvas viewport fit-to-content, superseded by padding/resize pass above, deployed 2026-06-09)
- **`use-layout-viewport.ts`:** `contentFramingBounds`, `fitViewportToContent`, `VIEWPORT_FIT_PADDING` (0.125 ? ~75% viewport fill). Replaces hard-coded zoom-1 / canvas-centre resets.
- **`floor-plan-canvas.tsx`:** Framing runs in `useLayoutEffect` before paint; zoom anchor uses active room centroid (not full canvas centre); removed conflicting canvas-dimension scroll centering that fought `fitToBounds`.
- **`use-canvas-workspace.ts` / `floor-plan-v2.tsx`:** `resetCanvasViewport`, `ensurePlaceableDocument`, and Center View fallbacks call `fitViewportToContent` instead of `resetViewport()`.

## Shipped this session (portal route sync, deployed 2026-06-09)
- **Active portal resolution (`lib/portals/active-portal.ts`):** Portal-prefixed routes (`/coordinator/*`, `/vendor/*`) now override the `active_portal` cookie in `resolveActivePortal` so top nav tabs match the URL (Option A sync).
- **Middleware (`lib/supabase/middleware.ts`):** Auto-sets `active_portal` cookie when visiting coordinator or vendor routes the account may access.
- **Coordinator + vendor layouts:** Server-side cookie sync on portal route entry as a belt-and-suspenders guard.
- **Workspace chrome (`portal-workspace-layout.tsx`):** MARKET OPS sidebar / telemetry panels only render when route prefix matches the workspace portal prop.
- **QA:** `lib/portals/qa-active-portal.ts` ? 5 assertions for route/cookie precedence.

## Shipped this session (Capacitor iOS shell, deployed 2026-06-09)
- **Capacitor 7 deps:** `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/splash-screen`, `@capacitor/status-bar`.
- **`capacitor.config.ts`:** App id `ca.popuphub.app`, prod URL `https://popuphub.ca`, `allowNavigation` for Supabase/OAuth/Stripe/Square domains, splash + status bar brand colors (`#faf8f5` / `#2d5a27`).
- **`mobile/www/index.html`:** Offline fallback + brand PNG; redirects to `/discover` when loaded from `capacitor:` scheme.
- **`ios/` Xcode project:** Added via `npx cap add ios`; AppIcon + Splash asset catalog populated from `public/icons/icon-512x512.png`.
- **`scripts/mobile/generate-ios-resources.mjs`:** Copies brand assets, writes iOS icons/splash, merges OAuth URL scheme into Info.plist.
- **`scripts/mobile/sync-ios.ps1`:** `mobile:assets` + first-run `cap add ios` + `cap sync ios`; optional `CAPACITOR_SERVER_URL` for preview/local HTTPS.
- **Docs:** `mobile/README.md` architecture + Mac workflow; `PM/ios-testflight.md` App Store Connect + internal TestFlight smoke checklist.
- **Verify (Windows):** `npm run mobile:sync` completes; Mac still required for archive/upload.

## Shipped this session (prod build 163, `6222d13`)
- **Login QA Nedry lockout playback fix (`Login_qa.tsx`):** Always-mounted portal video preloads `/assets/nedry_magic_word.mp4`; Sign-in click primes audio before async auth; lockout triggers unmuted `play()` (+ muted retry); GIF+audio fallback at `/assets/nedry.gif` when video codec fails.
- **Login QA Nedry lockout trap (`Login_qa.tsx` + `login-lockout_qa.ts`):** Login form hidden until countdown reaches `0:00`; lockout persisted in `sessionStorage` across refresh/return to `/login`; browser back + `beforeunload` blocked during lockout; countdown shown as `M:SS`.
- **Deploy script (`deploy-popuphub.ps1`):** Clears stale `.next/lock` before build ? fixes `Another next build process is already running` when dev server left a lock behind.
- **`Deploy-popuphub.bat` version tracking:** Header comment block documents floor-plan release track (object resize, measurements, viewport lock, layout fixes), prod baseline (build 155 / 7db76c6), `BUMP_BUILD_NUMBER=1` init, 5-step pipeline, optional `verify-canvas-state-smoke` / `verify-multi-room-canvas` / `verify-align-and-center` pre-flight.
- **Login QA wired to `/login`:** `app/(auth)/login/login-form.tsx` re-exports `LoginQa` ? lockout + logo scale now live on `/login` and embedded signup login panel.
- **Login QA Jurassic Park lockout (`Login_qa.tsx`):** Portal to `document.body` at `z-[9999]`; fullscreen takeover on 3rd Supabase auth failure; `public/assets/nedry_magic_word.mp4` (video+audio, loop) with `public/assets/nedry.gif` fallback; always-mounted preload video primes audio on Sign-in click, then `play()` on lockout (unmuted with muted retry); **build fix:** Turbopack cannot `import` `.mp4` ? serve from `/assets/` not module import.
- **Login QA logo scale (`Login_qa.tsx`):** Popup Hub wordmark `<img>` clamped to `w-44 h-auto object-contain mx-auto mb-4` (`/popup-hub-logo.png`).
- **Login QA lockout helpers (`login-lockout_qa.ts`):** Trimmed credentials + client validation; local-only password visibility toggle; strike/cooldown math. Legacy pixel CSS (`login-lockout_qa.css`) unused after video overlay ? safe to delete on promotion cleanup.
- **QA dashboard wired:** `market-dashboard-client.tsx` ? `DashboardBootstrapQa`; `floor-plan-v2.tsx` ? `CanvasCommandBarQa`.
- **AI Theme Wizard (removed):** Former `ai-generation-guardrails_qa.tsx` + OpenRouter path deleted; local merge (`layoutMergeLocal.ts`) retained.
- **Initial loader:** Computed uniform perimeter tables; removed dashed ring; logo fades into geometric ring center (`ringCenterX` / `ringCenterY` in `initial-loader-reveal.tsx`).
- **Branding:** `PopupHubIcon` deprecated ? full `popup-hub-brand.png`; sidewalk dash line removed from replay loader.
- **Mobile footer/nav:** `globals.css` scales `.popup-hub-chrome-footer` to **67%** on ?767px; `shopper-bottom-nav` + main padding `2rem`; install prompt bottom offset aligned.
- **Room modal:** Portaled to `document.body`, `z-[9999]`, body scroll lock while open, `data-testid="initial-room-modal"`.
- **Booth pricing UX:** Focus-aware sync in `market-booth-pricing-fields.tsx`; category fee rows use text + placeholder (`category-limit-editor.tsx`).
- **Canvas draw/select (wizard QA):** `use-canvas-pointer-wizard_qa.ts` ? draw-tool hits select/drag existing objects instead of stacking.
- **Patron-first / supplies / instant book:** Already in tree ? `/discover` default, `/supplies` Market Supplies, `verify-instant-book-category-limits.ts` 4/4.

## Shipped this session (vendor clearance, deployed 2026-06-09)
- **Vendor auto-arrange spacing:** `BOOTH_PLACEMENT_GAP_FT` restored to **4?** edge-to-edge (2? safety buffer per side via `BOOTH_SAFETY_BUFFER_FT` / `BOOTH_CORE_SEPARATION_CELLS` in `layout-clearance-constants.ts`). Grid column pitch, row-pack fallback, and deterministic layout `tableEdgeGapFt` all honor the 4? gap; adjacent vendor tables no longer pack flush.
- **`validateClearances`:** Pair-aware minimum gaps ? vendor?vendor 4?, patron?patron 2?, vendor?patron 4?.
- **`patron-centric-layout.ts`:** Local edge clearance synced to 2? per side.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` ? 31/31 pass.

## Shipped this session (QA Step 3 Add room clipping fix, deployed 2026-06-09)
- **`qa-scroll-layout_qa.ts` + `Canvas_qa.tsx`:** Added `QA_STEP3_CONTENT_CLASS` (`flex flex-col h-full overflow-y-auto`), `QA_ADD_ROOM_FORM_CLASS` (`relative z-10`); canvas constants use `flex-grow` instead of fixed viewport height.
- **`floor-plan-v2_wizard_qa.tsx`:** Step 3 inner column uses `QA_STEP3_CONTENT_CLASS`; canvas host drops `min-h-[min(480px,50vh)]` trap; `LayoutCanvasWizardQa` gets `flex-grow`.
- **`canvas-command-bar-blocks_qa.tsx`:** Embedded `LayoutRoomBar` (Add room width/length inputs) wrapped in `QA_ADD_ROOM_FORM_CLASS` so it stacks above canvas overlay.
- **`globals.css`:** `.layout-planner-root-qa` overrides unlock `FullscreenLayout` + `.floor-plan-canvas-host` ? `overflow-y-auto` on editor shell, `flex-grow` + `overflow: visible` on canvas host (replaces prod `overflow-hidden` / `height: 100%` trap for Step 3).

## Shipped this session (QA global scroll unification, deployed 2026-06-09)
- **`layout-planner-shell_qa.tsx`:** QA wizard Step 3 shell ? no `useLayoutCanvasViewportLock`, no nested `overflow-hidden`; content flows at natural height.
- **`qa-scroll-layout_qa.ts`:** Shared `QA_GLOBAL_PAGE_SCROLL`, `QA_CANVAS_VIEWPORT_CLASS`, `QA_CANVAS_CONTAINER_CLASS` ? content-sized canvas, no fixed viewport height.
- **`wizard-step-floor-plan_qa.tsx`:** Uses `LayoutPlannerShellQa`; floor plan column is `w-full flex-1` (no `h-full min-h-0` trap).
- **`floor-plan-v2_wizard_qa.tsx`:** Removed nested overflow / `basis-0` / `h-full` on canvas host; wizard canvas is `relative w-full`; inspector panel no longer scrolls internally.
- **`floor-plan-canvas-wizard_qa.tsx` + `floor-plan-canvas_dashboard_qa.tsx`:** Canvas host `overflow-visible h-auto`; wheel without Ctrl passes through to page scroll; Ctrl+wheel zoom unchanged.
- **`Dashboard_qa.tsx`:** Left rail + canvas column no longer fixed to `100vh-64px` or `overflow-y-auto`; shell uses `dashboard-app-shell--qa-global-scroll`.
- **`canvas-command-bar_qa.tsx`:** Sidebar toolbar `overflow-visible` (accordions expand page height).
- **`globals.css`:** `.layout-planner-root-qa` + `.dashboard-app-shell--qa-global-scroll` overrides ? `#site-main` and `.setup-wizard-body` are the sole vertical scroll hosts.
- **`events/new/page.tsx` + `market-setup-wizard.tsx`:** Dropped `overflow-hidden` / `min-h-0` traps on Create New Market Step 3 path.

## Shipped this session (wizard Step 1 field layout + Places sync, deployed 2026-06-09)
- **`wizard-ui.tsx`:** `WizardDescriptionField` (static label + counter row below); `WizardLabeledTextarea` for optional multi-line fields; floating inputs/textareas always use `placeholder=" "` (ignore consumer placeholder); textarea uses `field-sizing-fixed`; `--filled` triggers on any non-empty value.
- **`globals.css`:** Textarea floating-label padding increased (`pt-8 pb-3`); textarea label rest/active positions tuned; `:placeholder-shown` rule extended to textarea variant.
- **`wizard-step-event-details.tsx`:** Description ? `WizardDescriptionField`; raffle ? `WizardLabeledTextarea`.
- **`venue-places-autocomplete.tsx` + `use-google-places-autocomplete-widget.ts` (new, prod):** Google `Autocomplete` widget on both venue name and address; `place_changed` only syncs sibling field + map pin (no typing loops).
- **`wizard-google-place-select.ts` + `wizard-place-types.ts` (new, prod):** Two-way sync ? venue pick fills address + pin; address pick fills distinct venue name (via `resolveVenueNameFromAddressPick`) + pin.
- **`wizard-step-venue.tsx`:** Replaced custom address typeahead + plain venue input with dual `VenuePlacesAutocomplete`; removed ~250 lines of duplicate prediction UI.
- **`market-setup-wizard.tsx`:** Wired to production venue step + place-select lib (was QA imports).

## Shipped this session (wizard Step 1 description layout, deployed 2026-06-09)
- **`wizard-ui.tsx`:** New `WizardDescriptionField` ? static `WIZARD_FIELD_LABEL` above textarea; character counter + helper copy in a flex row below the input (counter right, helper left).
- **`wizard-step-event-details.tsx`:** Step 1 description uses `WizardDescriptionField` instead of `WizardFloatingTextarea` + nested counter `<p>` (eliminates label/text overlap and counter inside the typing area).

## Shipped this session (QA wizard description layout, deployed 2026-06-09)
- **`wizard-description-field_qa.tsx`:** Replaced floating-label `WizardFloatingTextarea` with static `WIZARD_FIELD_LABEL` + `mb-2` above a fixed-layout textarea (`min-h-[150px]`, `overflow-y-auto`, `resize-y`, `field-sizing-fixed`) so typed copy no longer overlaps the DESCRIPTION label; metrics block unchanged below.

## Shipped this session (QA canvas scroll fix, deployed 2026-06-09)
- **`Canvas_qa.tsx`:** `QA_CANVAS_VIEWPORT_CLASS` updated ? `overflow-hidden` ? `overflow-y-auto scrollbar-hide` so the main hall viewport accepts wheel scroll while hiding the track.
- **`globals.css`:** Added `.scrollbar-hide` utility (alias of `.scrollbar-none` for WebKit + Firefox).
- **`floor-plan-canvas_dashboard_qa.tsx`:** Inner `[role="application"]` scroll host restored to `overflow-auto` (matches prod `floor-plan-canvas.tsx`); outer wrapper uses updated `QA_CANVAS_VIEWPORT_CLASS` ? no `onWheel`/`onScroll` on parent (wheel handled on inner via `use-viewport`).

## Shipped this session (QA absolute overrides, deployed 2026-06-09)
- **`Canvas_qa.tsx`:** Exported `QA_CANVAS_VIEWPORT_CLASS` (`flex-1 h-[calc(100vh-64px)] overflow-hidden relative bg-slate-50`) ? structural lock for main hall viewport (superseded by scroll fix above).
- **`floor-plan-canvas_dashboard_qa.tsx`:** Canvas container `overflow-auto` ? `overflow-hidden`; outer wrapper uses `QA_CANVAS_VIEWPORT_CLASS` (no right-edge scrollbar; pan/zoom handlers unchanged) ? **reverted** inner to `overflow-auto` in scroll fix above.
- **`Dashboard_qa.tsx`:** Center column wrapped in `QA_CANVAS_VIEWPORT_CLASS`; exported `QA_PLACEMENT_TIP_VALID` / `QA_PLACEMENT_TIP_VIOLATION` (`Valid space` / `Rule conflict`); `QA_ACCORDION_HEADERS` + `QaAccordionHeader` h3 typography.
- **`canvas-toolbar-static_qa.tsx`:** Accordion triggers use `QaAccordionHeader` + `QA_ACCORDION_HEADERS` from `Dashboard_qa` (no row icon badges).
- **`canvas-legend_qa.tsx`:** Placement HUD microcopy wired to Dashboard QA tip constants.

## Shipped earlier this session (deployed 2026-06-09)
- **Vendor Supplies:** New `/vendor/supplies` page with Amazon.ca search (associate tag `thetipsyfox08-20`), 15 curated booth/display/packaging picks (all affiliate links), category + local filters, mandatory disclosure. Nav: **Vendor Supplies** in app nav + vendor workspace rail. Shared `lib/affiliate/amazon.ts` (material checklist re-exports). Verify: `npx tsx scripts/verify-vendor-supplies.ts`.

## Shipped this session (QA staging, deployed 2026-06-09)
- **`Dashboard_qa.tsx`:** `QA_PANEL_SCROLL_CLASSES` (`scrollbar-none` + WebKit/MS/Firefox hide); `DashboardLeftPanelQa` portal target is the sole scroll host (`overflow-x-hidden overflow-y-auto`, no visible tracks).
- **`canvas-command-bar_qa.tsx`:** Sidebar layout uses `overflow-hidden` so accordions scroll via portal target only (no nested scrollbars).
- **`tooltip-wrapper_qa.tsx`:** Left-rail anchors always pop right (`translateY(-50%)`, `anchor.right + 8px`); viewport edge clamp; scroll/resize listeners keep portal position in sync.
- **`canvas-toolbar-static_qa.tsx`:** Accordion headers ? **ROOM CONTROLS**, **PATRON LAYOUT**, **VENDOR BOOTHS**, **DESIGNER TOOLS** (row icon badges removed; uppercase `h3` titles).
- **`Canvas_qa.tsx` + `floor-plan-canvas_dashboard_qa.tsx`:** Stage `fill="none"` single perimeter; `pointerEvents="all"` + `cursor: move`; `SelectionOverlayQa` skips duplicate dashed outline on selected stages; stage stays visible after merge join.
- **`toolbar-tooltip-copy_qa.ts` + command-bar blocks:** Micro-tooltip copy wired across toolbar/object brushes.
- **Build:** Local `npm run build` passes (webpack, clean `.next`) ? **build 143** uncommitted; CI lint 0 errors with `prefer-const` fix.

## Shipped this session (QA staging, deployed 2026-06-09)
- **`toolbar-tooltip-copy_qa.ts`:** Centralized micro-tooltip strings (e.g. `Clear all`, `Auto-arrange`, `Merge rooms`, `Space H`) ? replaces long descriptive sentences across command-bar blocks.
- **`tooltip-wrapper_qa.tsx`:** Compact bubble styling (`text-xs px-2 py-1 bg-slate-800 text-white rounded shadow-sm`); narrower width estimate cap (160px).
- **`canvas-toolbar-static_qa.tsx`:** Accordion headers ? **ROOM CONTROLS**, **PATRON LAYOUT**, **VENDOR BOOTHS**, **DESIGNER TOOLS** with `text-xs font-bold tracking-wider text-slate-700 uppercase`; chrome tooltips shortened.
- **`canvas-command-bar-blocks_qa.tsx` + `canvas-command-bar_qa.tsx`:** All toolbar/object-brush tooltips wired to micro-copy constants; merge/join hints shortened.

## Shipped this session (QA staging, deployed 2026-06-09)
- **QA mirror modules written to disk** under `src/qa_review/` (previously documented only).
- **`tooltip-wrapper_qa.tsx`:** Portal tooltips (`fixed z-50` on `document.body`) with sidebar bounds check ? flips to the right when hint would clip past `w-80` (320px).
- **`canvas-toolbar-static_qa.tsx` + `canvas-command-bar_qa.tsx` + `command-button_qa.tsx` + `canvas-command-bar-blocks_qa.tsx`:** Uppercase text accordion headers (**ROOM LAYOUT**, **PATRON PLACEMENTS**, **VENDOR PLACEMENTS**, **CANVAS SETTINGS**); all command-bar tooltips use portal wrapper.
- **`Dashboard_qa.tsx`:** `DashboardBootstrapQa` + `DashboardLeftPanelQa` with relative portal target wrapper; mandatory initial room modal gate.
- **`Canvas_qa.tsx`:** Stage single outer rect (`fill="none"`); excluded from joined-fixture dissolve hiding; `cursor: move` hit target; stays visible after merge join.
- **`floor-plan-canvas_dashboard_qa.tsx`:** `LayoutCanvasDashboardQa` + `SelectionOverlayQa` skips duplicate dashed outline on selected stages.
- **`Merge_qa.ts` + `destructive-merge_qa.ts`:** Merge (2) 2D union bounds re-export; `npx tsx scripts/verify-merge-qa.ts` ? 7/7 pass.
- **Docs:** `dashboard-layout-patch_qa.md` + `MANIFEST.md` wiring for `CanvasCommandBarQa`.

## Next actions ? native mobile (iOS)
1. **Commit mobile shell** ? `capacitor.config.ts`, `mobile/`, `ios/`, `scripts/mobile/`, `PM/ios-testflight.md` (no `.env`).
2. **Apple Developer setup** ? App ID `ca.popuphub.app`; Distribution cert + App Store provisioning profile (or Xcode automatic signing).
3. **App Store Connect app** ? create iOS app record; SKU `popuphub-ios-001`.
4. **Supabase Auth** ? add redirect `ca.popuphub.app://auth/callback`; smoke email/OAuth on device.
5. **Mac archive ? TestFlight internal** ? follow `PM/ios-testflight.md`: `npm run mobile:sync` ? `npm run mobile:ios:open` ? Archive ? Upload ? internal testers.
6. **Native polish pass** ? safe-area QA on iPhone/iPad, overscroll bounce, `apple-app-site-association` for universal links.
7. **App Store (later)** ? metadata, screenshots, privacy labels, review notes (coordinator/vendor tooling, not generic web wrapper).
8. **Android (later)** ? `npx cap add android` after iOS path proven.

## Next actions ? web / QA
1. **Layout canvas init smoke-test** ? `/coordinator/events/[id]/layout`: room bounds visible at **100%** on first load (no manual zoom-out); resize window / toggle inspector ? canvas re-fits with 40px margin
2. **Step 3 Add room smoke-test** ? `/coordinator/events/new` Step 3 with zero rooms: Width/Length inputs + Add room button visible (not clipped); page scrolls if toolbar exceeds viewport
2. **Global scroll smoke-test** ? `/coordinator/events/new` Step 3 + `/coordinator/dashboard`: only one browser scrollbar (right edge); no nested canvas/map scroll track; Ctrl+wheel still zooms canvas
2. **Canvas wheel smoke-test** ? `/coordinator/dashboard`: scroll wheel over canvas scrolls page (not inner trap); Ctrl+wheel still zooms
2. **Mobile smoke-test** ? `/discover` scroll + reduced footer; `/coordinator/dashboard`: initial room modal (dimensions only), then table size from designer menu
2. **Loader smoke-test** ? hard refresh: perimeter booths, centered full logo, no grid/dash lines
3. **Wizard smoke-test** ? Step 2 booth fee / discount backspace; category price placeholders
4. **Instant book** ? re-run `npx tsx scripts/verify-instant-book-category-limits.ts` after any apply-route edits (currently 4/4)
5. **OpenRouter smoke-test** ? set `OPENROUTER_API_KEY` on Vercel; upload flyer on wizard Step 1 ? fields populate; API `meta.source` is `openrouter`
6. **Login QA smoke-test** ? `/login`: 3 wrong passwords ? fullscreen Nedry video (magic-word audio) + 30s lock; confirm `/assets/nedry_magic_word.mp4` loads on prod after deploy; verify trim + toggle do not leak globally
7. **Commit + deploy** when ready (`PM/Deploy-popuphub.bat` or `ship.ps1`); promote `_qa` modules after sign-off

## Goal (prior)
**QA folder staging ? dashboard layout optimization & stage merge** ? all layout/merge/canvas changes mirrored in `src/qa_review/` for manual testing before production promotion.

## Shipped this session (QA staging, deployed 2026-06-09)
- **`Dashboard_qa.tsx`:** `DashboardBootstrapQa` ? curation queue / Market Intake / Available Pool removed from left rail; `h-[calc(100vh-64px)] overflow-hidden` on aside; mandatory `InitialRoomModalQa` gates canvas mount until first room dimensions confirmed.
- **`Canvas_qa.tsx`:** Stage placable rects render with `fill="none"` / `fillOpacity={0}` (rose stroke retained) so grid shows through after merge.
- **`Merge_qa.ts` + `destructive-merge_qa.ts`:** Merge (2) union uses full 2D stage bounding box (`mergeParticipantBounds2d`) ? not a width-only horizontal line projection.
- **`floor-plan-canvas_dashboard_qa.tsx`:** Canvas host wired to `CanvasObjectsQa` for optional E2E swap.
- **`dashboard-layout-patch_qa.md` + MANIFEST:** Wiring steps, smoke-test checklist, promotion gate.
- **Verify:** `npx tsx scripts/verify-merge-qa.ts` ? 7/7 pass.

## Next actions
1. **Wire QA dashboard** ? swap `DashboardBootstrap` ? `DashboardBootstrapQa` in `market-dashboard-client.tsx` (see `dashboard-layout-patch_qa.md`)
2. **Optional canvas/merge E2E** ? temporary import swaps for `LayoutCanvasDashboardQa` and `destructive-merge_qa`
3. **Smoke-test** ? initial room modal, no left-rail scrollbar, stage merge bump, stage fill none
4. **Promote to production** after QA sign-off (do not edit main paths until then)

## Goal (prior)
**UI architecture ? maximize canvas space & initial room modal** ? purge curation queue from dashboard left rail, mandatory first-room modal before canvas mount, zero inner scrollbars on utility panel, floating Placement HUD.

## Shipped this session (local, deployed 2026-06-09)
- **Curation queue removed from dashboard:** `dashboard-left-panel.tsx` replaces `DashboardCurationColumn` ? left rail is layout-tool accordions only (Room / Patron / Vendor / Object Brushes via toolbar portal). Curation column files retained but unused in bootstrap.
- **Left panel sizing:** `dashboard-app-shell.tsx` + bootstrap pass `w-80`, `h-[calc(100vh-64px)]`, `overflow-hidden` on left aside; grid column `20rem | 1fr`. `canvas-command-bar.tsx` drops sidebar `max-h` / `overflow-y-auto`; portal target uses `flex-1 overflow-hidden`.
- **Mandatory initial room modal:** `initial-room-modal.tsx` + `hasInitialRoom` in `dashboard-bootstrap.tsx` ? events with no saved rooms show blurred overlay + 50?50 ft dimension form; canvas mounts only after confirm (`addLayoutRoomToList`). Existing layouts skip modal.
- **Canvas footprint:** Dashboard floor-plan column gap removed; canvas host `flex-grow`; `CanvasLegend` (Placement HUD) pinned `absolute top-4 right-4 z-10` with `shadow-lg`.
- **Header copy:** Removed ?curation queue? from command-center subtitle.
- **Build:** Local `npm run build` passes (build **136**, uncommitted).

## Next actions
1. **Dashboard layout smoke-test** ? `/coordinator/dashboard`: new market with no rooms ? initial modal ? canvas opens; left panel has no inner scrollbar; Placement HUD floats top-right; Full canvas mode still works
2. **Existing layout smoke-test** ? market with saved rooms skips modal; toolbar accordions fit in left rail without clipping on 1080p
3. **Commit + deploy** when ready
4. **Optional cleanup** ? delete unused `dashboard-curation-column.tsx`, `curation-queue-column.tsx`, `vendor-pool-shelf.tsx` if curation is permanently out of dashboard scope

## Goal (prior)
**UI polish ? modern scrollbar styles** ? slim 8px rounded slate scrollbars on dashboard layout panes, canvas viewport, and overflow dropdowns via global CSS pipeline.

## Shipped this session (local, deployed 2026-06-09)
- **Modern panel scrollbars:** `app/globals.css` ? CSS vars (`--scrollbar-size`, `--scrollbar-thumb`, hover state), reusable `.scrollbar-modern` utility, and scoped rules for `.dashboard-app-shell` overflow panels (curation queue / Available pool shelf), `#floor-plan-workspace` canvas viewport, `.layout-planner-root`, and `[data-slot='select-content']` / `[data-slot='dropdown-menu-content']`. WebKit 8px rounded thumbs + Firefox `scrollbar-width: thin`; dark mode thumb tokens.
- **Mobile-first Experience Designer:** `workspace-shell.tsx` stacks wizard / canvas / inspector on phones with a bottom tab bar; step header scrolls horizontally with 48px touch targets; wizard CTAs use `touch-target` + `min-h-12`. Shared `hooks/use-mobile-viewport.ts`; floor-plan workspace reuses it.
- **Dashboard touch targets:** `CommandButton` enforces `min-h-12 min-w-12` below `md`, compact icon sizes on desktop. Global `.touch-target` utility in `globals.css` (48?48px minimum).
- **Fluid page containers:** Profile, notifications, applications, passport pages use `w-full max-w-* px-4 sm:px-6` instead of fixed desktop padding that caused horizontal scroll on narrow viewports.
- **SEO metadata pipeline:** `lib/seo/site-config.ts`, enhanced `buildPublicMetadata` (canonical, robots, metadataBase, OpenGraph locale). Theme catalog in `lib/seo/experience-theme-metadata.ts` with per-theme titles/descriptions. Experience Designer `generateMetadata` reads `?theme=` search param.
- **Sitemap + robots:** `app/sitemap.ts` + `lib/seo/collect-sitemap-entries.ts` (static routes, published events, coordinator/patron profiles, theme template URLs). `app/robots.ts` allows public browse paths, disallows authenticated app areas. Offline generator: `npm run seo:sitemap` ? `scripts/generate-sitemap.ts`.
- **CWV ? code splitting:** Experience Designer page dynamically imports workspace shell; `BlueprintCanvas` (React Flow) lazy-loaded with Suspense skeleton. Existing dashboard column lazy imports preserved.
- **CWV ? images:** `next.config.ts` enables AVIF/WebP formats; new `components/ui/responsive-image.tsx` (`ResponsiveImage` / `ResponsiveNativeImage` with lazy loading + aspect-ratio CLS guard). Auction room hero migrated.
- **CWV ? CLS:** Council telemetry streaming panels reserve min-height while AI content loads (`council-telemetry-panel.tsx`).
- **Semantic HTML:** Public landing wrapped in `<main>`; patron public profile uses `<main>`, `<nav>`, `<article>`. Patron page gets `generateMetadata`.
- **Build:** Local `npm run build` passes (build **134**).

## Next actions (prior)
1. **Scrollbar smoke-test** ? `/coordinator/dashboard`: pan/zoom canvas viewport, open a long Select/Dropdown in floor-plan toolbar; confirm 8px rounded slate thumbs on Chrome/Safari/Firefox
2. **Mobile smoke-test** ? `/coordinator/experience-designer` on phone: bottom tabs switch wizard/canvas/inspector; step header tappable; no horizontal page scroll
3. **SEO verify** ? curl https://popuphub.ca/sitemap.xml and /robots.txt after deploy; spot-check `/events/[id]` and `/coordinator/experience-designer?theme=cyber_heist` meta tags
4. **Theme OG art** ? replace placeholder `/icons/icon-512x512.png` in `EXPERIENCE_THEME_CATALOG` with dedicated `.webp` theme cards under `public/experience-designer/themes/`
5. **Image migration** ? remaining raw `<img>` tags (shopper cards, passport avatars, flyer upload previews) ? `ResponsiveNativeImage` where LCP-sensitive
6. **Defer for INP** ? `@xyflow/react` (Experience Designer canvas), `@dagrejs/dagre`, Square/Twilio SDKs, AI streaming parsers in `/api/experience-designer/*` ? already code-split for canvas; consider dynamic import for MaterialChecklistPanel and council telemetry on first inspector open
7. **Commit + deploy** when ready

## Goal (prior)
**Coordinator smoke-test on prod** ? verify layout fixes shipped in build **106** (`cde554e` @ https://popuphub.ca). Auto-arrange keeps vendor and patron on **separate passes** (see **Vendor placements** / **Patron placements** below). Verify vendor-only and patron-only behavior with `npx tsx scripts/verify-auto-arrange.ts` (guest-table section today; extend when patron mode parity ships).

**Fixed (local):** Vendor auto-arrange no longer **deletes** booths when obstacles / space restrictions block some deterministic slots ? scans all valid grid slots, fallback row-pack, keeps unmoved booths at their prior position when reposition fails (toast: ?left in place?). `lib/floor-plan/deterministic-market-layout.ts` + `engine/auto-arrange.ts`.

## Vendor placements

Vendor units are rectangular sellable placements (`tablePurpose: 'vendor'`). They drive venue capacity, hall baseline, category proximity, and multi-table consolidation.

| Aspect | Detail |
|--------|--------|
| **Draw** | Toolbar **Vendor**; Table size pill **Vendor** column (rectangular, hall baseline length) |
| **Canvas** | Solid vendor rectangle (amber/yellow fill); included in booth matrix / placement status / telemetry |
| **Consolidation** | Multi-table vendors collapse to one footprint before arrange (`consolidateBoothsForAutoArrange`) |
| **Auto-arrange scope** | **Vendor only** ? patron is never moved or merged in this pass |
| **Auto-arrange modes** | **Grid** ? aligned rows/columns, 8? aisles, entrance-first row order ? **Staggered** ? alternating half-width row offset for sightlines ? **Perimeter** ? boundary loop (top ? right ? bottom ? left) |
| **Engine** | `autoArrangeVendorBooths` in `components/coordinator/floor-plan-v2/engine/auto-arrange.ts`; layout modes via `lib/floor-plan/deterministic-market-layout.ts` |
| **Toolbar** | **Vendor** ribbon block: **Vendor** draw + Vendor size pill + mode select (Grid / Staggered / Perimeter) + **Auto-Arrange**; enabled when ?1 vendor in active room |
| **Shipped** | Dedicated vendor toolbar block (`vendor` in `toolbar-order.ts` / `canvas-command-bar-blocks.tsx`); `scope: 'vendor'` in `auto-arrange.ts` |
| **Verify** | `npx tsx scripts/verify-auto-arrange.ts` ? grid, staggered, perimeter, multi-room, category proximity |

## Patron placements

Patron (guest) seating is non-vendor (`tablePurpose: 'guest'`). Round and banquet sizes; they do **not** change venue capacity or hall baseline.

| Aspect | Detail |
|--------|--------|
| **Draw** | Toolbar **Round** / **Patron**; Table size pill **Round** or **Patron** columns (5? / 6? / 8?) |
| **Canvas** | Round = violet/purple ellipse; patron = dashed violet/purple rectangle; excluded from vendor ?Unassigned? styling and booth matrix vendor counts |
| **Consolidation** | None ? each placement keeps its laid footprint (round stays circular) |
| **Auto-arrange scope** | **Patron only** ? vendor is obstacles/fixed context, not rearranged in this pass |
| **Auto-arrange modes (target)** | Same three options as vendor: **Grid**, **Staggered**, **Perimeter** ? applied only to patron, respecting vendor footprints and structural obstacles |
| **Bounding box (shipped)** | Patron auto-arrange computes an **active bounding box** around existing patron tables (+1? padding) and generates grid/staggered slots **only inside that box** ? no full-room sweep into vendor zones |
| **Non-destructive abort (shipped)** | If tables cannot fit equidistantly inside the box, engine **halts** and keeps original coordinates; toast: *Could not automatically adjust tables. Manual placement is required to fit this density.* |
| **Engine (shipped)** | `arrangeGuestTables` + `guestActiveBoundingBox` ? Grid / Staggered / Perimeter via deterministic slots + row-pack fallback confined to active box; vendor footprints as restricted zones; preserves laid width/height |
| **Engine (target)** | Patron perimeter on merged-zone rings; mixed-size round+rect grid tuning |
| **Toolbar** | **Patron** ribbon block: **Round** / **Patron** + Round/Patron size pill + mode select + **Auto-Arrange**; enabled when ?1 patron in active room ? independent of vendor mode state |
| **Shipped** | Dedicated patron toolbar block; `scope: 'patron'` keeps vendor fixed while `arrangeGuestTables` runs (`isGuestTableBooth` in `lib/booth-planner/table-shape.ts`) |
| **Verify** | Guest-table + isolated-scope blocks in `scripts/verify-auto-arrange.ts` (10/10 pass in those sections) |

## Shipped this session (local, deployed 2026-06-09)
- **Dashboard layout tools in left panel:** Removed **Event overview** back links from command-center header and curation column. Floor-plan `CanvasCommandBar` (static layout) portals into the left rail via `dashboard-toolbar-portal.tsx` on desktop ? canvas column is toolbar-free for more layout space. Mobile and **Full canvas** immersive mode keep the ribbon above the canvas. `sidebarLayout` on `canvas-command-bar.tsx` drops the 36vh height cap for vertical scrolling in the rail.
- **Condensed canvas toolbars:** Floor-plan command ribbon, static dashboard rows, venue layout palette, and canvas utility bar are icon-only with `TooltipWrapper` labels. `CommandButton` is square (~1.65rem compact); removed Vendor/Patron/Room section badges and table-size column headers; embedded room bar uses icon **Add room**; reset/reorder chrome tightened. Files: `command-button.tsx`, `canvas-command-bar-blocks.tsx`, `canvas-toolbar-static.tsx`, `canvas-toolbar-reorder.tsx`, `layout-room-bar.tsx`, `table-size-pill.tsx`, `venue-layout-toolbar.tsx`, `canvas-utility-toolbar.tsx`.
- **Gemini ? Groq AI fallback:** Flyer vision parse (`lib/flyer/parse-flyer-vision.ts`) tries Gemini first (`GEMINI_API_KEY`, model `google/gemini-2.5-flash` via `FLYER_GEMINI_MODEL_ID` / `GEMINI_MODEL_ID`), then Groq when quota/rate-limit/overload errors occur. Groq key reads `GROQ_API_KEY` or Vercel alias `POPUPHUB_API_KEY`; model defaults to `llama-3.2-90b-vision-preview` (`GROQ_MODEL_ID` optional). Shared helpers in `lib/ai/`. Verify: `npx tsx scripts/verify-ai-provider-fallback.ts`. **Note:** Experience Designer planning sessions still proxy to the external Master Generator backend ? that service needs its own Gemini?Groq fallback if theme generation should use this pattern.
- **Build fix (TS):** `CanvasPointerApi.onPointerDown` return type updated to `boolean` (implementation already returned handled flag; `floor-plan-canvas.tsx` truthiness check failed typecheck). `scripts/verify-room-merge-two-rooms.ts` ? full `LayoutRoom` shape for legacy projection test. Local `npm run build` passes (build **131**).
- **Vendor booth spacing (superseded):** Earlier session set `BOOTH_PLACEMENT_GAP_FT = 0`; **reverted** ? vendors again use 4? edge-to-edge gap (2? per side). See ?Shipped this session (vendor clearance)? above.
- **Patron vs vendor canvas colors:** Patron/guest tables render with violet fill (`#ddd6fe` / stroke `#5b21b6`); vendor booths without a category stay amber/yellow (`DEFAULT_BOOTH_PALETTE`). `PATRON_TABLE_PALETTE` in `category-palette.ts`; `fillForObject` / `strokeForObject` in `canvas-objects.tsx`.
- **Room merge + stage fill fix:** Destructive **Merge (2)** now picks the top-left participant as the surviving room (union min origin), reassigns `objectRoom` for absorbed rooms, and `legacyRoomsFromDoc` drops removed rooms so the wizard sidebar matches the single merged hall. Post-merge sync passes the merged room id as active. Stage assets render with `fill: transparent` / `fillOpacity: 0` (rose stroke retained). `room-union-merge.ts`, `legacy-bridge.ts`, `floor-plan-v2.tsx`, `canvas-objects.tsx`, `canvas-overlays.tsx`. Verify: `npx tsx scripts/verify-room-merge-two-rooms.ts`, `verify-destructive-merge.ts`, `verify-multi-room-canvas.ts`.
- **Room move/resize on canvas:** Drag the room perimeter or empty interior to reposition; eight corner/edge handles resize the footprint (booth/fixture children move/scale with the frame). **Select** or **Hand** tool ? Hand still pans empty canvas but room strokes/handles take priority (clicks on placed objects do not drag the room). Auto-switches to **Select** after **Add room**; room tab / perimeter click also switch to Select. `use-canvas-pointer.ts`, `floor-plan-canvas.tsx`, `floor-plan-v2.tsx`. Verify: `npx tsx scripts/verify-multi-room-canvas.ts` (27/27 pass).
- **Passport story logo fallback:** Story cards and public carousel use `resolveStoryBackground` (`story image ? brand logo ? /placeholder-logo.png`). Logo/placeholder thumbnails get `object-contain bg-neutral-900 p-4`; video clips bind `poster={logoUrl}` on `<video>` in uploader detail modal and full-screen viewer. `lib/passport-stories/story-media.ts`, `hooks/use-owner-brand-logo.ts`, `passport-story-uploader.tsx`, `passport-story-viewer.tsx`, `public/placeholder-logo.png`.
- **Market Promo expandable card:** Passport story preview cards on `/profile/passport` use `object-contain` + `bg-gray-50` for logo thumbnails (no edge clipping). Cards are clickable (`hover:shadow-md transition-all cursor-pointer`) and open a Full Details dialog with uncropped caption + full-size media; backdrop click and Close dismiss. `components/passport/passport-story-uploader.tsx`.
- **Profile vs Passport split:** Profile settings limited to private account data ? Legal Name, Private Email, phone (labeled *Private ? Used only for automated system SMS alerts*), shopper auction contact toggle, `AccountSecurityCard` (Change Password), and `NotificationPreferencesGrid` in the main column. Organization name, website, bio, and social links removed from profile form; `use-profile-settings` writes only `profiles`. Passport forms use `use-passport-profile` ? `vendor_passports` (bio, social, logistics). `lib/passport/public-passport-index.ts` + service client loads public-safe fields for `/coordinators/[id]` and `/patrons/[id]` via `PassportPublicCard` (Instagram/Facebook/Website icon links). Migration `091_passport_social_logistics.sql`: `facebook_url`, `requires_electricity` on `vendor_passports`; vendor wizard + coordinator review drawer wired.
- **Profile settings expansion (prior):** `AccountSecurityCard`, `NotificationPreferencesGrid`, `use-notification-preferences` ? still in place; org fields moved off profile per split above.
- **Toolbar distribute spacing:** View/align ribbon block adds **Distribute horizontal** and **Distribute vertical** buttons (`AlignHorizontalDistributeCenter` / `AlignVerticalDistributeCenter`). Requires 3+ selected objects; `distributeSelectionPatches` in `geometry.ts` evenly spaces centers between endpoint anchors (locked endpoints stay put). Wired through `floor-plan-v2.tsx`, `canvas-command-bar.tsx`, `canvas-tool-types.ts`. Verify: `npx tsx scripts/verify-align-and-center.ts` (20/20 pass).
- **Patron bounding-box auto-arrange:** `guestActiveBoundingBox` (+1? padding) confines patron grid/staggered slot generation to the imaginary sub-box around manually placed tables. `scope: 'patron'` passes `activeBoundingBox` into `arrangeGuestTables`; slots filtered to `[MinX, MaxX] ? [MinY, MaxY]`. All-or-nothing: if every table cannot be rearranged inside the box, `patronArrangeAborted` is set, coordinates unchanged, UI shows density toast (no partial wipe). `PATRON_ARRANGE_DENSITY_ERROR` exported from `engine/auto-arrange.ts`; handlers in `floor-plan-v2.tsx` + QA mirror skip `replaceObjects` on abort.
- **Isolated vendor / patron auto-arrange:** Vendor pass (`scope: 'vendor'`) treats placed patron tables as fixed obstacles (2? clearance) while rearranging only vendor booths; patron pass (`scope: 'patron'`) keeps vendor booths fixed and packs only guest tables away from vendor footprints. `AutoArrangeScope` in `engine/auto-arrange.ts`; toolbar handlers already pass `scope`.
- **Vendor footprint preservation:** `placeBoothsAtSlots` uses each source booth's laid width/height (not median grid cell); single-table vendors skip dimension normalization in `consolidateBoothsForAutoArrange`.
- **Patron mode parity (Grid / Staggered / Perimeter):** `arrangeGuestTables` accepts `mode` + runs deterministic slot generation (with vendor + structural restricted zones), falling back to row-pack; unmoved tables stay at last valid position. Round/patron diameters preserved.
- **Scoped placedCount:** Vendor toast counts repositioned vendors only; patron toast counts placed guest tables ? fixed patrons inflating vendor success count.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` ? patron bounding-box block (3/3 pass: padding, dense abort, roomy rearrange inside box); isolated-scope block (6/6 pass); 27/28 total (remaining failures: pre-existing multi-table consolidation + legacy angled/perimeter mode assertions).
- **Initial loader full logo:** Replaced icon-only center mark with the full brand lockup (`popup-hub-brand.png`: storefront + "Popup Hub" wordmark). Removed duplicate SVG wordmark text; tagline and progress bar unchanged. Updated master `public/popup-hub-logo.png` from official lockup and ran `npm run assets:logo`. Service-worker cache bumped to `v13`.
- **Mobile page scroll fix:** Coordinator/vendor workspace pages (`CommandCenterShell`, `DashboardAppShell`) hide left/right rails below `lg` so the center column fills the viewport and scrolls. `events/new` and setup wizard bodies use the same scroll shell. Fixes clipped main body on phones.
- **Mobile wizard field overlap fix:** Floating inputs/textareas use `min-h-14` / `!h-auto` instead of fixed `h-11` so labels and entered text no longer collide.
- **Brand logo refresh:** Replaced master `public/popup-hub-logo.png` with the official forest-green storefront lockup (994x1024). Ran `npm run assets:logo` to regenerate `popup-hub-brand.png`, `popup-hub-icon.png`, `logo.png`, favicons, PWA icons, and `app/icon.png` / `apple-icon.png`. Fixed `scripts/process-logo.mjs` atomic writes on Windows. Updated nav/footer/auth logo dimensions (`popup-hub-logo.tsx`), loader pin offset (`loader-variants/shared.ts`), animation wordmark/stroke colors to `#2d5a27` (`popup-loader-scene.tsx`, `initial-loader-reveal.tsx`), PWA `theme_color`, and service-worker cache `v11`.
- **CI lint fix:** `prefer-const` on `rowStartX` in `auto-arrange.ts` ? GitHub CI `npm run lint` was failing (1 error, 359 warnings). Local lint now exits 0. Vendor was dropped from the doc when deterministic slots overlapped obstacles or failed the 2? edge rule, even with open floor left. Layout now walks **all** valid slot candidates (not just the first N), perimeter slots respect restricted zones, column pitch includes the 2? edge gap, and a fallback grid scan runs before giving up. Unplaced vendor **stays on canvas** at its last valid position (not removed); toast says ?left in place?. Verify: `npx tsx scripts/verify-auto-arrange.ts` (15-vendor wall case + main grid cases).
- **Food truck placement (canvas-open):** New `food_truck` fixture kind and toolbar **Food truck** draw tool. Trucks may sit anywhere inside the advisory canvas bounds, including parking areas outside room polygons (no room owner / no perimeter touch required). Inside a room, centroid still resolves `objectRoom` for save bridge. Legacy round-trip via `custom_label` + `FOODTRUCK@` sentinel. `lib/floor-plan/canvas-open-placement.ts`, `is-point-in-room.ts`, `use-canvas-pointer.ts`, canvas render + QA pointer. Verify: `npx tsx scripts/verify-food-truck-placement.ts`.
- **Viewport zoom/pan flicker fix:** `frameActiveRoom` depended on the `viewport` API object, which is recreated every render (including each zoom tick). That re-ran `fitToBounds` continuously ? zoom buttons flickered and scroll snapped back to the room center. Framing now reads `viewportRef` and only runs when `viewportFramingKey` / `roomsFramingKey` changes (room switch, resize, merged zone). `floor-plan-canvas.tsx` + QA mirror.
- **Clear all crash fix:** `useCanvasStore` memoizes its return value so dashboard `onStoreReady` / `registerFloorPlanStore` no longer run every render (max-update-depth / page crash after Clear all). Wizard QA `handleClearAll` clears parent `layoutRooms` and suppresses auto Main Hall (parity with production). `use-canvas-store.ts`, `floor-plan-v2_wizard_qa.tsx`.
- **Patron: no vendor ?Unassigned? styling; draw stays patron:** Patron is excluded from dashboard booth placement status (canvas fill, booth matrix a11y table, telemetry booth counts). Resizing a selected patron via the Round/Patron pill now syncs the next-draw template so a follow-up placement does not fall back to vendor. `floor-plan-v2.tsx`, `market-management-context.tsx`, `canvas-objects.tsx`, `booth-matrix-a11y-table.tsx`. Verify: `npx tsx scripts/verify-canvas-state-smoke.ts`.
- **Table size / draw mode: last placed table stays put:** New draws auto-select the object; switching Round ? Vendor or Round ? Vendor pill columns was reshaping the selection via `planTableSizeChange`. Now patches apply only when purpose+shape match the selection; cross-category changes update the next-draw template and clear selection. Draw-toolbar buttons use `templateOnly`. `table-size-selection.ts` + `floor-plan-v2.tsx` / wizard QA. Verify: `npx tsx scripts/verify-canvas-state-smoke.ts`.
- **Auto-arrange: separate vendor vs patron passes:** Vendor uses grid/staggered/perimeter (`autoArrangeVendorBooths`). Patron runs a second pass (`arrangeGuestTables`) ? excluded from vendor consolidation and the vendor grid; row-pack near draw origin or open space away from vendor, preserving laid width/height (round stays circular). `AutoArrangeScope` (`vendor` / `patron` / `all`) in `auto-arrange.ts`.
- **Toolbar split: Vendor / Patron / Room:** Canvas ribbon reorganized into three labeled blocks ? **Vendor** (Vendor draw + Vendor sizes + vendor auto-arrange), **Patron** (Round/Patron + Round/Patron sizes + patron auto-arrange), **Room** (tabs, rotate, merge/unjoin). Canvas tools (select/hand, walls, doors, label, delete) stay in **primitives**; history, align, zoom, save in other blocks. `TableSizePill` accepts `sections: 'vendor' | 'patron'`. Legacy toolbar block ids migrate on load (`toolbar-order.ts`). QA mirrors updated.
- **Toolbar labels:** Draw tools and size-pill columns use **Vendor** / **Round** / **Patron** (not Booth, Patron rect, or ?vendor booths?). Reorder palette block titles match.
- **Layout toolbar reorder + labels:** Dashboard static ribbon rows ? **Room** on top, **Patron** then **Vendor**, workspace tools (select, history, align, zoom, save) on bottom. Patron tools labeled **Patron ? Round ? Rectangle**; size pill rect column **Rectangle**. Canvas fallback labels: **Vendor** / **Patron** (not Booth). Header row ~10% shorter in static layout (`ToolbarCompactProvider`).
- **Dashboard toolbar collapse + reorder:** `staticLayout` ribbon rows (Room, Patron, Vendor, Canvas tools) are individually collapsible (chevron toggle) and reorderable (move up/down). Order + collapsed map persist in `localStorage` (`toolbar-static-layout.ts`, `canvas-toolbar-static.tsx`). **Reset layout** restores defaults. Wizard ribbon unchanged (`CanvasToolbarReorder` horizontal drag).

## Shipped this session (prod build 106, `cde554e`)
- **Deploy tooling fix:** `update-session-handoff.ps1` uses ASCII `-` / `->` / `|` instead of Unicode dashes/arrows so Windows PowerShell 5 parses strings; `deploy-popuphub.ps1` always records https://popuphub.ca in baseline.
- **Tipsy Fox material checklist (Experience Designer):** `processMaterialChecklist` + Zod schema normalize AI `material_checklist` (and legacy BOM strings) into sorted required/optional rows with Amazon.ca affiliate search URLs (`tag=thetipsyfox08-20`), title-case names, catalog hints (Cryptic Symbols ? SVG art, Elemental Weights ? periodic table chart note). Zone inspector renders `MaterialChecklistPanel` with mandatory associate disclosure and **no static prices**. Verify: `npx tsx scripts/verify-material-checklist.ts`.
- **Build fix (TS):** `joinablePlacementProbe` probe object cast to `PlacedObject`; `isValidPlacementLocationBBox` accepts optional `kind` on placement probes so legacy callers without `kind` still type-check. Local `npm run build` passes (build **105**).
- **Object select measurements:** Single-select shows W?H (or diameter for round guest tables) on-canvas below the selection and in the toolbar next to the Table size pill (`formatObjectDimensions` + `highlightedSelectionMetrics`).
- **Object canvas resize:** Eight corner/edge handles on selected booths, tables, walls, stages, etc. (`object-resize.ts`, `SelectionOverlay` controls layer above room chrome). Drag respects snap grid, canvas bounds, overlap rejection, and syncs booth `tableLengthFt` / guest round-square / vendor depth rules. Table clusters stay non-resizable (derived footprint). QA wizard pointer + canvas mirrored.
- **Viewport pan/zoom lock fix:** `ResizeObserver` on the canvas scroll container was calling `fitToBounds` on every resize (including scrollbar appearance), snapping the room back to center and fighting wheel pan/zoom. Now reframes only once when the viewport first becomes measurable. `roomsFramingKey` no longer includes room `originX`/`originY`, so dragging a room does not reset the camera.
- **Stage placement outside room:** Joinable fixtures (`stage`) may be drawn flush against a room perimeter when the centroid sits outside the interior ? `resolvePlacementRoomIdForObject` + `isValidObjectPlacement` in `is-point-in-room.ts`; wired through production pointer, QA wizard pointer, and `geometry-sanitize`. Verification: `npx tsx scripts/verify-asset-type-joins.ts`.
- **Blank-start: add room first (only option):** When `layoutRooms` is empty, canvas toolbar shows only the rooms block (`needsRoomFirst` in `getVisibleToolbarBlockIds`). `LayoutRoomBar` renders width/length (ft) inputs + **Add room** (no preset picker). Shared `appendLayoutRoom()` in `lib/coordinator/add-layout-room.ts`. Wizard left rail hides room tabs until at least one room exists (toolbar owns first-room UX). Tool forced to **hand** until a room exists.
- **Booth select/move after auto-arrange:** Wizard QA pointer hook ran room drag before booth hit-test ? any click inside the room moved the room instead of selecting booths. Reordered to match production (booths first). `hitTest()` now uses table-cluster compound bounds (gaps between sub-tables after consolidation). Transparent compound hit rect on cluster SVG; geometric fallback when DOM misses.
- **Patron seating (not vendor):** `tablePurpose: 'vendor' | 'guest'` on booths. Step 3 **Table size** pill has three groups ? **Vendor** (rectangular, hall baseline), **Round** (5?/6?/8? guest), **Patron** (5?/6?/8? banquet, 2.5? depth). Patron does not change venue capacity or hall baseline. Canvas: round = ellipse; patron = dashed rectangle; vendor = solid rectangle.
- **Round table options (5? / 6? / 8?):** `lib/booth-planner/table-shape.ts` ? guest round diameters, footprint math, `tableShape` + `tablePurpose` on booths. Verification: `npx tsx scripts/verify-round-table-options.ts`.
- **Round / patron draw tools:** Toolbar has **Round** and **Patron** (alongside **Vendor**) ? each atomically sets placement spec and draw mode. Table size pill **Patron** column (5?/6?/8? banquet) also auto-switches to draw. Patron skips vendor category seeding and proximity rules so multiple placements can sit near each other.
- **Table size pill reset fix:** baseline sync `useEffect` depended on whole `store` (identity changes every doc mutation) ? reverted pill selection after `patchDoc` on size change. Now `[safeTableSizeFt, store.patchDoc]` in `floor-plan-v2.tsx` + QA mirrors.
- **Table size ? draw footprint:** QA canvas used `safeTableSizeFt` (wizard prop) instead of `defaultPlacementSizeFt` (local pill state) for `defaultBoothTableLengthFt` and auto-arrange ? new draws ignored pill until Step 2 baseline changed.
- **QA placement room resolve:** `use-canvas-pointer-wizard_qa` uses `resolvePlacementRoomIdForObject` + `isValidObjectPlacement` when rooms exist; keeps open-canvas path for blank start.
- **Draw commit stale-draft fix:** `use-canvas-pointer` (+ QA mirror) keeps draw gesture state in `draftRef` so `pointerup` always commits the draft started on `pointerdown` (same pattern as `toolStateRef` / `panActiveRef`). Fixes preview-on-click / nothing-on-release when React handler closure lagged behind state.
- **QA layout room sync timing:** `floor-plan-v2_wizard_qa` projects wizard rooms onto `doc.rooms` in `useLayoutEffect` (was `useEffect` after paint) and compares frames by id ? newly added rooms are placeable on the first click.
- **QA draw preview parity:** `floor-plan-canvas-wizard_qa` uses `resolveDrawCommitRect` for draft preview/overlap HUD (matches production canvas).
- **Prior (deployed dfa228e):** tap-to-place without drag extent; canvas wheel/pan input lock; add-room placement hydration (`verify-room-add-placement.ts`).

## Prior shipped (prod build 91)
- FF-merge `feature/step-2-fix` ? `master`: Step 2 scroll (`setup-wizard-body` + `overflow-y-auto` on setup page; Step 3 keeps `overflow: hidden` via `.layout-planner-root`)
- Layout blank-start + command-center nav on `master` (`3147712` / `59ec24f`)
- `chore: ship build 89` + build **90** on Vercel (`e764f5e`)
- **Footer chrome trim:** single footer row (legal links, logo, copyright + build version); duplicate strip removed in `03a56fb` / `aa20311` ? **live on prod** (`c661640` / build 91)
- **Blank room interiors:** no interior tints; presets seed zero `venue_elements` (`03a56fb`)
- **Deploy tooling:** `init-shell-env.ps1` (PATH for Explorer launches); `git-sync.ps1` (`Invoke-NativeCommand` / `Invoke-Git`, stale lock recovery); `Deploy-popuphub.bat` (pwsh when available, any cwd, default commit message for current WIP, `--no-pause`); handoff baseline records deploy commit message
- **Deploy fix (local, uncommitted):** Windows PowerShell `$ErrorActionPreference = 'Stop'` + `2>&1 | ForEach-Object` treated Vercel/git stderr as fatal ? fixed via `Invoke-NativeCommand`

## Shipped this session (Unified Auto-Arrange + Patron Flow solver, deployed 2026-06-11)
- **`UnifiedLayoutSolver.ts`:** Coupled booth + spine solver ? skeleton init (serpentine pathway + no-fly rects) ? patron-centric slot seed ? coupled force loop (4? ideal / 2??3? / ?2? clearance bands + category proximity kernel) ? hard projection + minimum-clearance enforcement.
- **Wiring:** `layoutSolver: 'unified'` on `PackBooths` / `autoArrangeVendorUnifiedInRoom`; AI Auto-Arrange (non-grid) tries unified first via `request-ai-auto-arrange.ts` deterministic fallback; traffic-aware pack remains fallback when unified places zero.
- **Overlay:** `UnifiedLayoutFlowOverlay` ? emerald spine polyline + clearance-band heat field (`critical`/`tight`/`good`); auto-enabled after unified arrange / AI Auto-Arrange when solver meta present.
- **Verify:** `npx tsx scripts/verify-auto-arrange-engine.ts` ? PASS (traffic-aware + unified placement + sparse-room ?4? clearance regression).

## Active work ? Unified Auto-Arrange + Patron Flow (simultaneous optimization spec)

**Status:** Implemented locally ? see shipped section above. Remaining: prod smoke-test on `/coordinator/dashboard` with entry/exit doors ? AI Auto-Arrange (Staggered/Perimeter) ? spine + heat overlay visible; Toggle Patron Flow still shows legacy aisle/path overlays.

**Existing anchors (do not duplicate):**
- Clearance bands: `lib/coordinator/booth-clearance-visual.ts` (`BOOTH_CLEARANCE_GOOD_FT = 4`, `TIGHT = 3`, `CRITICAL = 2`)
- Category proximity: `category-rules.ts` (`PROXIMITY_MIN_COLUMNS/ROWS` ? spatial density kernel)
- Patron spine (v1): `patron-centric-layout.ts` `buildPatronPathway` + `AutoArrangeEngine.ts` `buildTrafficNoFlyRects`
- Modified Loop (grid preset): `lib/booth-planner/modified-loop-layout.ts` + `patron-path-trace.ts`
- Aisle target: `layout-clearance-constants.ts` `VENDOR_BOOTH_AISLE_FT = 3` (engine lifts auto-arrange floor to 4? ideal via `UNIFIED_IDEAL_CLEARANCE_FT`)

~~**Next implementation steps:**~~
~~1. Add `UnifiedLayoutSolver` module~~ ? **done**
~~2. Wire as opt-in mode on AI Auto-Arrange~~ ? **done**
~~3. Extend `verify-auto-arrange-engine.ts`~~ ? **done**
~~4. Patron Flow Overlay~~ ? **done**

**Blockers:** None ? prod smoke-test pending.

---

## Active work ? Layout blank start + navigation

### Root causes addressed
1. **`roomsFromBoothLayout(null)`** ? `roomsFromBoothLayoutForEditor`
2. **`layoutHasPlacedGeometry`** ? `layoutHasDrawableGeometry` (cells only)
3. **localStorage multi-room draft** ? cleared when no drawable geometry / empty `layoutRooms`
4. **Delete last room** ? allowed in wizard + standalone layout
5. **Fullscreen CSS** ? stripped on route change + command-center mount
6. **Command center** ? exit/new-market as `Link` + `buttonVariants`
7. **Command center viewport** ? route cleanup hook preserved dashboard body flag; `:has()` CSS + flex canvas column

## Smoke-test status (2026-06-04)
| Check | Result |
|-------|--------|
| Prod build / alias | **OK** ? build **106** / `cde554e` at https://popuphub.ca |
| Command center layout (footer / viewport) | **Re-verify** on prod after sign-in |
| Add room ? draw booth inside room | **Deployed** ? run `verify-room-add-placement.ts` + sign-in smoke |
| Booth draw click-to-place | **Deployed** ? sign-in smoke |
| Booth select / move / rearrange | **Deployed** ? sign-in smoke |
| Booth/table select ? measurements + resize handles | **Deployed** ? sign-in smoke |
| Table size pill drives new draws | **Deployed** ? sign-in smoke |
| Round table 5? / 6? / 8? pill + canvas | **Deployed** ? sign-in smoke |
| Patron 5? / 6? / 8? pill + canvas | **Deployed** ? sign-in smoke |
| Booth placement inside room | **Deployed** ? sign-in smoke |
| Vendor auto-arrange (Grid / Staggered / Perimeter) | **Local** ? isolated pass + patron obstacles; re-test after deploy |
| Patron auto-arrange (separate pass) | **Local** ? active bounding box + non-destructive abort; isolated pass + vendor obstacles + mode selector |
| Toolbar Vendor / Patron / Room blocks | **Local** ? sign-in smoke after deploy |
| Rotate room toolbar | **Deployed** ? sign-in smoke |
| Room drag + resize handles (Select or Hand) | **Local** ? auto-Select after Add room; sign-in smoke |
| Step 3 blank canvas (interactive) | **Deployed** ? sign-in smoke |
| Wheel zoom / scroll pan over canvas | **Deployed** ? sign-in smoke |
| Stage draw outside room (join) | **Deployed** ? verify-asset-type-joins + sign-in |
| Step 2 Capacity scroll | **Local** ? setup-wizard-body scroll + mobile workspace center scroll; manual check on phone |
| Mobile workspace page scroll | **Local** ? side rails hidden below lg; center column scrolls |
| Mobile wizard text fields | **Local** ? Step 1 description/raffle static labels; venue+address Places two-way sync; re-test on phone |
| Blank start ? only add-room + size fields | **Deployed** ? sign-in smoke |
| Deploy / handoff script | **Fixed** ? `%DEPLOY_*%` ? `DPL_*` + delayed expansion (Windows cmd `%DE` parse / PLOY_PS1 error) |

**Manual checklist after sign-in:** `/coordinator/dashboard` ? site footer hidden, canvas fills viewport below nav, toolbar buttons respond, curation queue select works; **Back to market** / **+ New market** / **Full canvas** toggle.

## Do not touch
- `booth-planner.tsx` unless asked
- Vendor / shopper / auction flows unless asked

## Blockers
- ~~**Google Maps API key missing on Vercel**~~ ? `GOOGLE_MAPS_API_KEY` added (2026-06-09); smoke-test Places + discover map after redeploy.
- **iOS build/sign:** Mac + Xcode required to archive and upload TestFlight build (shell scaffolded on Windows; `npm run mobile:sync` OK cross-platform).
- **Supabase redirect:** `ca.popuphub.app://auth/callback` not yet registered in Supabase Auth dashboard.
- **Universal links:** `apple-app-site-association` not on `popuphub.ca` yet.
- Interactive coordinator smoke-test requires user credentials
- Markets with **only** `venue_elements` and no cells open **blank** by design
- ~~Deploy blocked by TS build failure~~ ? fixed locally (pointer return type + verify script)
- ~~CI master blocked by ESLint prefer-const~~ ? fixed locally (`generate-fair-layout.ts` `const route`; lint 0 errors)
- ~~Local Windows deploy Turbopack build 143?144~~ ? fixed locally (`next build --webpack` + clean `.next` in prebuild/deploy scripts)
- ~~Apple Developer account~~ ? enrolled 2026-06-08

## Decisions
- **Mobile strategy:** Ship **iOS App Store app first**, **Android Play Store second**; reuse existing Next.js product rather than rewrite unless native APIs force it
- **Apple Developer Program:** Enrolled ? use for App Store + TestFlight (not PWA-only distribution)
- **Native shell v1:** **Capacitor 7** remote URL ? `https://popuphub.ca`; bundle id **`ca.popuphub.app`**; bundled static export deferred
- **Drawable geometry = booth `cells` only**
- **Zero rooms by default** until user adds a room or saved booth cells exist
- **Room interiors are blank** ? perimeter walls + labels only
- **Vendor vs patron auto-arrange are independent** ? each pass moves only its placement type; neither pass may reposition the other category
- **Shared mode vocabulary** ? both vendor and patron auto-arrange expose **Grid**, **Staggered**, and **Perimeter** (same semantics as `AutoArrangeMode` / `deterministic-market-layout.ts`)
- **AI gateway:** All in-app LLM calls route through **OpenRouter** with task-based model selection in `lib/ai/tasks.ts` (direct Gemini/Groq deprecated)

## Next actions
1. **Google Maps / Places smoke-test** ? After prod redeploy with `GOOGLE_MAPS_API_KEY`: `/coordinator/events/new` Step 1 venue+address autocomplete shows predictions + map pin; `/discover` map renders event pins
2. **Notification count smoke-test** ? Sign in as user with vendor-only unread ? Patron portal: nav badge + `/notifications` subtitle should show caught-up/0; switch to Vendor portal ? count and list should agree
3. **Dashboard toolbar-in-sidebar smoke-test** ? `/coordinator/dashboard`: layout tools (Room / Patron / Vendor / Canvas) appear in left panel above curation queue; canvas fills full column height; **Full canvas** still shows toolbar strip; mobile shows toolbar above canvas
4. **Room merge smoke-test** ? Add two touching rooms, Shift+select both (or park flush), **Merge (2)** ? single hall in sidebar, booths stay put, grid shows through stage outline
5. **Room move/resize smoke-test** ? Add room ? confirm Select tool active, eight dots on perimeter, drag room interior/wall to move, drag corner/edge dot to resize; toolbar W?L readout updates
6. **Passport smoke-test** ? `/profile/passport`: image stories without backdrop show brand logo on dark wrapper; video stories show logo poster while loading and in list/carousel thumbnails; click card opens Full Details modal; delete still works without opening modal
7. **Commit + deploy** room merge + stage fill + prior local fixes when ready
8. **Profile smoke-test** ? `/profile`: legal name + private phone save to `profiles` only; notification toggles persist; Change Password modal; no org/website fields on profile
9. **Passport smoke-test (public)** ? bio + Instagram/Facebook/Website on public `/coordinators/[id]` and `/patrons/[id]`; stories strip still opens story viewer
10. **Coordinator smoke-test** after deploy: manually place patron cluster near vendors ? Patron Auto-Arrange should stay inside cluster box or show density toast without wiping tables; vendor auto-arrange should leave patrons fixed
11. **Verify Clear all** on dashboard + wizard Step 3 after sign-in
12. **Food truck draw** after deploy: parking-lot placement outside Main Hall; vendor auto-arrange should treat truck as obstacle
13. **Mobile smoke-test** ? coordinator event detail, payment methods, events/new wizard on phone
14. If placement rejected, watch for toast (?Draw inside the room interior?) ? click closer to room center after **Add room**
15. **Pop stash** for brand loader: `git stash list` ? apply on `feature/step-2-fix` or new branch

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. scaffold Capacitor iOS shell + TestFlight | coordinator smoke-test Step 3 on Spring market]
```
