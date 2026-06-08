# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Baseline
- Branch: `master` @ `735000f` (pushed to `origin/master`)
- Last deploy commit: `735000f` - feat: floor-plan object resize, measurements, viewport lock, and layout fixes
- Production: https://popuphub.ca - **build 169** | commit `bc0797f` (handoff updated 2026-06-08 09:45)
- **Deploy script:** `PM/Deploy-popuphub.bat` [commit message] -> `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Stashed (not shipped):** `git stash` entry `loader WIP` - brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)


## Last deploy
- 2026-06-08 09:45 - Deploy via deploy-popuphub.ps1 - `feat: floor-plan object resize, measurements, viewport lock, and layout fixes` (735000f)


## Goal
**Native mobile apps (iOS first, Android later)** — wrap the existing Next.js product for App Store distribution, then Play Store. Apple Developer Program account is enrolled (2026-06-08); Android follows after iOS TestFlight / App Store path is proven.

**Web (ongoing):** UX + QA dashboard wiring — layout animation, mobile polish, booth pricing inputs, AI guardrails hourly cap, QA dashboard live on `/coordinator/dashboard`. Login QA Jurassic Park lockout shipped to prod (build 163).

### Native mobile — current baseline
- **Web stack:** Next.js App Router on Vercel (`https://popuphub.ca`); PWA already ships (`public/manifest.json`, service worker, `use-install-prompt` iOS/Android coaches).
- **Apple:** Developer account active — can create App ID, certificates, provisioning profiles, and App Store Connect listing.
- **Android:** Not started; defer until iOS shell + review flow validated.
- **Shell:** **Capacitor 7** — `capacitor.config.ts`, bundle id `ca.popuphub.app`, loads `https://popuphub.ca` via `server.url` (v1 remote web app; see `mobile/README.md` tradeoffs).
- **Repo layout:** `mobile/www/` fallback shell, `ios/` Xcode project (generated), `scripts/mobile/` asset + sync helpers, `PM/ios-testflight.md` internal TestFlight checklist.
- **npm scripts:** `mobile:assets`, `mobile:sync`, `mobile:ios:open`, `mobile:ios:add`.
- **OAuth URL scheme:** `ca.popuphub.app://auth/callback` patched into `ios/App/App/Info.plist` — add same redirect in Supabase Auth before TestFlight sign-in smoke.

## Shipped this session (Google Places venue/address autocomplete fix, not deployed)
- **`venue-places-autocomplete_qa.tsx`:** Removed `placesReady` from input `key` — remounting after Places loaded detached Google Autocomplete from the live input (predictions never appeared).
- **`wizard-step-venue.tsx`:** `APIProvider` now passes `libraries={['places']}` (parity with event form + QA provider).

## Shipped this session (event setup checklist reorder, not deployed)
- **`event-readiness-checklist.tsx`:** Reordered steps — Square + booth layout now precede "Event published"; quarter auction step only when `listing_type` is quarter auction (`garage_yard_sale` via `isQuarterAuctionListing`).
- **`app/coordinator/events/[id]/page.tsx`:** Quarter Auctions panel and header Auctions link hidden for standard community markets.

## Shipped this session (layout canvas viewport init + 100% zoom, not deployed)
- **`use-layout-viewport.ts`:** `VIEWPORT_FIT_PADDING_PX` (40px safe-zone); `fitViewportToContent` returns target zoom and prefers pixel padding for baseline framing.
- **`use-viewport.ts`:** `fitToBounds` accepts `paddingPx`; tracks `baselineZoom` (100% toolbar readout); `getBaselineZoom()` exposed on `ViewportApi`.
- **`use-canvas-viewport-framing.ts` (new):** `ResizeObserver` on the layout background host; initial fit in `useLayoutEffect`; re-fit on container resize (toolbar/window/inspector).
- **`floor-plan-canvas.tsx`:** Container + scroll-host split (`scrollHost` prop); removed one-shot-only resize skip; normalized zoom readout via baseline; production host uses `absolute inset-0`.
- **`floor-plan-canvas-wizard_qa.tsx`:** Synced with production fit math; removed conflicting canvas-centre scroll effect; spatial layout uses `scrollHost` + `h-full overflow-auto` (wizard embedded keeps page-scroll QA classes).
- **`floor-plan-v2.tsx` / `floor-plan-v2_wizard_qa.tsx`:** Zoom reset + viewport reset call `fitViewportToContent` (100% = fit with 40px pad); canvas host `flex flex-col min-h-0 h-full`.

## Shipped this session (canvas viewport fit-to-content, superseded by padding/resize pass above, not deployed)
- **`use-layout-viewport.ts`:** `contentFramingBounds`, `fitViewportToContent`, `VIEWPORT_FIT_PADDING` (0.125 → ~75% viewport fill). Replaces hard-coded zoom-1 / canvas-centre resets.
- **`floor-plan-canvas.tsx`:** Framing runs in `useLayoutEffect` before paint; zoom anchor uses active room centroid (not full canvas centre); removed conflicting canvas-dimension scroll centering that fought `fitToBounds`.
- **`use-canvas-workspace.ts` / `floor-plan-v2.tsx`:** `resetCanvasViewport`, `ensurePlaceableDocument`, and Center View fallbacks call `fitViewportToContent` instead of `resetViewport()`.

## Shipped this session (portal route sync, not deployed)
- **Active portal resolution (`lib/portals/active-portal.ts`):** Portal-prefixed routes (`/coordinator/*`, `/vendor/*`) now override the `active_portal` cookie in `resolveActivePortal` so top nav tabs match the URL (Option A sync).
- **Middleware (`lib/supabase/middleware.ts`):** Auto-sets `active_portal` cookie when visiting coordinator or vendor routes the account may access.
- **Coordinator + vendor layouts:** Server-side cookie sync on portal route entry as a belt-and-suspenders guard.
- **Workspace chrome (`portal-workspace-layout.tsx`):** MARKET OPS sidebar / telemetry panels only render when route prefix matches the workspace portal prop.
- **QA:** `lib/portals/qa-active-portal.ts` — 5 assertions for route/cookie precedence.

## Shipped this session (Capacitor iOS shell, not deployed)
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
- **Deploy script (`deploy-popuphub.ps1`):** Clears stale `.next/lock` before build — fixes `Another next build process is already running` when dev server left a lock behind.
- **`Deploy-popuphub.bat` version tracking:** Header comment block documents floor-plan release track (object resize, measurements, viewport lock, layout fixes), prod baseline (build 155 / 7db76c6), `BUMP_BUILD_NUMBER=1` init, 5-step pipeline, optional `verify-canvas-state-smoke` / `verify-multi-room-canvas` / `verify-align-and-center` pre-flight.
- **Login QA wired to `/login`:** `app/(auth)/login/login-form.tsx` re-exports `LoginQa` — lockout + logo scale now live on `/login` and embedded signup login panel.
- **Login QA Jurassic Park lockout (`Login_qa.tsx`):** Portal to `document.body` at `z-[9999]`; fullscreen takeover on 3rd Supabase auth failure; `public/assets/nedry_magic_word.mp4` (video+audio, loop) with `public/assets/nedry.gif` fallback; always-mounted preload video primes audio on Sign-in click, then `play()` on lockout (unmuted with muted retry); **build fix:** Turbopack cannot `import` `.mp4` — serve from `/assets/` not module import.
- **Login QA logo scale (`Login_qa.tsx`):** Popup Hub wordmark `<img>` clamped to `w-44 h-auto object-contain mx-auto mb-4` (`/popup-hub-logo.png`).
- **Login QA lockout helpers (`login-lockout_qa.ts`):** Trimmed credentials + client validation; local-only password visibility toggle; strike/cooldown math. Legacy pixel CSS (`login-lockout_qa.css`) unused after video overlay — safe to delete on promotion cleanup.
- **QA dashboard wired:** `market-dashboard-client.tsx` → `DashboardBootstrapQa`; `floor-plan-v2.tsx` → `CanvasCommandBarQa`.
- **AI guardrails (`ai-generation-guardrails_qa.tsx`):** `countdown` + `isGenerating` lock; 30s cooldown; **5 runs/hour** cap; credits HUD `48 / 50`; depletion toast before generative loop.
- **Initial loader:** Computed uniform perimeter tables; removed dashed ring; logo fades into geometric ring center (`ringCenterX` / `ringCenterY` in `initial-loader-reveal.tsx`).
- **Branding:** `PopupHubIcon` deprecated → full `popup-hub-brand.png`; sidewalk dash line removed from replay loader.
- **Mobile footer/nav:** `globals.css` scales `.popup-hub-chrome-footer` to **67%** on ≤767px; `shopper-bottom-nav` + main padding `2rem`; install prompt bottom offset aligned.
- **Room modal:** Portaled to `document.body`, `z-[9999]`, body scroll lock while open, `data-testid="initial-room-modal"`.
- **Booth pricing UX:** Focus-aware sync in `market-booth-pricing-fields.tsx`; category fee rows use text + placeholder (`category-limit-editor.tsx`).
- **Canvas draw/select (wizard QA):** `use-canvas-pointer-wizard_qa.ts` — draw-tool hits select/drag existing objects instead of stacking.
- **Patron-first / supplies / instant book:** Already in tree — `/discover` default, `/supplies` Market Supplies, `verify-instant-book-category-limits.ts` 4/4.

## Shipped earlier (vendor clearance, not deployed)
- **Vendor auto-arrange spacing:** `BOOTH_PLACEMENT_GAP_FT` restored to **4′** edge-to-edge (2′ safety buffer per side via `BOOTH_SAFETY_BUFFER_FT` / `BOOTH_CORE_SEPARATION_CELLS` in `layout-clearance-constants.ts`). Grid column pitch, row-pack fallback, and deterministic layout `tableEdgeGapFt` all honor the 4′ gap; adjacent vendor tables no longer pack flush.
- **`validateClearances`:** Pair-aware minimum gaps — vendor↔vendor 4′, patron↔patron 2′, vendor↔patron 4′.
- **`patron-centric-layout.ts`:** Local edge clearance synced to 2′ per side.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` — 31/31 pass.

## Shipped this session (QA Step 3 Add room clipping fix, not deployed)
- **`qa-scroll-layout_qa.ts` + `Canvas_qa.tsx`:** Added `QA_STEP3_CONTENT_CLASS` (`flex flex-col h-full overflow-y-auto`), `QA_ADD_ROOM_FORM_CLASS` (`relative z-10`); canvas constants use `flex-grow` instead of fixed viewport height.
- **`floor-plan-v2_wizard_qa.tsx`:** Step 3 inner column uses `QA_STEP3_CONTENT_CLASS`; canvas host drops `min-h-[min(480px,50vh)]` trap; `LayoutCanvasWizardQa` gets `flex-grow`.
- **`canvas-command-bar-blocks_qa.tsx`:** Embedded `LayoutRoomBar` (Add room width/length inputs) wrapped in `QA_ADD_ROOM_FORM_CLASS` so it stacks above canvas overlay.
- **`globals.css`:** `.layout-planner-root-qa` overrides unlock `FullscreenLayout` + `.floor-plan-canvas-host` — `overflow-y-auto` on editor shell, `flex-grow` + `overflow: visible` on canvas host (replaces prod `overflow-hidden` / `height: 100%` trap for Step 3).

## Shipped this session (QA global scroll unification, not deployed)
- **`layout-planner-shell_qa.tsx`:** QA wizard Step 3 shell — no `useLayoutCanvasViewportLock`, no nested `overflow-hidden`; content flows at natural height.
- **`qa-scroll-layout_qa.ts`:** Shared `QA_GLOBAL_PAGE_SCROLL`, `QA_CANVAS_VIEWPORT_CLASS`, `QA_CANVAS_CONTAINER_CLASS` — content-sized canvas, no fixed viewport height.
- **`wizard-step-floor-plan_qa.tsx`:** Uses `LayoutPlannerShellQa`; floor plan column is `w-full flex-1` (no `h-full min-h-0` trap).
- **`floor-plan-v2_wizard_qa.tsx`:** Removed nested overflow / `basis-0` / `h-full` on canvas host; wizard canvas is `relative w-full`; inspector panel no longer scrolls internally.
- **`floor-plan-canvas-wizard_qa.tsx` + `floor-plan-canvas_dashboard_qa.tsx`:** Canvas host `overflow-visible h-auto`; wheel without Ctrl passes through to page scroll; Ctrl+wheel zoom unchanged.
- **`Dashboard_qa.tsx`:** Left rail + canvas column no longer fixed to `100vh-64px` or `overflow-y-auto`; shell uses `dashboard-app-shell--qa-global-scroll`.
- **`canvas-command-bar_qa.tsx`:** Sidebar toolbar `overflow-visible` (accordions expand page height).
- **`globals.css`:** `.layout-planner-root-qa` + `.dashboard-app-shell--qa-global-scroll` overrides — `#site-main` and `.setup-wizard-body` are the sole vertical scroll hosts.
- **`events/new/page.tsx` + `market-setup-wizard.tsx`:** Dropped `overflow-hidden` / `min-h-0` traps on Create New Market Step 3 path.

## Shipped this session (QA wizard description layout, not deployed)
- **`wizard-description-field_qa.tsx`:** Replaced floating-label `WizardFloatingTextarea` with static `WIZARD_FIELD_LABEL` + `mb-2` above a fixed-layout textarea (`min-h-[150px]`, `overflow-y-auto`, `resize-y`, `field-sizing-fixed`) so typed copy no longer overlaps the DESCRIPTION label; metrics block unchanged below.

## Shipped this session (QA canvas scroll fix, not deployed)
- **`Canvas_qa.tsx`:** `QA_CANVAS_VIEWPORT_CLASS` updated — `overflow-hidden` → `overflow-y-auto scrollbar-hide` so the main hall viewport accepts wheel scroll while hiding the track.
- **`globals.css`:** Added `.scrollbar-hide` utility (alias of `.scrollbar-none` for WebKit + Firefox).
- **`floor-plan-canvas_dashboard_qa.tsx`:** Inner `[role="application"]` scroll host restored to `overflow-auto` (matches prod `floor-plan-canvas.tsx`); outer wrapper uses updated `QA_CANVAS_VIEWPORT_CLASS` — no `onWheel`/`onScroll` on parent (wheel handled on inner via `use-viewport`).

## Shipped this session (QA absolute overrides, not deployed)
- **`Canvas_qa.tsx`:** Exported `QA_CANVAS_VIEWPORT_CLASS` (`flex-1 h-[calc(100vh-64px)] overflow-hidden relative bg-slate-50`) — structural lock for main hall viewport (superseded by scroll fix above).
- **`floor-plan-canvas_dashboard_qa.tsx`:** Canvas container `overflow-auto` → `overflow-hidden`; outer wrapper uses `QA_CANVAS_VIEWPORT_CLASS` (no right-edge scrollbar; pan/zoom handlers unchanged) — **reverted** inner to `overflow-auto` in scroll fix above.
- **`Dashboard_qa.tsx`:** Center column wrapped in `QA_CANVAS_VIEWPORT_CLASS`; exported `QA_PLACEMENT_TIP_VALID` / `QA_PLACEMENT_TIP_VIOLATION` (`Valid space` / `Rule conflict`); `QA_ACCORDION_HEADERS` + `QaAccordionHeader` h3 typography.
- **`canvas-toolbar-static_qa.tsx`:** Accordion triggers use `QaAccordionHeader` + `QA_ACCORDION_HEADERS` from `Dashboard_qa` (no row icon badges).
- **`canvas-legend_qa.tsx`:** Placement HUD microcopy wired to Dashboard QA tip constants.

## Shipped earlier this session (not deployed)
- **Vendor Supplies:** New `/vendor/supplies` page with Amazon.ca search (associate tag `thetipsyfox08-20`), 15 curated booth/display/packaging picks (all affiliate links), category + local filters, mandatory disclosure. Nav: **Vendor Supplies** in app nav + vendor workspace rail. Shared `lib/affiliate/amazon.ts` (material checklist re-exports). Verify: `npx tsx scripts/verify-vendor-supplies.ts`.

## Shipped earlier this session (QA staging, not deployed)
- **`Dashboard_qa.tsx`:** `QA_PANEL_SCROLL_CLASSES` (`scrollbar-none` + WebKit/MS/Firefox hide); `DashboardLeftPanelQa` portal target is the sole scroll host (`overflow-x-hidden overflow-y-auto`, no visible tracks).
- **`canvas-command-bar_qa.tsx`:** Sidebar layout uses `overflow-hidden` so accordions scroll via portal target only (no nested scrollbars).
- **`tooltip-wrapper_qa.tsx`:** Left-rail anchors always pop right (`translateY(-50%)`, `anchor.right + 8px`); viewport edge clamp; scroll/resize listeners keep portal position in sync.
- **`canvas-toolbar-static_qa.tsx`:** Accordion headers → **ROOM CONTROLS**, **PATRON LAYOUT**, **VENDOR BOOTHS**, **DESIGNER TOOLS** (row icon badges removed; uppercase `h3` titles).
- **`Canvas_qa.tsx` + `floor-plan-canvas_dashboard_qa.tsx`:** Stage `fill="none"` single perimeter; `pointerEvents="all"` + `cursor: move`; `SelectionOverlayQa` skips duplicate dashed outline on selected stages; stage stays visible after merge join.
- **`toolbar-tooltip-copy_qa.ts` + command-bar blocks:** Micro-tooltip copy wired across toolbar/object brushes.
- **Build:** Local `npm run build` passes — **build 142** (uncommitted; `build-number.json` bumped by prebuild).

## Shipped earlier this session (QA staging, not deployed)
- **`toolbar-tooltip-copy_qa.ts`:** Centralized micro-tooltip strings (e.g. `Clear all`, `Auto-arrange`, `Merge rooms`, `Space H`) — replaces long descriptive sentences across command-bar blocks.
- **`tooltip-wrapper_qa.tsx`:** Compact bubble styling (`text-xs px-2 py-1 bg-slate-800 text-white rounded shadow-sm`); narrower width estimate cap (160px).
- **`canvas-toolbar-static_qa.tsx`:** Accordion headers → **ROOM CONTROLS**, **PATRON LAYOUT**, **VENDOR BOOTHS**, **DESIGNER TOOLS** with `text-xs font-bold tracking-wider text-slate-700 uppercase`; chrome tooltips shortened.
- **`canvas-command-bar-blocks_qa.tsx` + `canvas-command-bar_qa.tsx`:** All toolbar/object-brush tooltips wired to micro-copy constants; merge/join hints shortened.

## Shipped earlier (QA staging, not deployed)
- **QA mirror modules written to disk** under `src/qa_review/` (previously documented only).
- **`tooltip-wrapper_qa.tsx`:** Portal tooltips (`fixed z-50` on `document.body`) with sidebar bounds check — flips to the right when hint would clip past `w-80` (320px).
- **`canvas-toolbar-static_qa.tsx` + `canvas-command-bar_qa.tsx` + `command-button_qa.tsx` + `canvas-command-bar-blocks_qa.tsx`:** Uppercase text accordion headers (**ROOM LAYOUT**, **PATRON PLACEMENTS**, **VENDOR PLACEMENTS**, **CANVAS SETTINGS**); all command-bar tooltips use portal wrapper.
- **`Dashboard_qa.tsx`:** `DashboardBootstrapQa` + `DashboardLeftPanelQa` with relative portal target wrapper; mandatory initial room modal gate.
- **`Canvas_qa.tsx`:** Stage single outer rect (`fill="none"`); excluded from joined-fixture dissolve hiding; `cursor: move` hit target; stays visible after merge join.
- **`floor-plan-canvas_dashboard_qa.tsx`:** `LayoutCanvasDashboardQa` + `SelectionOverlayQa` skips duplicate dashed outline on selected stages.
- **`Merge_qa.ts` + `destructive-merge_qa.ts`:** Merge (2) 2D union bounds re-export; `npx tsx scripts/verify-merge-qa.ts` — 7/7 pass.
- **Docs:** `dashboard-layout-patch_qa.md` + `MANIFEST.md` wiring for `CanvasCommandBarQa`.

## Next actions — native mobile (iOS)
1. **Commit mobile shell** — `capacitor.config.ts`, `mobile/`, `ios/`, `scripts/mobile/`, `PM/ios-testflight.md` (no `.env`).
2. **Apple Developer setup** — App ID `ca.popuphub.app`; Distribution cert + App Store provisioning profile (or Xcode automatic signing).
3. **App Store Connect app** — create iOS app record; SKU `popuphub-ios-001`.
4. **Supabase Auth** — add redirect `ca.popuphub.app://auth/callback`; smoke email/OAuth on device.
5. **Mac archive → TestFlight internal** — follow `PM/ios-testflight.md`: `npm run mobile:sync` → `npm run mobile:ios:open` → Archive → Upload → internal testers.
6. **Native polish pass** — safe-area QA on iPhone/iPad, overscroll bounce, `apple-app-site-association` for universal links.
7. **App Store (later)** — metadata, screenshots, privacy labels, review notes (coordinator/vendor tooling, not generic web wrapper).
8. **Android (later)** — `npx cap add android` after iOS path proven.

## Next actions — web / QA
1. **Layout canvas init smoke-test** — `/coordinator/events/[id]/layout`: room bounds visible at **100%** on first load (no manual zoom-out); resize window / toggle inspector → canvas re-fits with 40px margin
2. **Step 3 Add room smoke-test** — `/coordinator/events/new` Step 3 with zero rooms: Width/Length inputs + Add room button visible (not clipped); page scrolls if toolbar exceeds viewport
2. **Global scroll smoke-test** — `/coordinator/events/new` Step 3 + `/coordinator/dashboard`: only one browser scrollbar (right edge); no nested canvas/map scroll track; Ctrl+wheel still zooms canvas
2. **Canvas wheel smoke-test** — `/coordinator/dashboard`: scroll wheel over canvas scrolls page (not inner trap); Ctrl+wheel still zooms
2. **Mobile smoke-test** — `/discover` scroll + reduced footer; `/coordinator/dashboard`: initial room modal first, table size selectable
2. **Loader smoke-test** — hard refresh: perimeter booths, centered full logo, no grid/dash lines
3. **Wizard smoke-test** — Step 2 booth fee / discount backspace; category price placeholders
4. **Instant book** — re-run `npx tsx scripts/verify-instant-book-category-limits.ts` after any apply-route edits (currently 4/4)
5. **OpenRouter (deferred)** — user spec §5 truncated; no OpenRouter spatial-AI wiring in this pass
6. **Login QA smoke-test** — `/login`: 3 wrong passwords → fullscreen Nedry video (magic-word audio) + 30s lock; confirm `/assets/nedry_magic_word.mp4` loads on prod after deploy; verify trim + toggle do not leak globally
7. **Commit + deploy** when ready (`PM/Deploy-popuphub.bat` or `ship.ps1`); promote `_qa` modules after sign-off

## Goal (prior)
**QA folder staging — dashboard layout optimization & stage merge** — all layout/merge/canvas changes mirrored in `src/qa_review/` for manual testing before production promotion.

## Shipped earlier (QA staging, not deployed)
- **`Dashboard_qa.tsx`:** `DashboardBootstrapQa` — curation queue / Market Intake / Available Pool removed from left rail; `h-[calc(100vh-64px)] overflow-hidden` on aside; mandatory `InitialRoomModalQa` gates canvas mount until first room dimensions confirmed.
- **`Canvas_qa.tsx`:** Stage placable rects render with `fill="none"` / `fillOpacity={0}` (rose stroke retained) so grid shows through after merge.
- **`Merge_qa.ts` + `destructive-merge_qa.ts`:** Merge (2) union uses full 2D stage bounding box (`mergeParticipantBounds2d`) — not a width-only horizontal line projection.
- **`floor-plan-canvas_dashboard_qa.tsx`:** Canvas host wired to `CanvasObjectsQa` for optional E2E swap.
- **`dashboard-layout-patch_qa.md` + MANIFEST:** Wiring steps, smoke-test checklist, promotion gate.
- **Verify:** `npx tsx scripts/verify-merge-qa.ts` — 7/7 pass.

## Next actions
1. **Wire QA dashboard** — swap `DashboardBootstrap` → `DashboardBootstrapQa` in `market-dashboard-client.tsx` (see `dashboard-layout-patch_qa.md`)
2. **Optional canvas/merge E2E** — temporary import swaps for `LayoutCanvasDashboardQa` and `destructive-merge_qa`
3. **Smoke-test** — initial room modal, no left-rail scrollbar, stage merge bump, stage fill none
4. **Promote to production** after QA sign-off (do not edit main paths until then)

## Goal (prior)
**UI architecture — maximize canvas space & initial room modal** — purge curation queue from dashboard left rail, mandatory first-room modal before canvas mount, zero inner scrollbars on utility panel, floating Placement HUD.

## Shipped this session (local, not deployed)
- **Curation queue removed from dashboard:** `dashboard-left-panel.tsx` replaces `DashboardCurationColumn` — left rail is layout-tool accordions only (Room / Patron / Vendor / Object Brushes via toolbar portal). Curation column files retained but unused in bootstrap.
- **Left panel sizing:** `dashboard-app-shell.tsx` + bootstrap pass `w-80`, `h-[calc(100vh-64px)]`, `overflow-hidden` on left aside; grid column `20rem | 1fr`. `canvas-command-bar.tsx` drops sidebar `max-h` / `overflow-y-auto`; portal target uses `flex-1 overflow-hidden`.
- **Mandatory initial room modal:** `initial-room-modal.tsx` + `hasInitialRoom` in `dashboard-bootstrap.tsx` — events with no saved rooms show blurred overlay + 50×50 ft dimension form; canvas mounts only after confirm (`addLayoutRoomToList`). Existing layouts skip modal.
- **Canvas footprint:** Dashboard floor-plan column gap removed; canvas host `flex-grow`; `CanvasLegend` (Placement HUD) pinned `absolute top-4 right-4 z-10` with `shadow-lg`.
- **Header copy:** Removed “curation queue” from command-center subtitle.
- **Build:** Local `npm run build` passes (build **136**, uncommitted).

## Next actions
1. **Dashboard layout smoke-test** — `/coordinator/dashboard`: new market with no rooms → initial modal → canvas opens; left panel has no inner scrollbar; Placement HUD floats top-right; Full canvas mode still works
2. **Existing layout smoke-test** — market with saved rooms skips modal; toolbar accordions fit in left rail without clipping on 1080p
3. **Commit + deploy** when ready
4. **Optional cleanup** — delete unused `dashboard-curation-column.tsx`, `curation-queue-column.tsx`, `vendor-pool-shelf.tsx` if curation is permanently out of dashboard scope

## Goal (prior)
**UI polish — modern scrollbar styles** — slim 8px rounded slate scrollbars on dashboard layout panes, canvas viewport, and overflow dropdowns via global CSS pipeline.

## Shipped earlier this session (local, not deployed)
- **Modern panel scrollbars:** `app/globals.css` — CSS vars (`--scrollbar-size`, `--scrollbar-thumb`, hover state), reusable `.scrollbar-modern` utility, and scoped rules for `.dashboard-app-shell` overflow panels (curation queue / Available pool shelf), `#floor-plan-workspace` canvas viewport, `.layout-planner-root`, and `[data-slot='select-content']` / `[data-slot='dropdown-menu-content']`. WebKit 8px rounded thumbs + Firefox `scrollbar-width: thin`; dark mode thumb tokens.
- **Mobile-first Experience Designer:** `workspace-shell.tsx` stacks wizard / canvas / inspector on phones with a bottom tab bar; step header scrolls horizontally with 48px touch targets; wizard CTAs use `touch-target` + `min-h-12`. Shared `hooks/use-mobile-viewport.ts`; floor-plan workspace reuses it.
- **Dashboard touch targets:** `CommandButton` enforces `min-h-12 min-w-12` below `md`, compact icon sizes on desktop. Global `.touch-target` utility in `globals.css` (48×48px minimum).
- **Fluid page containers:** Profile, notifications, applications, passport pages use `w-full max-w-* px-4 sm:px-6` instead of fixed desktop padding that caused horizontal scroll on narrow viewports.
- **SEO metadata pipeline:** `lib/seo/site-config.ts`, enhanced `buildPublicMetadata` (canonical, robots, metadataBase, OpenGraph locale). Theme catalog in `lib/seo/experience-theme-metadata.ts` with per-theme titles/descriptions. Experience Designer `generateMetadata` reads `?theme=` search param.
- **Sitemap + robots:** `app/sitemap.ts` + `lib/seo/collect-sitemap-entries.ts` (static routes, published events, coordinator/patron profiles, theme template URLs). `app/robots.ts` allows public browse paths, disallows authenticated app areas. Offline generator: `npm run seo:sitemap` → `scripts/generate-sitemap.ts`.
- **CWV — code splitting:** Experience Designer page dynamically imports workspace shell; `BlueprintCanvas` (React Flow) lazy-loaded with Suspense skeleton. Existing dashboard column lazy imports preserved.
- **CWV — images:** `next.config.ts` enables AVIF/WebP formats; new `components/ui/responsive-image.tsx` (`ResponsiveImage` / `ResponsiveNativeImage` with lazy loading + aspect-ratio CLS guard). Auction room hero migrated.
- **CWV — CLS:** Council telemetry streaming panels reserve min-height while AI content loads (`council-telemetry-panel.tsx`).
- **Semantic HTML:** Public landing wrapped in `<main>`; patron public profile uses `<main>`, `<nav>`, `<article>`. Patron page gets `generateMetadata`.
- **Build:** Local `npm run build` passes (build **134**).

## Next actions (prior)
1. **Scrollbar smoke-test** — `/coordinator/dashboard`: pan/zoom canvas viewport, open a long Select/Dropdown in floor-plan toolbar; confirm 8px rounded slate thumbs on Chrome/Safari/Firefox
2. **Mobile smoke-test** — `/coordinator/experience-designer` on phone: bottom tabs switch wizard/canvas/inspector; step header tappable; no horizontal page scroll
3. **SEO verify** — curl https://popuphub.ca/sitemap.xml and /robots.txt after deploy; spot-check `/events/[id]` and `/coordinator/experience-designer?theme=cyber_heist` meta tags
4. **Theme OG art** — replace placeholder `/icons/icon-512x512.png` in `EXPERIENCE_THEME_CATALOG` with dedicated `.webp` theme cards under `public/experience-designer/themes/`
5. **Image migration** — remaining raw `<img>` tags (shopper cards, passport avatars, flyer upload previews) → `ResponsiveNativeImage` where LCP-sensitive
6. **Defer for INP** — `@xyflow/react` (Experience Designer canvas), `@dagrejs/dagre`, Square/Twilio SDKs, AI streaming parsers in `/api/experience-designer/*` — already code-split for canvas; consider dynamic import for MaterialChecklistPanel and council telemetry on first inspector open
7. **Commit + deploy** when ready

## Goal (prior)
**Coordinator smoke-test on prod** — verify layout fixes shipped in build **106** (`cde554e` @ https://popuphub.ca). Auto-arrange keeps vendor and patron on **separate passes** (see **Vendor placements** / **Patron placements** below). Verify vendor-only and patron-only behavior with `npx tsx scripts/verify-auto-arrange.ts` (guest-table section today; extend when patron mode parity ships).

**Fixed (local):** Vendor auto-arrange no longer **deletes** booths when obstacles / space restrictions block some deterministic slots — scans all valid grid slots, fallback row-pack, keeps unmoved booths at their prior position when reposition fails (toast: “left in place”). `lib/floor-plan/deterministic-market-layout.ts` + `engine/auto-arrange.ts`.

## Vendor placements

Vendor units are rectangular sellable placements (`tablePurpose: 'vendor'`). They drive venue capacity, hall baseline, category proximity, and multi-table consolidation.

| Aspect | Detail |
|--------|--------|
| **Draw** | Toolbar **Vendor**; Table size pill **Vendor** column (rectangular, hall baseline length) |
| **Canvas** | Solid vendor rectangle (amber/yellow fill); included in booth matrix / placement status / telemetry |
| **Consolidation** | Multi-table vendors collapse to one footprint before arrange (`consolidateBoothsForAutoArrange`) |
| **Auto-arrange scope** | **Vendor only** — patron is never moved or merged in this pass |
| **Auto-arrange modes** | **Grid** — aligned rows/columns, 8′ aisles, entrance-first row order · **Staggered** — alternating half-width row offset for sightlines · **Perimeter** — boundary loop (top → right → bottom → left) |
| **Engine** | `autoArrangeVendorBooths` in `components/coordinator/floor-plan-v2/engine/auto-arrange.ts`; layout modes via `lib/floor-plan/deterministic-market-layout.ts` |
| **Toolbar** | **Vendor** ribbon block: **Vendor** draw + Vendor size pill + mode select (Grid / Staggered / Perimeter) + **Auto-Arrange**; enabled when ≥1 vendor in active room |
| **Shipped** | Dedicated vendor toolbar block (`vendor` in `toolbar-order.ts` / `canvas-command-bar-blocks.tsx`); `scope: 'vendor'` in `auto-arrange.ts` |
| **Verify** | `npx tsx scripts/verify-auto-arrange.ts` — grid, staggered, perimeter, multi-room, category proximity |

## Patron placements

Patron (guest) seating is non-vendor (`tablePurpose: 'guest'`). Round and banquet sizes; they do **not** change venue capacity or hall baseline.

| Aspect | Detail |
|--------|--------|
| **Draw** | Toolbar **Round** / **Patron**; Table size pill **Round** or **Patron** columns (5′ / 6′ / 8′) |
| **Canvas** | Round = violet/purple ellipse; patron = dashed violet/purple rectangle; excluded from vendor “Unassigned” styling and booth matrix vendor counts |
| **Consolidation** | None — each placement keeps its laid footprint (round stays circular) |
| **Auto-arrange scope** | **Patron only** — vendor is obstacles/fixed context, not rearranged in this pass |
| **Auto-arrange modes (target)** | Same three options as vendor: **Grid**, **Staggered**, **Perimeter** — applied only to patron, respecting vendor footprints and structural obstacles |
| **Bounding box (shipped)** | Patron auto-arrange computes an **active bounding box** around existing patron tables (+1′ padding) and generates grid/staggered slots **only inside that box** — no full-room sweep into vendor zones |
| **Non-destructive abort (shipped)** | If tables cannot fit equidistantly inside the box, engine **halts** and keeps original coordinates; toast: *Could not automatically adjust tables. Manual placement is required to fit this density.* |
| **Engine (shipped)** | `arrangeGuestTables` + `guestActiveBoundingBox` — Grid / Staggered / Perimeter via deterministic slots + row-pack fallback confined to active box; vendor footprints as restricted zones; preserves laid width/height |
| **Engine (target)** | Patron perimeter on merged-zone rings; mixed-size round+rect grid tuning |
| **Toolbar** | **Patron** ribbon block: **Round** / **Patron** + Round/Patron size pill + mode select + **Auto-Arrange**; enabled when ≥1 patron in active room — independent of vendor mode state |
| **Shipped** | Dedicated patron toolbar block; `scope: 'patron'` keeps vendor fixed while `arrangeGuestTables` runs (`isGuestTableBooth` in `lib/booth-planner/table-shape.ts`) |
| **Verify** | Guest-table + isolated-scope blocks in `scripts/verify-auto-arrange.ts` (10/10 pass in those sections) |

## Shipped this session (local, not deployed)
- **Dashboard layout tools in left panel:** Removed **Event overview** back links from command-center header and curation column. Floor-plan `CanvasCommandBar` (static layout) portals into the left rail via `dashboard-toolbar-portal.tsx` on desktop — canvas column is toolbar-free for more layout space. Mobile and **Full canvas** immersive mode keep the ribbon above the canvas. `sidebarLayout` on `canvas-command-bar.tsx` drops the 36vh height cap for vertical scrolling in the rail.
- **Condensed canvas toolbars:** Floor-plan command ribbon, static dashboard rows, venue layout palette, and canvas utility bar are icon-only with `TooltipWrapper` labels. `CommandButton` is square (~1.65rem compact); removed Vendor/Patron/Room section badges and table-size column headers; embedded room bar uses icon **Add room**; reset/reorder chrome tightened. Files: `command-button.tsx`, `canvas-command-bar-blocks.tsx`, `canvas-toolbar-static.tsx`, `canvas-toolbar-reorder.tsx`, `layout-room-bar.tsx`, `table-size-pill.tsx`, `venue-layout-toolbar.tsx`, `canvas-utility-toolbar.tsx`.
- **Gemini → Groq AI fallback:** Flyer vision parse (`lib/flyer/parse-flyer-vision.ts`) tries Gemini first (`GEMINI_API_KEY` + `GEMINI_MODEL_ID`), then Groq when quota/rate-limit/overload errors occur. Groq key reads `GROQ_API_KEY` or Vercel alias `POPUPHUB_API_KEY`; model defaults to `llama-3.2-90b-vision-preview` (`GROQ_MODEL_ID` optional). Shared helpers in `lib/ai/`. Verify: `npx tsx scripts/verify-ai-provider-fallback.ts`. **Note:** Experience Designer planning sessions still proxy to the external Master Generator backend — that service needs its own Gemini→Groq fallback if theme generation should use this pattern.
- **Build fix (TS):** `CanvasPointerApi.onPointerDown` return type updated to `boolean` (implementation already returned handled flag; `floor-plan-canvas.tsx` truthiness check failed typecheck). `scripts/verify-room-merge-two-rooms.ts` — full `LayoutRoom` shape for legacy projection test. Local `npm run build` passes (build **131**).
- **Vendor booth spacing (superseded):** Earlier session set `BOOTH_PLACEMENT_GAP_FT = 0`; **reverted** — vendors again use 4′ edge-to-edge gap (2′ per side). See “Shipped this session (vendor clearance)” above.
- **Patron vs vendor canvas colors:** Patron/guest tables render with violet fill (`#ddd6fe` / stroke `#5b21b6`); vendor booths without a category stay amber/yellow (`DEFAULT_BOOTH_PALETTE`). `PATRON_TABLE_PALETTE` in `category-palette.ts`; `fillForObject` / `strokeForObject` in `canvas-objects.tsx`.
- **Room merge + stage fill fix:** Destructive **Merge (2)** now picks the top-left participant as the surviving room (union min origin), reassigns `objectRoom` for absorbed rooms, and `legacyRoomsFromDoc` drops removed rooms so the wizard sidebar matches the single merged hall. Post-merge sync passes the merged room id as active. Stage assets render with `fill: transparent` / `fillOpacity: 0` (rose stroke retained). `room-union-merge.ts`, `legacy-bridge.ts`, `floor-plan-v2.tsx`, `canvas-objects.tsx`, `canvas-overlays.tsx`. Verify: `npx tsx scripts/verify-room-merge-two-rooms.ts`, `verify-destructive-merge.ts`, `verify-multi-room-canvas.ts`.
- **Room move/resize on canvas:** Drag the room perimeter or empty interior to reposition; eight corner/edge handles resize the footprint (booth/fixture children move/scale with the frame). **Select** or **Hand** tool — Hand still pans empty canvas but room strokes/handles take priority (clicks on placed objects do not drag the room). Auto-switches to **Select** after **Add room**; room tab / perimeter click also switch to Select. `use-canvas-pointer.ts`, `floor-plan-canvas.tsx`, `floor-plan-v2.tsx`. Verify: `npx tsx scripts/verify-multi-room-canvas.ts` (27/27 pass).
- **Passport story logo fallback:** Story cards and public carousel use `resolveStoryBackground` (`story image → brand logo → /placeholder-logo.png`). Logo/placeholder thumbnails get `object-contain bg-neutral-900 p-4`; video clips bind `poster={logoUrl}` on `<video>` in uploader detail modal and full-screen viewer. `lib/passport-stories/story-media.ts`, `hooks/use-owner-brand-logo.ts`, `passport-story-uploader.tsx`, `passport-story-viewer.tsx`, `public/placeholder-logo.png`.
- **Market Promo expandable card:** Passport story preview cards on `/profile/passport` use `object-contain` + `bg-gray-50` for logo thumbnails (no edge clipping). Cards are clickable (`hover:shadow-md transition-all cursor-pointer`) and open a Full Details dialog with uncropped caption + full-size media; backdrop click and Close dismiss. `components/passport/passport-story-uploader.tsx`.
- **Profile vs Passport split:** Profile settings limited to private account data — Legal Name, Private Email, phone (labeled *Private — Used only for automated system SMS alerts*), shopper auction contact toggle, `AccountSecurityCard` (Change Password), and `NotificationPreferencesGrid` in the main column. Organization name, website, bio, and social links removed from profile form; `use-profile-settings` writes only `profiles`. Passport forms use `use-passport-profile` → `vendor_passports` (bio, social, logistics). `lib/passport/public-passport-index.ts` + service client loads public-safe fields for `/coordinators/[id]` and `/patrons/[id]` via `PassportPublicCard` (Instagram/Facebook/Website icon links). Migration `091_passport_social_logistics.sql`: `facebook_url`, `requires_electricity` on `vendor_passports`; vendor wizard + coordinator review drawer wired.
- **Profile settings expansion (prior):** `AccountSecurityCard`, `NotificationPreferencesGrid`, `use-notification-preferences` — still in place; org fields moved off profile per split above.
- **Toolbar distribute spacing:** View/align ribbon block adds **Distribute horizontal** and **Distribute vertical** buttons (`AlignHorizontalDistributeCenter` / `AlignVerticalDistributeCenter`). Requires 3+ selected objects; `distributeSelectionPatches` in `geometry.ts` evenly spaces centers between endpoint anchors (locked endpoints stay put). Wired through `floor-plan-v2.tsx`, `canvas-command-bar.tsx`, `canvas-tool-types.ts`. Verify: `npx tsx scripts/verify-align-and-center.ts` (20/20 pass).
- **Patron bounding-box auto-arrange:** `guestActiveBoundingBox` (+1′ padding) confines patron grid/staggered slot generation to the imaginary sub-box around manually placed tables. `scope: 'patron'` passes `activeBoundingBox` into `arrangeGuestTables`; slots filtered to `[MinX, MaxX] × [MinY, MaxY]`. All-or-nothing: if every table cannot be rearranged inside the box, `patronArrangeAborted` is set, coordinates unchanged, UI shows density toast (no partial wipe). `PATRON_ARRANGE_DENSITY_ERROR` exported from `engine/auto-arrange.ts`; handlers in `floor-plan-v2.tsx` + QA mirror skip `replaceObjects` on abort.
- **Isolated vendor / patron auto-arrange:** Vendor pass (`scope: 'vendor'`) treats placed patron tables as fixed obstacles (2′ clearance) while rearranging only vendor booths; patron pass (`scope: 'patron'`) keeps vendor booths fixed and packs only guest tables away from vendor footprints. `AutoArrangeScope` in `engine/auto-arrange.ts`; toolbar handlers already pass `scope`.
- **Vendor footprint preservation:** `placeBoothsAtSlots` uses each source booth's laid width/height (not median grid cell); single-table vendors skip dimension normalization in `consolidateBoothsForAutoArrange`.
- **Patron mode parity (Grid / Staggered / Perimeter):** `arrangeGuestTables` accepts `mode` + runs deterministic slot generation (with vendor + structural restricted zones), falling back to row-pack; unmoved tables stay at last valid position. Round/patron diameters preserved.
- **Scoped placedCount:** Vendor toast counts repositioned vendors only; patron toast counts placed guest tables — fixed patrons inflating vendor success count.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` — patron bounding-box block (3/3 pass: padding, dense abort, roomy rearrange inside box); isolated-scope block (6/6 pass); 27/28 total (remaining failures: pre-existing multi-table consolidation + legacy angled/perimeter mode assertions).
- **Initial loader full logo:** Replaced icon-only center mark with the full brand lockup (`popup-hub-brand.png`: storefront + "Popup Hub" wordmark). Removed duplicate SVG wordmark text; tagline and progress bar unchanged. Updated master `public/popup-hub-logo.png` from official lockup and ran `npm run assets:logo`. Service-worker cache bumped to `v13`.
- **Mobile page scroll fix:** Coordinator/vendor workspace pages (`CommandCenterShell`, `DashboardAppShell`) hide left/right rails below `lg` so the center column fills the viewport and scrolls. `events/new` and setup wizard bodies use the same scroll shell. Fixes clipped main body on phones.
- **Mobile wizard field overlap fix:** Floating inputs/textareas use `min-h-14` / `!h-auto` instead of fixed `h-11` so labels and entered text no longer collide.
- **Brand logo refresh:** Replaced master `public/popup-hub-logo.png` with the official forest-green storefront lockup (994x1024). Ran `npm run assets:logo` to regenerate `popup-hub-brand.png`, `popup-hub-icon.png`, `logo.png`, favicons, PWA icons, and `app/icon.png` / `apple-icon.png`. Fixed `scripts/process-logo.mjs` atomic writes on Windows. Updated nav/footer/auth logo dimensions (`popup-hub-logo.tsx`), loader pin offset (`loader-variants/shared.ts`), animation wordmark/stroke colors to `#2d5a27` (`popup-loader-scene.tsx`, `initial-loader-reveal.tsx`), PWA `theme_color`, and service-worker cache `v11`.
- **CI lint fix:** `prefer-const` on `rowStartX` in `auto-arrange.ts` — GitHub CI `npm run lint` was failing (1 error, 359 warnings). Local lint now exits 0. Vendor was dropped from the doc when deterministic slots overlapped obstacles or failed the 2′ edge rule, even with open floor left. Layout now walks **all** valid slot candidates (not just the first N), perimeter slots respect restricted zones, column pitch includes the 2′ edge gap, and a fallback grid scan runs before giving up. Unplaced vendor **stays on canvas** at its last valid position (not removed); toast says “left in place”. Verify: `npx tsx scripts/verify-auto-arrange.ts` (15-vendor wall case + main grid cases).
- **Food truck placement (canvas-open):** New `food_truck` fixture kind and toolbar **Food truck** draw tool. Trucks may sit anywhere inside the advisory canvas bounds, including parking areas outside room polygons (no room owner / no perimeter touch required). Inside a room, centroid still resolves `objectRoom` for save bridge. Legacy round-trip via `custom_label` + `FOODTRUCK@` sentinel. `lib/floor-plan/canvas-open-placement.ts`, `is-point-in-room.ts`, `use-canvas-pointer.ts`, canvas render + QA pointer. Verify: `npx tsx scripts/verify-food-truck-placement.ts`.
- **Viewport zoom/pan flicker fix:** `frameActiveRoom` depended on the `viewport` API object, which is recreated every render (including each zoom tick). That re-ran `fitToBounds` continuously — zoom buttons flickered and scroll snapped back to the room center. Framing now reads `viewportRef` and only runs when `viewportFramingKey` / `roomsFramingKey` changes (room switch, resize, merged zone). `floor-plan-canvas.tsx` + QA mirror.
- **Clear all crash fix:** `useCanvasStore` memoizes its return value so dashboard `onStoreReady` / `registerFloorPlanStore` no longer run every render (max-update-depth / page crash after Clear all). Wizard QA `handleClearAll` clears parent `layoutRooms` and suppresses auto Main Hall (parity with production). `use-canvas-store.ts`, `floor-plan-v2_wizard_qa.tsx`.
- **Patron: no vendor “Unassigned” styling; draw stays patron:** Patron is excluded from dashboard booth placement status (canvas fill, booth matrix a11y table, telemetry booth counts). Resizing a selected patron via the Round/Patron pill now syncs the next-draw template so a follow-up placement does not fall back to vendor. `floor-plan-v2.tsx`, `market-management-context.tsx`, `canvas-objects.tsx`, `booth-matrix-a11y-table.tsx`. Verify: `npx tsx scripts/verify-canvas-state-smoke.ts`.
- **Table size / draw mode: last placed table stays put:** New draws auto-select the object; switching Round ↔ Vendor or Round ↔ Vendor pill columns was reshaping the selection via `planTableSizeChange`. Now patches apply only when purpose+shape match the selection; cross-category changes update the next-draw template and clear selection. Draw-toolbar buttons use `templateOnly`. `table-size-selection.ts` + `floor-plan-v2.tsx` / wizard QA. Verify: `npx tsx scripts/verify-canvas-state-smoke.ts`.
- **Auto-arrange: separate vendor vs patron passes:** Vendor uses grid/staggered/perimeter (`autoArrangeVendorBooths`). Patron runs a second pass (`arrangeGuestTables`) — excluded from vendor consolidation and the vendor grid; row-pack near draw origin or open space away from vendor, preserving laid width/height (round stays circular). `AutoArrangeScope` (`vendor` / `patron` / `all`) in `auto-arrange.ts`.
- **Toolbar split: Vendor / Patron / Room:** Canvas ribbon reorganized into three labeled blocks — **Vendor** (Vendor draw + Vendor sizes + vendor auto-arrange), **Patron** (Round/Patron + Round/Patron sizes + patron auto-arrange), **Room** (tabs, rotate, merge/unjoin). Canvas tools (select/hand, walls, doors, label, delete) stay in **primitives**; history, align, zoom, save in other blocks. `TableSizePill` accepts `sections: 'vendor' | 'patron'`. Legacy toolbar block ids migrate on load (`toolbar-order.ts`). QA mirrors updated.
- **Toolbar labels:** Draw tools and size-pill columns use **Vendor** / **Round** / **Patron** (not Booth, Patron rect, or “vendor booths”). Reorder palette block titles match.
- **Layout toolbar reorder + labels:** Dashboard static ribbon rows — **Room** on top, **Patron** then **Vendor**, workspace tools (select, history, align, zoom, save) on bottom. Patron tools labeled **Patron · Round · Rectangle**; size pill rect column **Rectangle**. Canvas fallback labels: **Vendor** / **Patron** (not Booth). Header row ~10% shorter in static layout (`ToolbarCompactProvider`).
- **Dashboard toolbar collapse + reorder:** `staticLayout` ribbon rows (Room, Patron, Vendor, Canvas tools) are individually collapsible (chevron toggle) and reorderable (move up/down). Order + collapsed map persist in `localStorage` (`toolbar-static-layout.ts`, `canvas-toolbar-static.tsx`). **Reset layout** restores defaults. Wizard ribbon unchanged (`CanvasToolbarReorder` horizontal drag).

## Shipped this session (prod build 106, `cde554e`)
- **Deploy tooling fix:** `update-session-handoff.ps1` uses ASCII `-` / `->` / `|` instead of Unicode dashes/arrows so Windows PowerShell 5 parses strings; `deploy-popuphub.ps1` always records https://popuphub.ca in baseline.
- **Tipsy Fox material checklist (Experience Designer):** `processMaterialChecklist` + Zod schema normalize AI `material_checklist` (and legacy BOM strings) into sorted required/optional rows with Amazon.ca affiliate search URLs (`tag=thetipsyfox08-20`), title-case names, catalog hints (Cryptic Symbols → SVG art, Elemental Weights → periodic table chart note). Zone inspector renders `MaterialChecklistPanel` with mandatory associate disclosure and **no static prices**. Verify: `npx tsx scripts/verify-material-checklist.ts`.
- **Build fix (TS):** `joinablePlacementProbe` probe object cast to `PlacedObject`; `isValidPlacementLocationBBox` accepts optional `kind` on placement probes so legacy callers without `kind` still type-check. Local `npm run build` passes (build **105**).
- **Object select measurements:** Single-select shows W×H (or diameter for round guest tables) on-canvas below the selection and in the toolbar next to the Table size pill (`formatObjectDimensions` + `highlightedSelectionMetrics`).
- **Object canvas resize:** Eight corner/edge handles on selected booths, tables, walls, stages, etc. (`object-resize.ts`, `SelectionOverlay` controls layer above room chrome). Drag respects snap grid, canvas bounds, overlap rejection, and syncs booth `tableLengthFt` / guest round-square / vendor depth rules. Table clusters stay non-resizable (derived footprint). QA wizard pointer + canvas mirrored.
- **Viewport pan/zoom lock fix:** `ResizeObserver` on the canvas scroll container was calling `fitToBounds` on every resize (including scrollbar appearance), snapping the room back to center and fighting wheel pan/zoom. Now reframes only once when the viewport first becomes measurable. `roomsFramingKey` no longer includes room `originX`/`originY`, so dragging a room does not reset the camera.
- **Stage placement outside room:** Joinable fixtures (`stage`) may be drawn flush against a room perimeter when the centroid sits outside the interior — `resolvePlacementRoomIdForObject` + `isValidObjectPlacement` in `is-point-in-room.ts`; wired through production pointer, QA wizard pointer, and `geometry-sanitize`. Verification: `npx tsx scripts/verify-asset-type-joins.ts`.
- **Blank-start: add room first (only option):** When `layoutRooms` is empty, canvas toolbar shows only the rooms block (`needsRoomFirst` in `getVisibleToolbarBlockIds`). `LayoutRoomBar` renders width/length (ft) inputs + **Add room** (no preset picker). Shared `appendLayoutRoom()` in `lib/coordinator/add-layout-room.ts`. Wizard left rail hides room tabs until at least one room exists (toolbar owns first-room UX). Tool forced to **hand** until a room exists.
- **Booth select/move after auto-arrange:** Wizard QA pointer hook ran room drag before booth hit-test — any click inside the room moved the room instead of selecting booths. Reordered to match production (booths first). `hitTest()` now uses table-cluster compound bounds (gaps between sub-tables after consolidation). Transparent compound hit rect on cluster SVG; geometric fallback when DOM misses.
- **Patron seating (not vendor):** `tablePurpose: 'vendor' | 'guest'` on booths. Step 3 **Table size** pill has three groups — **Vendor** (rectangular, hall baseline), **Round** (5′/6′/8′ guest), **Patron** (5′/6′/8′ banquet, 2.5′ depth). Patron does not change venue capacity or hall baseline. Canvas: round = ellipse; patron = dashed rectangle; vendor = solid rectangle.
- **Round table options (5′ / 6′ / 8′):** `lib/booth-planner/table-shape.ts` — guest round diameters, footprint math, `tableShape` + `tablePurpose` on booths. Verification: `npx tsx scripts/verify-round-table-options.ts`.
- **Round / patron draw tools:** Toolbar has **Round** and **Patron** (alongside **Vendor**) — each atomically sets placement spec and draw mode. Table size pill **Patron** column (5′/6′/8′ banquet) also auto-switches to draw. Patron skips vendor category seeding and proximity rules so multiple placements can sit near each other.
- **Table size pill reset fix:** baseline sync `useEffect` depended on whole `store` (identity changes every doc mutation) — reverted pill selection after `patchDoc` on size change. Now `[safeTableSizeFt, store.patchDoc]` in `floor-plan-v2.tsx` + QA mirrors.
- **Table size → draw footprint:** QA canvas used `safeTableSizeFt` (wizard prop) instead of `defaultPlacementSizeFt` (local pill state) for `defaultBoothTableLengthFt` and auto-arrange — new draws ignored pill until Step 2 baseline changed.
- **QA placement room resolve:** `use-canvas-pointer-wizard_qa` uses `resolvePlacementRoomIdForObject` + `isValidObjectPlacement` when rooms exist; keeps open-canvas path for blank start.
- **Draw commit stale-draft fix:** `use-canvas-pointer` (+ QA mirror) keeps draw gesture state in `draftRef` so `pointerup` always commits the draft started on `pointerdown` (same pattern as `toolStateRef` / `panActiveRef`). Fixes preview-on-click / nothing-on-release when React handler closure lagged behind state.
- **QA layout room sync timing:** `floor-plan-v2_wizard_qa` projects wizard rooms onto `doc.rooms` in `useLayoutEffect` (was `useEffect` after paint) and compares frames by id — newly added rooms are placeable on the first click.
- **QA draw preview parity:** `floor-plan-canvas-wizard_qa` uses `resolveDrawCommitRect` for draft preview/overlap HUD (matches production canvas).
- **Prior (deployed dfa228e):** tap-to-place without drag extent; canvas wheel/pan input lock; add-room placement hydration (`verify-room-add-placement.ts`).

## Prior shipped (prod build 91)
- FF-merge `feature/step-2-fix` → `master`: Step 2 scroll (`setup-wizard-body` + `overflow-y-auto` on setup page; Step 3 keeps `overflow: hidden` via `.layout-planner-root`)
- Layout blank-start + command-center nav on `master` (`3147712` / `59ec24f`)
- `chore: ship build 89` + build **90** on Vercel (`e764f5e`)
- **Footer chrome trim:** single footer row (legal links, logo, copyright + build version); duplicate strip removed in `03a56fb` / `aa20311` — **live on prod** (`c661640` / build 91)
- **Blank room interiors:** no interior tints; presets seed zero `venue_elements` (`03a56fb`)
- **Deploy tooling:** `init-shell-env.ps1` (PATH for Explorer launches); `git-sync.ps1` (`Invoke-NativeCommand` / `Invoke-Git`, stale lock recovery); `Deploy-popuphub.bat` (pwsh when available, any cwd, default commit message for current WIP, `--no-pause`); handoff baseline records deploy commit message
- **Deploy fix (local, uncommitted):** Windows PowerShell `$ErrorActionPreference = 'Stop'` + `2>&1 | ForEach-Object` treated Vercel/git stderr as fatal — fixed via `Invoke-NativeCommand`

## Active work — Layout blank start + navigation

### Root causes addressed
1. **`roomsFromBoothLayout(null)`** → `roomsFromBoothLayoutForEditor`
2. **`layoutHasPlacedGeometry`** → `layoutHasDrawableGeometry` (cells only)
3. **localStorage multi-room draft** — cleared when no drawable geometry / empty `layoutRooms`
4. **Delete last room** — allowed in wizard + standalone layout
5. **Fullscreen CSS** — stripped on route change + command-center mount
6. **Command center** — exit/new-market as `Link` + `buttonVariants`
7. **Command center viewport** — route cleanup hook preserved dashboard body flag; `:has()` CSS + flex canvas column

## Smoke-test status (2026-06-04)
| Check | Result |
|-------|--------|
| Prod build / alias | **OK** — build **106** / `cde554e` at https://popuphub.ca |
| Command center layout (footer / viewport) | **Re-verify** on prod after sign-in |
| Add room → draw booth inside room | **Deployed** — run `verify-room-add-placement.ts` + sign-in smoke |
| Booth draw click-to-place | **Deployed** — sign-in smoke |
| Booth select / move / rearrange | **Deployed** — sign-in smoke |
| Booth/table select → measurements + resize handles | **Deployed** — sign-in smoke |
| Table size pill drives new draws | **Deployed** — sign-in smoke |
| Round table 5′ / 6′ / 8′ pill + canvas | **Deployed** — sign-in smoke |
| Patron 5′ / 6′ / 8′ pill + canvas | **Deployed** — sign-in smoke |
| Booth placement inside room | **Deployed** — sign-in smoke |
| Vendor auto-arrange (Grid / Staggered / Perimeter) | **Local** — isolated pass + patron obstacles; re-test after deploy |
| Patron auto-arrange (separate pass) | **Local** — active bounding box + non-destructive abort; isolated pass + vendor obstacles + mode selector |
| Toolbar Vendor / Patron / Room blocks | **Local** — sign-in smoke after deploy |
| Rotate room toolbar | **Deployed** — sign-in smoke |
| Room drag + resize handles (Select or Hand) | **Local** — auto-Select after Add room; sign-in smoke |
| Step 3 blank canvas (interactive) | **Deployed** — sign-in smoke |
| Wheel zoom / scroll pan over canvas | **Deployed** — sign-in smoke |
| Stage draw outside room (join) | **Deployed** — verify-asset-type-joins + sign-in |
| Step 2 Capacity scroll | **Local** — setup-wizard-body scroll + mobile workspace center scroll; manual check on phone |
| Mobile workspace page scroll | **Local** — side rails hidden below lg; center column scrolls |
| Mobile wizard text fields | **Local** — Step 1 description overlap fixed (static label + scrollable textarea); re-test on phone |
| Blank start — only add-room + size fields | **Deployed** — sign-in smoke |
| Deploy / handoff script | **Fixed** — `update-session-handoff.ps1` ASCII punctuation (Windows PS parse error) |

**Manual checklist after sign-in:** `/coordinator/dashboard` — site footer hidden, canvas fills viewport below nav, toolbar buttons respond, curation queue select works; **Back to market** / **+ New market** / **Full canvas** toggle.

## Do not touch
- `booth-planner.tsx` unless asked
- Vendor / shopper / auction flows unless asked

## Blockers
- **iOS build/sign:** Mac + Xcode required to archive and upload TestFlight build (shell scaffolded on Windows; `npm run mobile:sync` OK cross-platform).
- **Supabase redirect:** `ca.popuphub.app://auth/callback` not yet registered in Supabase Auth dashboard.
- **Universal links:** `apple-app-site-association` not on `popuphub.ca` yet.
- Interactive coordinator smoke-test requires user credentials
- Markets with **only** `venue_elements` and no cells open **blank** by design
- ~~Deploy blocked by TS build failure~~ — fixed locally (pointer return type + verify script)
- ~~Apple Developer account~~ — enrolled 2026-06-08

## Decisions
- **Mobile strategy:** Ship **iOS App Store app first**, **Android Play Store second**; reuse existing Next.js product rather than rewrite unless native APIs force it
- **Apple Developer Program:** Enrolled — use for App Store + TestFlight (not PWA-only distribution)
- **Native shell v1:** **Capacitor 7** remote URL → `https://popuphub.ca`; bundle id **`ca.popuphub.app`**; bundled static export deferred
- **Drawable geometry = booth `cells` only**
- **Zero rooms by default** until user adds a room or saved booth cells exist
- **Room interiors are blank** — perimeter walls + labels only
- **Vendor vs patron auto-arrange are independent** — each pass moves only its placement type; neither pass may reposition the other category
- **Shared mode vocabulary** — both vendor and patron auto-arrange expose **Grid**, **Staggered**, and **Perimeter** (same semantics as `AutoArrangeMode` / `deterministic-market-layout.ts`)
- **Handoff:** always update `PM/session-handoff.md` when finishing a task; run `update-session-handoff.ps1` or deploy/ship scripts to refresh baseline automatically

## Next actions
1. **Dashboard toolbar-in-sidebar smoke-test** — `/coordinator/dashboard`: layout tools (Room / Patron / Vendor / Canvas) appear in left panel above curation queue; canvas fills full column height; **Full canvas** still shows toolbar strip; mobile shows toolbar above canvas
2. **Room merge smoke-test** — Add two touching rooms, Shift+select both (or park flush), **Merge (2)** → single hall in sidebar, booths stay put, grid shows through stage outline
3. **Room move/resize smoke-test** — Add room → confirm Select tool active, eight dots on perimeter, drag room interior/wall to move, drag corner/edge dot to resize; toolbar W×L readout updates
4. **Passport smoke-test** — `/profile/passport`: image stories without backdrop show brand logo on dark wrapper; video stories show logo poster while loading and in list/carousel thumbnails; click card opens Full Details modal; delete still works without opening modal
5. **Commit + deploy** room merge + stage fill + prior local fixes when ready
6. **Profile smoke-test** — `/profile`: legal name + private phone save to `profiles` only; notification toggles persist; Change Password modal; no org/website fields on profile
7. **Passport smoke-test (public)** — bio + Instagram/Facebook/Website on public `/coordinators/[id]` and `/patrons/[id]`; stories strip still opens story viewer
8. **Coordinator smoke-test** after deploy: manually place patron cluster near vendors → Patron Auto-Arrange should stay inside cluster box or show density toast without wiping tables; vendor auto-arrange should leave patrons fixed
9. **Verify Clear all** on dashboard + wizard Step 3 after sign-in
10. **Food truck draw** after deploy: parking-lot placement outside Main Hall; vendor auto-arrange should treat truck as obstacle
11. **Mobile smoke-test** — coordinator event detail, payment methods, events/new wizard on phone
12. If placement rejected, watch for toast (“Draw inside the room interior”) — click closer to room center after **Add room**
13. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. scaffold Capacitor iOS shell + TestFlight | coordinator smoke-test Step 3 on Spring market]
```
