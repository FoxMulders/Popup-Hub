# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

**Deploy gate:** `PM\Deploy-popuphub.bat` only ships when at least one section uses `## Shipped this session (title, not deployed)` (comma before `not deployed`). After deploy, sections flip to `deployed yyyy-MM-dd`. If everything is already deployed and the tree is clean, the script prints guidance and exits without error. Use `-SkipCommit` to redeploy production without a new commit.

## Active work — middle-mouse grid pan (local, not deployed)
- **`use-viewport.ts` / `use-canvas-pan-zoom.ts`:** Middle-button pan starts in pointer capture phase (before SVG/grid handlers), calls `preventDefault` + `stopPropagation`, and blocks browser autoscroll on `mousedown`/`auxclick`.
- **`floor-plan-canvas.tsx`:** SVG pointer handler skips non-primary mouse buttons so dashboard grid pan is not swallowed.
- **`virtualized-layout-canvas.tsx` / `svg-layout-canvas.tsx`:** Wired `useCanvasPanZoom` on large 8′ grids; grab/grabbing cursor + hint copy.
- **Verify:** `/coordinator/dashboard` and booth planner — middle-drag pans the grid; cursor shows grab/grabbing; no autoscroll icon.

## Active work — dashboard canvas edge-to-edge grid (local, not deployed)
- **`floor-plan-canvas.tsx`:** Command-center viewport uses `padFt = 0`, zero fit padding, transparent SVG (no white card shadow), stone-50 scroll host — grid fills the canvas with no letterboxing.
- **`canvas-grid.tsx`:** Pattern tiles include stone-50 cell fill so aisle gaps show grid lines instead of bare SVG background.
- **`use-layout-viewport.ts`:** `COMMAND_CENTER_FIT_PADDING = 0`.
- **`floor-plan-v2.tsx`:** Dashboard canvas host background `bg-stone-50` to match grid.
- **Verify:** `/coordinator/dashboard` — active room grid fills the canvas column edge-to-edge; no gray margin or floating white card around the grid.

## Active work — wizard step scroll-to-top (local, not deployed)
- **`lib/wizard/wizard-scroll-anchor.ts`:** Reset `.setup-wizard-body`, `#site-main`, and window on step change (setup pages scroll inside the body shell, not the window). Removed step-3 `scrollIntoView` to floor plan — always land at page top.
- **`market-setup-wizard.tsx`:** `useEffect` on `currentStep` calls `resetWizardScrollAnchor` so reactive step changes (skip layout, missing event id) also scroll to top.
- **Verify:** `/coordinator/events/new` — scroll down on Step 1, click Proceed → Step 2 opens at top; repeat Step 2 → Step 3; Back also resets scroll.

## Active work — wizard venue template sync on venue pick (local, not deployed)
- **`lib/booth-planner/edmonton-venue-registry.ts`:** `matchEdmontonVenuePreset()` — match Places/saved picks to Edmonton hall templates by coordinates (~200 m), street address, or venue name.
- **`components/coordinator/market-setup-wizard.tsx`:** `syncVenueTemplateFromSelection()` updates the Venue Template dropdown + room preset when a venue is picked from autocomplete, saved-venue chips, or geocode — without overwriting the selected address/pin. Template dropdown still loads full location when chosen directly.
- **`scripts/verify-edmonton-venue-match.ts`:** PASS (name, address, coords, unknown venue).
- **Verify:** `/coordinator/events/new` — search and click “Kilkenny Community League” in venue name → Venue Template switches to Kilkenny; pick a non-registry venue → template resets to Blank; pick a saved venue chip → template follows stored/matched hall.

## Active work — booth 3′ safety buffer + pathfinding aisle routing (local, not deployed)
- **`lib/booth-planner/layout-clearance-constants.ts`:** `BOOTH_SAFETY_BUFFER_FT = 3.0` per side; `BOOTH_PAIR_MIN_EDGE_GAP_FT = 6.0` between physical borders; grid pitch `BOOTH_CORE_SEPARATION_CELLS = 6`.
- **`lib/booth-planner/expanded-footprint.ts`:** Removed back-to-back clearance bypass; `validateBoothPlacementCoordinate` rejects any expanded-footprint intersection (3′ buffer each booth).
- **`lib/floor-plan/deterministic-market-layout.ts`:** `BACK_TO_BACK_ROW_GAP_FT = 6′`; grid/stagger/perimeter slot loops use hard safety-barrier validator before accepting coordinates.
- **`auto-arrange.ts`:** All vendor slot acceptance via `validateBoothAgainstPlaced`; `validateClearances` checks expanded footprints for vendor pairs; grid passes `tableEdgeGapFt: 6′`.
- **`engine/PathfindingService.ts`:** Navigation grid marks each booth footprint + 3′ buffer as impassable (`MIN_CLEARANCE_FT`); paths route through green aisle bands only.
- **Root cause:** Grid layout used `BACK_TO_BACK_ROW_GAP_FT = 0` and 1.5′ collision probes — booths packed flush back-to-back and A* cut through vendor squares.
- **Verify:** `verify-vendor-booth-clearance.ts` — PASS. `verify-auto-arrange.ts` — 31/31. `verify-layout-pathfind.ts` — PASS (path stays in aisles). Smoke: auto-arrange grid room → no red clearance warnings on back-to-back pairs; patron path overlay avoids booth interiors.

## Active work — patron pathfinding booth obstacle grid (local, not deployed)
- **`engine/PathfindingService.ts`:** `buildNavigationGrid` now explicitly blocks every active layout booth (via `collectLayoutObstacles` + optional `booths` override); uses `objectFootprintAabb` for compound table clusters; two-pass carve (strict footprint, then `BOOTH_SAFETY_BUFFER_FT` aisle clearance) plus corner pinch guard; A* reads final `walkable[][]` so blocked cells drop graph edges implicitly.
- **Root cause:** Grid obstacle pass used raw `rotatedAabb` and only `objectsInRoom` impassables — paths could clip through booth/table footprints not fully represented on the walkability grid.
- **Verify:** `npx tsc --noEmit` — PASS. `npx tsx scripts/verify-layout-pathfind.ts` — PASS. Smoke: `/coordinator/dashboard` — enable patron path overlay on a packed room; dashed path stays in green aisle bands and does not cut through booth rects.

## Active work — booth clearance coordinator warnings + toggle (local, not deployed)
- **`lib/coordinator/booth-clearance-summary.ts` (new):** Per-doc clearance issue rollup + explanatory copy (yellow 3′–4′, red <3′ / ≤2′ critical).
- **`lib/coordinator/booth-clearance-warnings-pref.ts` (new):** `localStorage` preference for clearance warning overlay (default on).
- **`components/coordinator/booth-clearance-warning-panel.tsx` (new):** Legend-rail alert listing affected booths and how to disable warnings.
- **`canvas-legend.tsx`:** Embeds warning panel when issues exist; legend copy clarifies ≤2′ critical red band.
- **`floor-plan-v2.tsx`:** Toggle state, one-time toast when issues appear, passes `showClearanceWarnings` to canvas + toolbar.
- **`canvas-command-bar-blocks.tsx` / `canvas-command-bar.tsx`:** Header triangle toggle (amber when on) beside patron flow.
- **`canvas-objects.tsx` / `floor-plan-canvas.tsx`:** Yellow/red vendor booth tints gated by toggle.
- **`dashboard-next-step-cta.tsx`:** Clearer blocked-step copy referencing color bands.
- **Verify:** `npx tsc --noEmit` — pre-existing duplicate import in `auto-arrange.ts` only. Smoke: `/coordinator/dashboard` — place booths <4′ apart → yellow/red tints + legend alert; click triangle in header → tints and alert hide (preference persists).

## Active work — perimeter + grid hard clearance validator (local, not deployed)
- **`lib/booth-planner/expanded-footprint.ts`:** Central `validateBoothPlacementCoordinate` / `validateBoothAgainstPlaced` — 3′ wall inset, expanded footprint (width+6, length+6), back-to-back grid exception.
- **`lib/booth-planner/layout-clearance-constants.ts`:** `MIN_CLEARANCE_FT = 3.0` (canonical).
- **`auto-arrange.ts`:** All vendor slot acceptance uses expanded-footprint validator; grid `tableEdgeGapFt` = 6′; staging scan uses `perimeterStepFt`; `validateClearances` aligns vendor walls to 3′.
- **`deterministic-market-layout.ts`:** Grid/perimeter slot loops use validator + 6′ column pitch for vendors (`VENDOR_TABLE_EDGE_GAP_FT`); patron tables keep 2′ default gap.
- **`ai-auto-arrange.ts`:** AI prompt + `applyAiPlacementsToBooths` reject coordinates that fail the hard constraint.
- **Verify:** `verify-deterministic-market-layout.ts` 10/10; `verify-auto-arrange.ts` 31/31.

## Shipped this session (sitemap build fix, deployed 2026-06-11)
- **`lib/supabase/public.ts`:** Added `hasPublicSupabaseConfig()` helper.
- **`lib/seo/collect-sitemap-entries.ts`:** Return static sitemap entries when `NEXT_PUBLIC_SUPABASE_*` is missing at build time — fixes Vercel preview `npm run build` failure on `/sitemap.xml`.
- **Root cause:** Preview deployments lack Supabase env during static prerender; `createPublicSupabaseClient()` threw and aborted the build.
- **Verify:** `npm run build` without `.env.local` — PASS (sitemap.xml prerenders with static URLs only).

## Active work — dashboard header uniform button sizing (local, not deployed)
- **`globals.css`:** Header row controls (tabs, pill toggle, toolbar buttons) normalized to `--dashboard-toolbar-height`; `overflow-x: hidden` on command-center header.
- **`dashboard-command-center-header.tsx`:** Tighter header gaps.
- **`command-center-exit-link.tsx`:** Compact+prominent exit link matches toolbar height (`h-7`).
- **`canvas-toolbar-static.tsx`:** Dual-screen cluster inline (no section label stack); tighter portal gaps.
- **`canvas-command-bar-blocks.tsx`:** Header-specific compact view/setup (icon fullscreen, narrow map labels, square zoom); dual-screen icon-only; hall history undo/redo only; room rotate/join hidden in header.
- **`layout-room-bar.tsx`:** `headerBar` mode — inline W/L fields, truncated room tabs, no horizontal scroll.
- **`command-button.tsx`:** Toolbar icon/control heights use `--dashboard-toolbar-height`.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — Blueprint Studio header row fits without horizontal scrollbar; all controls same height.

## Active work — canvas delete INP / deferred pathfinding (local, not deployed)
- **`hooks/use-pathfinding.ts`:** Replaced synchronous `useMemo` + `CalculateOptimalPath` with `useDeferredValue` + `setTimeout(0)` + `startTransition` so booth delete paints before A*/TSP runs.
- **`hooks/use-patron-aisle-overlay.ts` (new):** Same deferral pattern for patron aisle corridor overlay.
- **`floor-plan-v2.tsx`:** `handleDeleteSelected` keeps `store.removeObjects` urgent (outside transition); locked-fixture toast deferred via `startTransition`.
- **Root cause:** Patron path overlay (`usePathfinding`) ran heavy grid pathfinding synchronously during the same render pass as `removeObjects`, blocking INP ~2s when path overlay enabled.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — enable patron path overlay, delete a booth — element disappears immediately; path overlay refreshes shortly after without UI freeze.

## Active work — dashboard header Event setup + Dual-Screen section (local, not deployed)
- **`dashboard-command-center-header.tsx`:** ← Event setup exit link moved to the main header row (left of workspace tabs), using `CommandCenterExitLink` + `useMarketManagement`.
- **`toolbar-static-layout.ts` / `canvas-toolbar-static.tsx`:** New header section **DUAL-SCREEN** with grouped **Presenter** + **Wall Cast** buttons (`HeaderBarDualScreenCluster`); view/setup cluster keeps fullscreen, map labels, patron path, zoom, save.
- **`canvas-command-bar-blocks.tsx` / `toolbar-order.ts`:** New `dual-screen` toolbar block; removed duplicate Event setup + prefixed dual-screen buttons from utilities strip; dropped generic **Launch Dual-Screen Mode** in favor of paired Presenter/Wall Cast controls.
- **`globals.css`:** `.dashboard-header-dual-screen` min-width guard.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — header row shows ← Event setup | Blueprint Studio | Allocation Ledger | view/setup tools | **DUAL-SCREEN** (Presenter + Wall Cast grouped) | hall management; no standalone Launch Dual-Screen button.

## Active work — vendor/patron size chips only highlight when armed (local, not deployed)
- **`table-size-pill.tsx`:** Vendor and patron size buttons no longer show forest/violet active fill from the default placement template alone; chips highlight only when the corresponding draw tool is armed (`vendorPlacementActive`, `roundPlacementActive`, `rectPlacementActive` / `placementActive`).
- **`canvas-command-bar-blocks.tsx`:** Passes `isTablePlacementActive(...)` into `TableSizePill` and `VendorSidebarSizeGrid`.
- **Root cause:** `defaultPlacementSpec` always seeds vendor 6′ for draw math, so the 6′ chip appeared selected even in Select mode.
- **Verify:** `npx tsx scripts/verify-table-size-default.ts` — PASS. Smoke: `/coordinator/dashboard` — on load / Select tool, vendor 6′ (and other sizes) stay neutral white; click vendor draw square → matching size lights forest green; switch to Select → sizes dim again.

## Active work — door wall snap (long edge, no booth rules) (local, not deployed)
- **`structural-wall-snap.ts`:** Doors/exits snap flush to nearest room wall with **long edge along the wall** (`orientLongEdgeAlongWall` + rotation 0° horizontal / 90° vertical); default 3×1 ft footprint; live drag uses `structuralLayoutMovePatch` (not booth grid/clamp).
- **`is-point-in-room.ts`:** Doors skip booth interior-centroid and strict boundary validation; nearest-room resolution via `findRoomIdForStructuralPlacement`.
- **`use-canvas-pointer.ts` / `table-placement-preview.ts`:** Tap/draw/hover preview wall-snaps doors; draw commit propagates snapped width/height/rotation.
- **`scripts/verify-structural-wall-snap.ts`:** Horizontal + vertical long-edge orientation + placement regression.
- **Verify:** `npx tsx scripts/verify-structural-wall-snap.ts` — PASS. Smoke: `/coordinator/dashboard` — draw Door near each wall; long edge runs along wall; move door — stays wall-snapped; no booth clearance bands on doors.

## Active work — Blueprint Studio preview fullscreen (local, not deployed)
- **`command-center-fullscreen-context.tsx`:** Preview mode enters native fullscreen (`command-center-canvas-fullscreen` + browser FS); Esc exits preview; `data-dashboard-preview` on `<html>`.
- **`dashboard-command-center-header.tsx`:** Restored Edit/Preview pill toggle — preview shows only the toggle (fixed top-right overlay).
- **`floor-plan-v2.tsx` / `floor-plan-canvas.tsx`:** `viewOnly` disables draw/select/drop/keyboard edits; pan/zoom still works.
- **`globals.css`:** Preview hides tool strip, footer, verification banner, side rails; canvas fills viewport.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — flip Preview → fullscreen canvas, no tools/rails; flip Edit or Esc → restore editing chrome.

## Active work — main hall grid sizing + food truck wall collision (local, not deployed)
- **`layout-room-bar.tsx`:** Editable Width/Length (ft) fields for the highlighted room (Main Hall) in the hall-management toolbar; commits via `onPatchRoomDimensions`.
- **`floor-plan-v2.tsx` / `use-floor-plan-doc.ts`:** `handlePatchRoomDimensions` resizes the room frame and syncs wizard `venue_width`/`venue_length`; `readDoc()` for immediate post-resize sync.
- **`floor-plan-canvas.tsx`:** Placement grid is drawn at the active/selected room frame (size + origin), so editing Main Hall resizes the visible grid.
- **`canvas-open-placement.ts` / `use-canvas-pointer.ts`:** Food trucks rejected when overlapping solid `wall` objects (draw, tap-place, and drag-drop revert).
- **`scripts/verify-food-truck-placement.ts`:** Wall overlap regression cases.
- **Verify:** `npx tsx scripts/verify-food-truck-placement.ts` — PASS; `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — edit Main Hall W/L in header; grid matches; food truck cannot sit on a wall.

## Active work — table size units sync across size grids (local, not deployed)
- **`table-size-units.tsx`:** `useTableSizeUnits` broadcasts changes via custom event so all toolbars stay in sync; added `formatDimensionDisplay` / `formatFootprintDisplay` helpers.
- **`table-size-pill.tsx` / `table-size-selector.tsx`:** Patron table size chips now respect ft/m toggle (were hardcoded `6′`, etc.).
- **`layout-room-bar.tsx` / `object-resize.ts` / `floor-plan-v2.tsx`:** Room metrics badge and selection dimension chip follow the active unit preference.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — toggle ft/m on vendor sizes; patron table chips, room dimensions, and selection metrics all switch units together.

## Active work — notification bell dot when caught up (local, not deployed)
- **`components/nav/app-nav.tsx`:** Removed amber placeholder dot on the bell when `unreadCount === 0`; badge only when unread notifications exist (matches notifications page “You're all caught up”).

## Active work — canvas legend/ledger matching side rails (local, not deployed)
- **`canvas-side-rail.tsx`:** Shared 200px body + 28px tab side-rail shell for legend and ledger popouts.
- **`canvas-legend.tsx` / `canvas-ledger.tsx`:** Both use flex side rails inside the canvas host (no absolute overlay); canvas grid sits between them and no longer sits under the panels.
- **`floor-plan-v2.tsx`:** Dashboard canvas host is `flex-row` — legend | canvas | ledger.
- **`dashboard-split-workspace.tsx`:** Removed 35% ledger column; ledger moved into canvas right rail.
- **`booth-matrix-panel.tsx`:** New `docked` variant — compact scroll cards for 200px rail.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` (≥ lg) — legend + ledger same width; expand/collapse each rail; floor plan does not render under either panel.

## Active work — booth clearance preview + 3′ yellow band (local, not deployed)
- **`lib/coordinator/booth-clearance-visual.ts`:** `clearanceBand` uses `BOOTH_CLEARANCE_TIGHT_FT` (3′) — red below 3′, yellow at ≥3′ and <4′, green at ≥4′; added `vendorBoothClearanceThemeForProbe` for draw/hover preview.
- **`floor-plan-canvas.tsx` / `canvas-overlays.tsx`:** Vendor booth draw drag, tap-to-place ghost, and cursor hover preview show clearance band colours before commit; overlap still wins (red violation); guest/patron previews stay sky-blue.
- **`UnifiedLayoutSolver.ts`:** Reuses shared `clearanceBand`.
- **`canvas-legend.tsx`:** Critical legend updated to `<3′`; tight remains `≥3′ and <4′`.
- **`scripts/verify-booth-clearance-visual.ts`:** Band thresholds + 3′ preview-probe regression.
- **Verify:** `npx tsx scripts/verify-booth-clearance-visual.ts` — PASS. Smoke: `/coordinator/dashboard` — draw vendor booth near neighbor — preview turns red below 3′, yellow at 3′–4′, green at ≥4′ before click; overlap still red.

## Active work — booth clearance diagonal distance fix (local, not deployed)
- **`lib/coordinator/booth-clearance-visual.ts`:** `edgeClearanceBetweenRects` computes true diagonal corner gaps.
- **`canvas-objects.tsx`:** Patron/guest tables use `isGuestTableBooth` (purple dashed, no vendor clearance bands).
- **`scripts/verify-booth-clearance-visual.ts`:** Regression tests for diagonal separation and scatter layout.

## Active work — dashboard header trim (local, not deployed)
- **`dashboard-command-center-header.tsx`:** Edit/Preview toggle restored at header right (Blueprint Studio only); workspace tabs + portaled room/canvas toolbar use `overflow-hidden` (no horizontal scrollbar). +New market removed from header row.
- **`canvas-command-bar.tsx` / `canvas-toolbar-static.tsx` / `globals.css`:** Header bar layout no longer scrolls horizontally.

## Shipped this session (dashboard and floor-plan editor polish, deployed 2026-06-11)
- **Header row:** Uniform `--dashboard-toolbar-height` on tabs, Event setup, view/setup, dual-screen, hall management, Edit/Preview; compact icon controls; no horizontal scrollbar (`globals.css`, `dashboard-command-center-header.tsx`, `canvas-command-bar-blocks.tsx`, `layout-room-bar.tsx`, `command-button.tsx`).
- **Header layout:** Event setup in main row; DUAL-SCREEN Presenter/Wall Cast cluster; hall W/L dimension fields; Edit/Preview restored (`command-center-exit-link.tsx`, `canvas-toolbar-static.tsx`, `toolbar-static-layout.ts`).
- **Canvas UX:** Legend + allocation ledger as matching 200px side rails inside canvas host; preview fullscreen mode; deferred pathfinding/patron aisle overlay for faster booth delete INP.
- **Floor-plan tools:** Vendor/patron size chips highlight only when draw tool armed; ft/m sync across size grids; door long-edge wall snap; food truck wall collision; Main Hall editable W/L resizes grid; booth clearance preview bands (3′ yellow / diagonal gap fix).
- **Nav/footer:** Bell badge only when unread; Next step CTA single-line footer layout.
- **Verify:** `npx tsc --noEmit` — PASS; `npx tsx scripts/verify-booth-clearance-visual.ts` + `verify-structural-wall-snap.ts` + `verify-food-truck-placement.ts` — PASS. Smoke: `/coordinator/dashboard` — header fits one row; legend/ledger rails; preview toggle; patron path delete feels instant.

## Shipped this session (Blueprint Studio two-row dashboard layout, deployed 2026-06-11)
- **Row 1 (header):** `dashboard-command-center-header.tsx` — Blueprint Studio | Allocation Ledger tabs, then portaled view/setup cluster (labels, Event setup, dual-screen, fullscreen, zoom) + hall management (Main Hall bar, undo/redo); no market title row.
- **Row 2 (tool strip):** `toolbar-static-layout.ts` + `canvas-toolbar-static.tsx` — four labeled sections: SHAPES & BOOTHS (primitives only), VENDOR BOOTHS, PATRON TABLES (renamed), ALIGNMENT & SPACING; vendor/patron each own section with one horizontal icon row.
- **Portal split:** `canvas-command-bar.tsx` — `headerBarLayout` → `view-setup` + `hall-management`; `topBarLayout` → tool-strip sections only (`DASHBOARD_HEADER_SECTION_IDS` / `DASHBOARD_TOOLSTRIP_SECTION_IDS`).
- **Payout banner:** removed from `market-dashboard-client.tsx` / `app/coordinator/dashboard/page.tsx`; `CoordinatorCommunityTrustBanner` on coordinator `app/profile/page.tsx` via `loadCoordinatorEscrowContext`.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — two rows (nav + tools), four tool sections; `/profile` — Full payout access card for coordinators.

## Shipped this session (dashboard layout toolbar compaction + shared footer, deployed 2026-06-11)
- **SHAPES & BOOTHS single row:** `canvas-toolbar-static.tsx` + `globals.css` — primitives, vendor booths, and patron elements render in one horizontal row to maximize canvas height.
- **ROOM & CANVAS in header:** Room/canvas controls portaled into Blueprint Studio header via `DashboardHeaderToolbarPortalTarget`; top toolbar strip now shows Shapes & Booths + Alignment only (`toolbar-static-layout.ts` section filter, `floor-plan-v2.tsx` dual command-bar portals).
- **Shared footer:** `dashboard-workspace-footer.tsx` — same `DashboardNextStepCta` footer on Blueprint Studio and Allocation Ledger views (`Dashboard_qa.tsx`); removed duplicate ledger-pane footers.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — room tools in header row; shapes/booths one row; footer visible on both workspace tabs.

## Active work — Next step CTA single-line layout (local, not deployed)
- **`dashboard-next-step-cta.tsx`:** Label + detail text on one row (was stacked `flex-col` in footer button); arrow pinned right; `truncate` on overflow.

## Shipped this session (initial loader side booth stagger + right-align scale, deployed 2026-06-11)
- **`components/brand/initial-loader-reveal.tsx`:** Left/right perimeter stalls use half-cell brick stagger (24 px offset on alternating rows); tables sit bottom-aligned in each 48×48 square; scale-in animation anchors on the inner/right edge of each square (not center) so sides read as right-aligned in their cells; inner ring inset updated for stagger extent.
- **Verify:** Hard refresh (clear `popup-hub-initial-loader-shown` in sessionStorage if needed) — side columns show brick stagger; each stall grows from its square’s right edge toward the ring center.

## Shipped this session (dual-screen presenter vs wall-cast differentiation, deployed 2026-06-11)
- **Bug:** Both **Dual-Screen: Presenter** and **Dual-Screen: Wall Cast** opened `/coordinator/dashboard/ledger` with the same interactive table — only the header label differed.
- **Fix:** `dashboard-ledger-window-client.tsx` — **Presenter** keeps compact light UI with clickable booth names that focus the canvas; **Wall Cast** is read-only with dark high-contrast projection layout (large type, status-colored rows, canvas selection highlight + auto-scroll, no click handlers).
- **Window sizing:** `floorplan-sync.ts` — wall-cast popup defaults to 1920×1080; presenter stays 1024×900; distinct window names unchanged.
- **Verify:** `/coordinator/dashboard` — open both dual-screen buttons; presenter = light interactive ledger, wall cast = dark read-only display; selecting a booth on canvas highlights the row on wall cast; clicking a booth in presenter focuses canvas.

## Shipped this session (header nav UI/UX — profile in menu, logo +15%, menu scroll, deployed 2026-06-11)
- **`app-nav.tsx` / `shopper-top-bar.tsx`:** Removed profile avatar from header right rail; profile access via `AppMenuSheet` (avatar + name banner + Profile settings). Shopper top bar hamburger now visible on all breakpoints for signed-in users.
- **`app-menu-sheet.tsx`:** Fixed menu cut-off — `h-dvh` sheet height, safe-area padding on header/nav children (not outer shell), scrollable `overflow-y-auto` nav body.
- **Logo +15%:** `popup-hub-logo.tsx` default nav lockup; `app-nav`, `guest-nav`, `shopper-top-bar` header class overrides; `--app-nav-height` 3.15rem → 3.625rem in `globals.css`.
- **Verify:** Sign in → header shows logo (larger), bell + hamburger only (no header avatar); open menu → profile banner at top, all links scroll on narrow/mobile viewports; guest nav logo scales up without overlap.

## Shipped this session (coordinator event hub side-panel navigation fix, deployed 2026-06-10)
- **`lib/coordinator/coordinator-event-route.ts`:** `isCoordinatorEventHubPath()` — detects primary event overview (`/coordinator/events/[id]`) vs sub-routes.
- **`coordinator-workspace-rail.tsx` / `coordinator-context-panel.tsx`:** On event hub, hide self-referencing “Event overview” buttons; top exit links to command center (`/coordinator/dashboard`). On sub-routes (layout, check-in, review, applications, etc.), “Event overview” uses `router.push` to `/coordinator/events/{eventId}`.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/events/{id}` — no dead “Event overview” in left/right panels; “Command center” exit works. Sub-route `/coordinator/events/{id}/applications` — “Event overview” returns to hub.

## Shipped this session (coordinator pre-flight review & publish page, deployed 2026-06-10)
- **Route:** `/coordinator/events/[id]/review` — Pre-Flight Review & Publish for draft markets after floor plan work.
- **Layout snapshot:** `lib/coordinator/layout-telemetry-summary.ts` — vendor booth totals, category breakdown, patron seating/amenities from saved layout; link back to Blueprint Studio (`/coordinator/dashboard?event=`).
- **Review cards:** Inline save for event logistics, shopper details (parking, wheelchair toggle + notes, pet policy), pricing & category waitlist caps (`CategoryLimitEditor` + unified booth fee).
- **Publish:** `PATCH /api/coordinator/events/[eventId]` with `{ status: 'published' }` — publish gate, venue verify, booth-fee checks; client button disabled while publishing; success toast + redirect to event overview.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: draft market with layout → `/coordinator/events/{id}/review` → edit cards save → Publish → lands on event hub with live toast.

## Shipped this session (platform FAQ copy refresh, deployed 2026-06-10)
- **`lib/legal/faq-content.tsx`:** Added coordinator value-prop FAQ (vs. DMs/spreadsheets); expanded pricing answer (vendor pass-through, coordinator fee toggle, offline-payment trust note); expanded fee rationale with mobile-app funding paragraph.
- **`app/legal/faq/page.tsx`:** Updated last-modified date to June 10, 2026.
- **Verify:** `/legal/faq` — new “Why should I choose Popup Hub…” entry visible; pricing and fee answers show structured multi-paragraph copy.

## Shipped this session (Blueprint Studio toolbar element panel entry animation, deployed 2026-06-10)
- **Motion config:** `toolbar-element-panels-motion.ts` — shared Framer Motion variants with `x: 0` start/end so vendor and patron asset tables animate on a strict vertical center axis (`y` spring only).
- **SHAPES & BOOTHS:** `canvas-toolbar-static.tsx` — VENDOR BOOTHS (top) and PATRON ELEMENTS (bottom) stacked in `flex flex-col items-center justify-center`; `TopBarAssetTablePanel` + staggered container entry; `useReducedMotion` bypass.
- **CSS:** `globals.css` — `data-toolbar-section='shapes-booths'` and `.toolbar-element-panel(s)` centering rules.
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — reload Blueprint Studio toolbar; vendor booth size row and patron element row fade/slide in centered (no horizontal drift); reduced-motion shows panels instantly.

## Shipped this session (dashboard toolbar layout refactor, deployed 2026-06-10)
- **ROOM & CANVAS:** Removed duplicate Full screen from `dashboard-command-center-header.tsx`; primary control lives in top toolbar next to ← Event setup with `Dual-Screen: Presenter` / `Dual-Screen: Wall Cast` (`launchDualScreen('presenter'|'wall-cast')` via `openDualScreenWindow` in `floorplan-sync.ts`).
- **SHAPES & BOOTHS:** `canvas-toolbar-static.tsx` — VENDOR / PATRON sub-labels; vendor sizing (`vendor-sizes`) moved from Alignment into Shapes; patron tools forced horizontal (`PatronSidebarControls` + `flex-row`).
- **ALIGNMENT & SPACING:** Auto-Arrange relabeled **AI Auto-Arrange** with `w-32 px-3 whitespace-nowrap` top-bar button (no text clipping).
- **Verify:** `npx tsc --noEmit` — PASS. Smoke: `/coordinator/dashboard` — Full screen only in ROOM & CANVAS strip; dual-screen buttons open separate presenter/wall-cast ledger windows; vendor/patron tool groups visually separated.
- **Build fix:** Split pure escrow math into `escrow-policy.ts` so client `apply-button.tsx` → `booth-checkout.ts` no longer pulls `lib/supabase/server.ts` through `escrow.ts` audit imports; `npm run build` — PASS.

## Shipped this session (coordinator onboarding relaxation + escrow criteria, deployed 2026-06-10)
- **Optional tax ID:** `coordinator-verification-banner.tsx` + `POST /api/coordinator/verification` — organization name required; business registration / tax ID optional; invalid BN rejected only when provided.
- **Square/Stripe onboarding:** Payment trust path (Square OAuth complete or Stripe) satisfies publish checklist — verification banner hidden when `paymentTrustComplete`; `enable-coordinator` no longer forces `pending`; connect CTA when not linked.
- **DB publish guard:** `104_coordinator_onboarding_relaxation.sql` — `coordinator_can_publish_event` allows org name alone (no BN required) to match TS `hasOfflineOrganizerProfile`.
- **Escrow rules:** `coordinatorEscrowExempt` / `coordinatorRequiresEscrowHold` in `lib/coordinator/escrow.ts` — 75% hold applies when organizer lacks **both** verified business tax ID (`hasVerifiedBusinessTaxId`) **and** 3 vendor vouches; Square-connected organizers still subject to escrow until tax ID or vouches.
- **Checkout/payout:** `resolve-booth-checkout.ts` + `distributeCoordinatorBoothPayout` use escrow exemption; `GET /api/events/[id]/payment-config` returns `coordinatorEscrowExempt`; vendor `apply-button.tsx` checkout preview reflects 75% hold for unverified organizers.
- **UI:** `market-dashboard-client.tsx` — trust banner + verification banner wired with correct props; Square-connected coordinators skip corporate-doc banner.
- **Verify:** `npx tsx scripts/verify-coordinator-verification.ts` + `verify-coordinator-escrow.ts` — PASS; `npx tsc --noEmit` — PASS.
- **Apply migration:** Run `104_coordinator_onboarding_relaxation.sql` on Supabase before prod smoke-test.

## Shipped this session (coordinator escrow + vendor vouch + pass-through fees, deployed 2026-06-10)
- **Schema:** `101_coordinator_escrow_vouch.sql` — `coordinator_is_verified`, `coordinator_successful_events_count`, `wallets.escrow_balance`, `coordinator_vouches`, `coordinator_escrow_holds`; `102_pass_fees_to_vendor.sql` — `events.pass_fees_to_vendor`, `coordinator_escrow_holds.processor_transfer_id`.
- **Checkout math:** `lib/monetization/booth-checkout.ts` — gross-up `(base + flat) / (1 - bps)` for pass-through; combined Square/Stripe `app_fee` = platform fee + 75% escrow hold on base booth for unverified organizers.
- **Escrow:** `lib/coordinator/escrow.ts` — 25% immediate / 75% held; Square release credits coordinator wallet via `lib/square/coordinator-escrow-release.ts`; cron releases 24h post-event when no disputes.
- **Payments:** Square `createBoothPayment` uses dynamic `appFeeCents` + CAD; Stripe booth-payment/webhook parity; `record-transaction` splits escrow on `baseBoothCents`.
- **Pass-through toggle:** `MarketBoothPricingFields` + `event-form.tsx` checkbox; vendor checkout preview in `apply-button.tsx` + `pay-booth-modal.tsx`.
- **Vouch fast-track:** `POST /api/coordinator/vouch` (existing) + `VendorCoordinatorVouchButton` after approved application; `CoordinatorCommunityTrustBanner` on coordinator dashboard.
- **Auto-verify:** 3 vendor vouches or verified business tax ID (or admin approve) → full payouts; 2 successful events increments counter only (per-event cron still releases held funds).
- **Cron:** `/api/cron/coordinator-escrow-release` daily 08:00 UTC in `vercel.json`.
- **Verify:** `npx tsx scripts/verify-coordinator-escrow.ts` — PASS; `npx tsc --noEmit` — PASS.
- **Apply migrations:** Migrations `100`–`103` applied to Supabase (`ensbggtbgabogvynqsqt`) via `npx supabase db push --yes` on 2026-06-10. Renamed duplicate `098_vendor_passport_tiktok.sql` → `103_vendor_passport_tiktok.sql` to resolve version conflict with `098_platform_operator_patron_access.sql`.

## Shipped this session (coordinator fraud hardening, deployed 2026-06-10)
- **Schema:** `100_coordinator_fraud_mitigation.sql` — `profiles` gains `coordinator_verification_status`, `coordinator_organization_name`, `coordinator_business_number`, `coordinator_risk_score`, `coordinator_account_status`; conservative backfill for Stripe/Square/venue-verified coordinators; DB trigger blocks event → published/active when organizer fails publish trust path.
- **Lib:** `lib/coordinator/verification.ts` — BN/EIN validation reuse, risk scoring, publish/payment/apply block reasons; trust paths: admin-verified OR Stripe OR Square OR offline org+BN (publish only for pending offline).
- **API gates:** `enable-coordinator` sets pending + message; `coordinator/events/draft` publish; `payment-settings` PATCH; `booth-payment` + `stripe/booth-payment`; `vendor/apply` blocks suspended/banned organizer; new `POST/GET /api/coordinator/verification`; new `POST /api/admin/coordinator-verification`.
- **UI:** `coordinator-verification-banner.tsx` on coordinator dashboard; client publish pre-checks in status toggle, setup wizard, spatial layout deploy.
- **Verify:** `npx tsx scripts/verify-coordinator-verification.ts` — PASS; `npx tsc --noEmit` — PASS.
- **Smoke test:** New shopper → enable organizer → dashboard banner → submit org+BN → publish blocked until submission; Stripe/Square coordinators publish without manual form; offline pending can publish but payment-settings / booth-payment blocked until verified; admin `POST /api/admin/coordinator-verification` with `{ coordinatorId, action: "approve" }` unlocks offline collection.

## Shipped this session (legend left-collapsible overlay, deployed 2026-06-10)
- **Legend panel:** `canvas-legend.tsx` — docked/sidebar variants slide horizontally off the left canvas edge; collapsed state leaves a flush chevron tab (`>` expand / `<` collapse); semi-opaque white panel with right border + shadow overlays the grid without affecting drag coordinates.
- **Canvas width:** Removed fixed `168px` legend rail from `floor-plan-v2.tsx`; legend lives inside the canvas host as an overlay so the grid uses full width when collapsed.
- **CSS:** `globals.css` — replaced `.dashboard-canvas-legend-rail` with `.canvas-legend-panel` (hidden below `lg`, visible on dashboard canvas host).
- **Verify:** `/coordinator/dashboard` (≥ lg) — expand legend overlays grid; collapse slides panel left leaving chevron tab; canvas grid fills full host width; pan/drag unchanged under overlay margins.

## Shipped this session (manual drag — no wall magnet snap, deployed 2026-06-10)
- **Drag fix:** `booth-layout-engine.ts` — removed perimeter magnet snap from `boothLayoutMovePatch` / `boothLayoutCommitPatch`; manual drag uses 1′ grid (5′ with Shift) only; booths can sit at 2′, 3′, or 4′ from walls without snapping flush.
- **Pointer cleanup:** `use-canvas-pointer.ts` — dropped locked-wall-edge hysteresis during drag; commit re-quantizes grid without wall override.
- **Clearance colors:** unchanged live path in `canvas-objects.tsx` + `booth-clearance-visual.ts` (red ≤2′, yellow >2′ and <4′, green ≥4′).
- **Verify:** `npx tsx scripts/verify-booth-manual-drag-grid.ts`, `verify-vendor-wall-snap.ts`, `verify-booth-clearance-visual.ts` — PASS.
- **Smoke test:** `/coordinator/dashboard` — drag vendor booth toward wall at 1′ steps; hold Shift for 5′ steps; stop at 2′/3′/4′ clearance — booth stays put (no flush snap); colors update live (red/yellow/green).

## Shipped this session (manual placement free + row wall orientation, deployed 2026-06-10)
- **Manual placement:** Removed same-category proximity and collision-buffer rejection from drag commit, draw commit, keyboard nudge, and booth resize — coordinators can place booths freely; auto-arrange engines still enforce distance rules.
- **Row orientation snap:** `booth-layout-engine.ts` — when a vendor booth shares a row (center Y within 1′), manual drag/draw/preview inherit the row peer's wall-facing rotation; `table-placement-preview.ts` ghost matches.
- **Verify:** `npx tsx scripts/verify-booth-row-orientation.ts` — PASS.

## Shipped this session (canvas layout engine — grid snap, wall clearance, booth colors, deployed 2026-06-10)
- **Layout engine:** `engine/booth-layout-engine.ts` — shared drag/nudge loop: 1′ default snap, 5′ with Shift (`resolveBoothMoveSnapFt`); wired in `use-canvas-pointer.ts` (Shift key listener + drag frames) and `selection-keyboard-nudge.ts`.
- **Wall placement:** Perimeter snap uses strict `< 4′` threshold (`perimeter-booth-orientation.ts`, `vendor-booth-placement.ts`) so booths can sit exactly 4′ from walls without snap jitter; `verify-vendor-wall-snap.ts` adds 4′ regression.
- **Clearance colors:** `booth-clearance-visual.ts` — red ≤2′, yellow &gt;2′ and &lt;4′, green ≥4′; structural walls count as obstacles; isolated booths default green (fixes gray/wrong fills); legend copy updated.
- **Map labels:** Unchanged toggle path — `resolveBoothMapLabelText` + clearance fills compose independently in `canvas-objects.tsx`.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts`, `verify-vendor-booth-clearance.ts`, `verify-booth-clearance-visual.ts` — PASS.
- **Smoke test:** `/coordinator/dashboard` — drag booth with 1′ steps; hold Shift for 5′; place booth exactly 4′ from wall (no snap fight); pair booths at 2′ both turn red; toggle Map labels (vendor / category / booth ID).

## Shipped this session (two-pane map–ledger sync + Map Labels, deployed 2026-06-10)
- **Unified booth state:** `use-booth-entities.ts` — single reactive array (id, dimensions, x/y, clearance band, vendor, category, payment status) feeding Booth Matrix and canvas label meta (`dashboard-floor-plan.tsx`).
- **Bidirectional ledger:** `booth-matrix-panel.tsx` — vendor `<select>` + status `<select>` call `assignVendorToBoothByVendorId` / `updateBoothPaymentStatus` (`market-management-context.tsx`); canvas labels + clearance fills re-render instantly; `floorplan-sync.ts` + `floorplan-sync-bridge.tsx` relay `matrix_assign_vendor` / `matrix_set_status` from dual-screen ledger window.
- **Map Labels:** `lib/coordinator/booth-map-label.ts` + toolbar **Map labels** select (`canvas-command-bar-blocks.tsx`); `canvas-objects.tsx` wraps vendor booth text via `wrapTextInContainer` (vendor / category / booth ID modes); mode persisted in `localStorage`.
- **Chrome:** `app-nav.tsx` logo → `/`; matrix control height tokens in `globals.css`.
- **Verify:** `/coordinator/dashboard` — change vendor/status in split-pane matrix → canvas label + clearance color update; toggle Map labels; dual-screen ledger stays synced; Full screen + Launch Dual-Screen Mode unchanged.

## Shipped this session (traffic-aware auto-arrange engine + spring animation, deployed 2026-06-10)
- **Layout engine:** Replaced generic Turf shelf-scan in `AutoArrangeEngine.ts` with traffic-aware path optimization — maps entrance/exit flow terminals (`traffic-flow-prerequisites.ts`), builds serpentine patron pathway (`buildPatronPathway`), treats corridor as no-fly zone (`buildTrafficNoFlyRects`), packs booths along path margins via `calculatePatronCentricLayout`, shifts occluded booths for path frontage, enforces 3′ clearance (`VENDOR_BOOTH_AISLE_FT`), Turf-validates merged zones.
- **Spring animation:** `hooks/use-layout-spring.ts` — damped spring rAF; `canvas-objects.tsx` + `floor-plan-canvas.tsx` accept `layoutSpringPoses`; `floor-plan-v2.tsx` `commitVendorPackWithSpring` animates booths from pre-arrange positions on Auto-Arrange / Auto-Layout.
- **Verify:** `npx tsx scripts/verify-auto-arrange-engine.ts` and `npx tsx scripts/verify-layout-pathfind.ts` — both PASS.
- **Smoke test:** `/coordinator/dashboard` — place entry + exit doors on perimeter; run Auto-Arrange; booths spring from overlap line into serpentine traffic layout with 3′ clearance bands.

## Shipped this session (coordinator dashboard premium refactor — clearance + workflow, deployed 2026-06-10)
- **Clearance physics:** `lib/coordinator/booth-clearance-visual.ts` — 3′ baseline; red ≤1′ / orange &lt;3′ / green ≥3′ booth fills during drag; `layout-clearance-constants.ts` safety buffer 3′; snap grid drift fix in `geometry.ts`.
- **Autosave:** `dashboard-layout-save-context.tsx` — Saving… only after debounced commit; green Saved after 1s hold; `floor-plan-v2.tsx` schedules on `onLayoutCommit` (drag end) not continuous doc fingerprint.
- **Workflow CTA:** `dashboard-next-step-cta.tsx` — static footer; Blueprint → Ledger when clearance valid; Ledger → overview when allocations complete; clearance tooltip blocks advance.
- **Toolbar / chrome:** Compressed dashboard gutters; ALIGNMENT & SPACING section unhidden in top bar; vendor matches panel removed; legend docked rail + clearance key; nav contrast fixes; logo → `/coordinator/dashboard`.
- **Verify:** `/coordinator/dashboard` — drag booth shows clearance colors; Saving… after drag release; Next step disabled when orange/red clearance; valid layout opens Allocation Ledger tab.

## Shipped this session (virtual split-pane + native dual-screen workspace, deployed 2026-06-10)
- **Virtual split-pane:** `dashboard-split-workspace.tsx` — Blueprint Studio ~65% + Allocation Ledger ~35%; collapse toggle on ledger header (`dashboard-workspace-view-context.tsx` persisted state); wired in `Dashboard_qa.tsx`.
- **Dual-screen engine:** `lib/coordinator/floorplan-sync.ts` + `floorplan-sync-bridge.tsx` — `BroadcastChannel('floorplan_sync')`; toolbar **Launch Dual-Screen Mode** (`canvas-command-bar-blocks.tsx`, `floor-plan-v2.tsx`); secondary window `/coordinator/dashboard/ledger` (`dashboard-ledger-window-client.tsx`).
- **Density + layout:** `--dashboard-gutter` tightened; split-pane CSS in `globals.css`; **Full screen** labeled button (browser fullscreen via `command-center-fullscreen-context.tsx`); reactive autosave chip (yellow Saving… → green Saved to cloud).
- **Booth matrix:** Coordinates column removed; even 25% columns; semantic status badges; `aria-live` on table region; **Next step** CTA anchored in static footer (`dashboard-allocation-ledger.tsx`, split footer); VENDOR MATCHES removed from toolbar.
- **Canvas physics:** Vendor booth drag uses `snapToGrid` during move + commit (`use-canvas-pointer.ts`); status labels wrap via `wrapTextInContainer` (`canvas-label-text.ts`, `canvas-objects.tsx`).
- **Verify:** `/coordinator/dashboard` — split pane + collapse expand; **Launch Dual-Screen Mode** opens ledger window with live matrix sync; booth click in ledger focuses canvas; Full screen fills monitor; logo → `/`; ALIGNMENT & SPACING + Auto-Arrange visible in top bar.
- **Deploy fix (2026-06-10):** Production build `5b45e5d` failed — `dashboard-split-workspace.tsx` referenced `ledgerPaneCollapsed` before `dashboard-workspace-view-context.tsx` exported it (TS error on Vercel). Working tree now complete; `get-deploy-commit-message.ps1` sanitizes bat REM preview (ASCII-only) to avoid Windows `'et' is not recognized` after failed deploy.

## Shipped this session (coordinator dashboard density + UX polish, deployed 2026-06-10)
- **Global chrome:** `app-nav.tsx` — Popup Hub logo links to `/`; nav pills use high-contrast `text-stone-900`; unified `--dashboard-gutter` aligns header, toolbar, and booth matrix left edges.
- **Autosave chip:** `dashboard-layout-save-context.tsx` — debounced `scheduleAutosave` with yellow saving → green saved → idle fade; `floor-plan-v2.tsx` uses doc fingerprint (fixes stuck “Saving…”).
- **Edit/Preview:** `dashboard-command-center-header.tsx` — full-width pill toggle with custom track/thumb (single click target).
- **Canvas:** Legend moved to persistent left rail (`canvas-legend.tsx` `variant="docked"`); dashboard viewport fill restored over QA scroll class; zoom min 25% with viewport-center anchor; booth name/status text no longer overlap (`canvas-objects.tsx`).
- **Vendor matches:** `vendor-matches-panel.tsx` — illustration empty state, inline invite CTA, fixed plural strings (`1 booth` not `booth s`).
- **Booth matrix:** `booth-matrix-panel.tsx` — collapsible accordion header, denser rows, wider coordinates column, semantic badges; single accessible table (no duplicate SR table).
- **Verify:** `/coordinator/dashboard` — logo → `/`; edit canvas → Saving… then Saved to cloud; zoom 50/75/100% from viewport center; legend rail; collapse booth matrix; vendor matches empty state + invite button inline.

## Shipped this session (semver build versioning, deployed 2026-06-10)
- **`lib/build-info.ts`:** `formatAppVersion` now returns `major.minor.patch` from `package.json`; build counter stays separate in footer (`v1.0.0 · build 68`). Added `parseSemver` / `semverComponentsChanged`.
- **`scripts/bump-build-number.mjs`:** Resets build to `1` when major, minor, or patch changes; stores semver components in `build-number.json`.
- **`package.json`:** Added `version:patch`, `version:minor`, `version:major` scripts (`npm version * --no-git-tag-version`).
- **Verify:** Footer shows `v1.0.0 · build N` (not `v1.0.N`); bump patch via `npm run version:patch` resets build to 1 on next build.

## Shipped this session (coordinator dashboard premium UI refactor, deployed 2026-06-10)
- **Design tokens:** `globals.css` — `--dashboard-radius`, `--dashboard-toolbar-height`, `--dashboard-panel-gap`; utility classes `.dashboard-panel`, `.dashboard-toolbar-section`, `.dashboard-pill-toggle`, `.dashboard-save-chip`.
- **Nav + header:** `app-nav.tsx` pill active tabs; `dashboard-command-center-header.tsx` — autosave chip via `DashboardLayoutSaveProvider`, full-pill Edit/Preview, deduped bell/actions; `market-dashboard-client.tsx` wires save context.
- **Toolbars:** `toolbar-static-layout.ts` merges optimize into alignment-spacing; `vendor-sizes` renders in top bar; discrete zoom (`discrete-zoom.ts`, `use-viewport.ts`); `table-size-pill.tsx` segmented strip + imperial/metric toggle; `layout-room-bar.tsx` edit/delete divider.
- **Canvas:** Full-bleed command-center viewport (hidden scrollbars, grab cursor); legend docked left (`canvas-legend.tsx` `variant="sidebar"`); status-driven booth colors + wrapped status labels; booth keyboard focus (`use-canvas-object-keyboard.ts`).
- **Vendor matches:** `vendor-matches-panel.tsx` — empty state, pluralization fix, inline Send Priority Invites CTA.
- **Booth matrix:** `booth-matrix-panel.tsx` — semantic badge pills, fixed columns, `aria-live`; removed duplicate `booth-matrix-a11y-table.tsx`; CTA inline in matrix header (`dashboard-next-step-cta.tsx` `inline`).
- **Wizard parity:** `booth-planner.tsx`, `table-size-selector.tsx`, `canvas-utility-toolbar.tsx` share dashboard token styling.
- **QA mirrors:** `canvas-command-bar-blocks_qa.tsx` vendor-sizes top-bar fix; `floor-plan-canvas_dashboard_qa.tsx` zoom min 0.75.
- **Verify:** `/coordinator/dashboard` — one bell (app nav); header autosave + Edit/Preview pill; alignment section shows Auto-Arrange + table sizes; zoom 50/75/100%; legend left; tab booths; vendor matches empty state; single matrix + inline CTA; wizard Step 3 room bar + table strip match dashboard chrome.

## Shipped this session (event dashboard layout — top toolbar, mobile booth matrix, deployed 2026-06-10)
- **Top toolbar strip:** Layout tools (Room & Canvas, Shapes, Alignment, Floor Plan) moved from left rail to horizontal bar below dashboard header via `dashboard-top-toolbar-strip.tsx` + `topBarLayout` on `CanvasCommandBar` / `CanvasToolbarStatic`; `floor-plan-v2.tsx` portals into top strip on all viewports.
- **Dashboard shell:** `dashboard-app-shell.tsx` drops fixed left column; `Dashboard_qa.tsx` wires toolbar strip + preview mode; header compact (`py-1.5`).
- **Command center header:** Edit / Preview toggle (`command-center-fullscreen-context` `previewMode`); live notification badge placeholder; subtitle updated.
- **Site nav:** `--app-nav-height` 4.5rem → 3.15rem (~30% reduction); `CenteredHeaderRow` grid centers inline links; hamburger on all breakpoints; Bell notification slot in header; `app-menu-sheet` Profile settings first in nav list.
- **Booth matrix:** `booth-matrix-panel.tsx` — desktop table, mobile accordion; shared `use-booth-matrix-rows.ts`.
- **Workflow CTA:** `dashboard-next-step-cta.tsx` — high-contrast **Next step** button over canvas (invites / payments / overview).
- **Google Maps:** `google-maps-provider.tsx` documents Maps JS / Places / Geocoding API restriction errors → `GoogleMapsApiFallback`.
- **Verify:** `/coordinator/dashboard` — tools in top bar (not left); phone — booth matrix accordion; Edit/Preview hides toolbar + dims canvas; **Next step** routes to applications or payments; break Maps key → amber fallback on wizard/discover.

## Shipped this session (app menu density — semantic sections, deployed 2026-06-10)
- **`app-menu-sheet.tsx`:** Rebuilt slide-out menu with semantic `<nav>` / `<section>` / `<ul>` lists; tighter padding, `min-h-10` row targets, grouped Navigate / Account / Actions sections; 2-column grid for 4+ primary links; dropped duplicate Profile settings when profile header is shown; removed heavy Button wrappers.

## Shipped this session (side menu / sidebar scroll, deployed 2026-06-10)
- **`dashboard-toolbar-portal.tsx`:** Replaced `flex-shrink-0` with `min-h-0 flex-1` so the command-center left rail scrolls when layout tools exceed viewport height.
- **`dashboard-app-shell.tsx`**, **`dashboard-tablet-tools-dock.tsx`:** Constrain drawer/aside overflow so the portaled toolbar scrolls inside the panel.
- **`app-menu-sheet.tsx`:** Fixed mobile hamburger drawer flex chain (`max-h-[100dvh]`, `overflow-hidden` shell, scrollable nav region).
- **`command-center-shell.tsx`:** Left/right workspace rails scroll independently on desktop when content exceeds viewport.
- **Verify:** Command center — expand all layout-tool accordions; bottom sections reachable via sidebar scroll. Phone — open hamburger menu with admin/extra links; scroll to Sign out.

## Shipped this session (header nav — logo left, hamburger restored, profile first, deployed 2026-06-10)
- **`centered-header-row.tsx`:** Restored three-zone flex layout — logo flush left (`mr-auto`), middle fills with portal tabs + inline nav links, actions right.
- **`app-nav.tsx`**, **`guest-nav.tsx`**, **`shopper-top-bar.tsx`:** Replaced profile-only `UserProfileMenu` dropdown with hamburger (`Menu` + `AppMenuSheet` on `md:hidden`); profile avatar/link is the **first** right-rail action (guests get user icon → login); logo in `left` slot; coordinator Dashboard / New Event / Wallet inline with role tabs on `md+`.
- **Suggest:** Remains in `AppMenuSheet` only (no desktop nav button).
- **Verify:** Phone — logo far left, profile icon then hamburger right; drawer opens with profile header first; desktop — logo + role pill + nav links aligned in one row.

## Shipped this session (deploy noop exit code fix, deployed 2026-06-10)
- **`Deploy-popuphub.bat` / `get-deploy-commit-message.ps1`:** When deploy script returns exit 2 (nothing to ship), bat normalizes to exit 0 so double-click does not show "Deploy failed".

## Shipped this session (deploy script already-shipped guidance, deployed 2026-06-10)
- **`deploy-popuphub.ps1`:** When no `not deployed` handoff sections exist, print baseline branch/commit and how to add a section or run `-SkipCommit`; exit 2 (noop) if tree is clean, exit 1 only when uncommitted work lacks a handoff section.
- **`Deploy-popuphub.bat`:** Exit code 2 shows "Nothing to deploy" instead of "Deploy failed"; PowerShell invoke uses safe `if defined DEPLOY_PS_ARGS` branch (no `PS_ARGS` parse error).
- **Handoff:** Deploy gate note at top of this file.

## Shipped this session (mobile UX, nav/footer overhaul, auth flows, deployed 2026-06-10)
- **Navigation:** Removed hamburger menus; `UserProfileMenu` dropdown (profile/user icon) holds nav links, notifications, sign-out, and **Suggest an Improvement** on all breakpoints. Desktop inline nav links remain on `lg+` in `app-nav.tsx`.
- **Header:** `CenteredHeaderRow` uses a 3-column grid — logo centered; mobile logo height capped (`h-14`/`h-16`) to prevent clipping; `safe-top` minimum padding increased globally.
- **Footer:** Removed footer logo from `build-version-footer.tsx`; root layout uses `min-h-dvh` + `flex-1` shells so footer pins without extra white space; mobile shopper bottom-nav padding tuned (keyboard-safe, not fixed).
- **Patron auth:** `/favorites` is public with guest CTA (Browse Markets / Sign In); favorite save still gates on click. Landing hero unchanged.
- **Coordinator mobile:** Middleware login/signup redirect uses `resolvePostLoginPath` (mobile-aware); `/coordinator/events/[id]/layout` server-redirects phones to event overview; market-day shell hides Spatial Planner tab on mobile.
- **Coordinator typography:** `PortalRoleBadge` shared label styling on mobile overview + empty dashboard state.
- **Admin / ops safe-area:** Extra top padding on `/admin` and market-day operations headers.
- **Suggestion control:** Removed desktop nav button + floating FAB; entry only via profile dropdown.
- **Address cleansing:** `lib/addresses/sanitize-address.ts` — heuristic Canadian address normalizer; wired into `wizard-step-venue.tsx` before AI/geocode.
- **Platform operator:** Migration `098_platform_operator_patron_access.sql` keeps `bradmulders@gmail.com` on shopper/vendor role with `is_admin`; favorite errors now surface Supabase message.
- **Verify:** Phone — centered logo, profile dropdown nav, compact footer pinned; guest `/favorites` → sign-in CTA not redirect; coordinator phone login → `?overview=mobile`; layout route blocked on phone; venue wizard messy address geocodes; suggest only in profile menu.

## Shipped this session (Vercel Analytics, deployed 2026-06-10)
- **`@vercel/analytics`:** Installed and wired in `app/layout.tsx` via `<Analytics />` for page-view tracking on Vercel deployments.

## Shipped this session (floor plan designer exit navigation — Full canvas fail-safe, deployed 2026-06-10)
- **Root cause:** Command-center **Full canvas** (`command-center-canvas-fullscreen`) and native wizard fullscreen hide site nav; coordinators had no persistent route back to event setup.
- **`command-center-exit-link.tsx`:** `resolveDesignerExitHref` / `resolveDesignerExitLabel` — draft markets → `/coordinator/events/[id]/setup?step=3`; published → event overview; `CommandCenterExitButton` for toolbar/fullscreen overlays (`z-[10001]`, `pointer-events-auto`).
- **Dashboard:** Sticky **Back to Event Setup** in `dashboard-left-panel.tsx`, `Dashboard_qa` left rail, `dashboard-tablet-tools-dock` drawer, and immersive header (`dashboard-command-center-header.tsx`); exits fullscreen before navigate.
- **Canvas toolbar:** Utilities row in `canvas-command-bar-blocks.tsx` — prominent exit link adjacent to Full canvas toggle; wired via `floor-plan-v2.tsx` + `dashboard-floor-plan.tsx` + `spatial-layout-editor.tsx`.
- **Native fullscreen:** `fullscreenExitToolbar` in `floor-plan-v2.tsx` pairs **Back to Event Setup** with **Exit Fullscreen**.
- **Verify:** `/coordinator/dashboard` → select draft market → **Full canvas** → left rail + header + utilities show green **Back to Event Setup**; click returns to setup step 3; `/coordinator/events/[id]/layout` native fullscreen shows same escape hatch.

## Shipped this session (profile copy — coordinator accountability, deployed 2026-06-09)
- **`app/profile/page.tsx`:** Coordinator Accountability helper text now reads *"Your public rating reflects on-time vs. late venue cancellations."*

## Shipped this session (header nav layout — hamburger menu, profile in drawer, logo left, deployed 2026-06-09)
- **`centered-header-row.tsx`:** Three-zone flex — brand `mr-auto` flush left, flexible middle (`min-w-0 overflow-x-hidden`), actions right; `justify-start` on row.
- **`app-nav.tsx`**, **`guest-nav.tsx`**, **`shopper-top-bar.tsx`:** Mobile hamburger (`Menu` icon, `md:hidden`) toggles `AppMenuSheet`; desktop profile avatar link unchanged (`md:inline-flex`); logo in `left` slot; `overflow-x-hidden` on `<nav>`/`<header>`.
- **`app-menu-sheet.tsx`:** `menuProfile` prop — avatar + name header inside slide-out panel (links to `/profile`); `overflow-x-hidden` on sheet + nav scroll area; guest menus keep "Menu" title.
- **`portal-tabs.tsx`:** Role toggle pill bar `overflow-x-auto` → `overflow-x-hidden`.
- **Verify:** Phone — logo far left, hamburger far right; drawer opens with profile header (signed-in) or Menu title (guest); no horizontal scrollbar in header chrome; desktop nav unchanged.

## Shipped this session (booth wall bounce fix — 0′ flush, footprint clamp, deployed 2026-06-09)
- **4′ deadzone + 5′ bounce:** Vendor drag no longer uses `snapToGrid` (grid loses to wall flush); live drag uses `positionOnly` wall snap (no per-frame `orientVendorBoothToNearestWall` fight); drag commit clamps instead of reverting to pre-drag origin.
- **`footprintClampDeltaForRoom`:** Independent X/Y clamp via `objectFootprintAabb` — `minX/maxX/minY/maxY` with 0′ vendor inset; guest tables keep 4′ `ROOM_PLACEMENT_CLEARANCE_FT`.
- **Wall band:** `VENDOR_WALL_SNAP_THRESHOLD_FT = 4` — within 4′ of a wall, snap flush to interior edge instead of bouncing to grid.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts`; drag vendor booth along each wall — flush at 0′, no 9′ bounce.

## Shipped this session (booth canvas — wall snap, E/W flush placement, arrow-key nudge, deployed 2026-06-09)
- **E/W 4′ regression:** `VENDOR_WALL_INSET_FT = 0` in `boundary-constraints.ts` — vendor booths flush to west/east room bounds; guest tables keep 4′ `ROOM_PLACEMENT_CLEARANCE_FT`. Axis-dominant perimeter picking + cross-axis preservation in `perimeter-booth-orientation.ts`; snap-before-clamp in `use-canvas-pointer.ts` and `selection-keyboard-nudge.ts`.
- **Corner flicker:** `pickPerimeterEdgeWithHysteresis` + locked wall edges during drag in `use-canvas-pointer.ts`.
- **Arrow-key nudge:** `selection-keyboard-nudge.ts` + `useSelectionKeyboardNudge` in `floor-plan-canvas.tsx` — Arrow 1′, Shift+Arrow 5′.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts`; layout editor → drag booth to west/east wall (flush, no flicker); arrow keys nudge selection.

## Shipped this session (coordinator mobile dashboard, maps provider, address AI geocode, deployed 2026-06-09)
- **Coordinator mobile dashboard:** `MarketDashboardClient` routes phones to `CoordinatorMobileOverview` (`isMobileDevice()` or `?overview=mobile`); dashboard page wraps client in `Suspense` for `useSearchParams`.
- **Post-login redirect:** OAuth callback uses `resolvePostLoginPath` (user-agent aware) instead of `getDefaultDashboard`; `Login_qa` passes `userAgent` only.
- **Google Maps provider:** `event-form`, `wizard-step-venue`, and `event-map` use shared `GoogleMapsProvider` + `GoogleMapsApiFallback` instead of raw `APIProvider`.
- **Venue wizard:** `venue-places-autocomplete` shows manual input fallback on Places `API_ERROR`; `wizard-step-venue` runs unstructured addresses through `useNormalizeAddressAi` before geocoding.
- **Layout:** `market-day-shell` main column `flex-1` so footer pins on short pages.
- **Verify:** Coordinator login on phone → mobile overview list (no canvas); OAuth callback lands on mobile overview; wizard venue step geocodes messy pasted address; break Maps key → fallback UI on map + Places fields; `/discover` map still renders with fallback list.

## Shipped this session (mobile UX, auth flows, maps/address AI, deployed 2026-06-09)
- **Mobile shell:** `safe-top` on admin Operations Console, market-day ops header, guest nav; root `min-h-screen` flex column + `flex-1` main in shopper/shared shells so `BuildVersionFooter` pins to viewport bottom; `CenteredHeaderRow` centers logo in `app-nav`, `shopper-top-bar`, `guest-nav`.
- **Navigation:** Removed hamburger triggers — mobile profile/user icon opens `AppMenuSheet`; desktop profile still links to `/profile`; Suggest FAB hidden below `md` (menu + nav bar retain entry).
- **Patron auth:** Landing hero → prominent **Browse Markets** + **Sign In** only; `/discover` and browse routes remain public (favorites/wallet still gate on save actions).
- **Coordinator mobile login:** `resolvePostLoginPath` + `CoordinatorMobileOverview` — phones land on `/coordinator/dashboard?overview=mobile` (event list, no canvas mount); login form + OAuth callback use shared helper.
- **Maps:** `GoogleMapsProvider` + `GoogleMapsApiFallback` (Maps JS / Places / Geocoding key guidance); `lib/addresses/parse-address-ai.ts` + `POST /api/parse-address` normalizes unstructured addresses before geocode in venue wizard.
- **Verify:** Phone PWA safe-area on `/admin`, `/coordinator/events/.../operations`; guest `/` → Browse Markets without login; coordinator login on phone → overview list not layout canvas; venue wizard paste messy address → AI normalize + pin; break Maps key → fallback alert.

## Shipped this session (CanvasEditor Auto-Arrange → Turf packBooths, deployed 2026-06-09)
- **`floor-plan-v2.tsx`:** Inspector **Auto-Arrange** button (`CanvasEditor`) now calls `PackBooths` / `AutoArrangeEngine.packBooths` (Turf-validated shelf scan inside `merged_zone`) instead of legacy `autoArrangeInRoom`; clears booth positions, packs with 5′ aisles, `store.replaceObjects`; unplaced booths stay off-canvas (`x/y = -999`).
- **`scripts/verify-auto-arrange-engine.ts`:** Smoke test for merged_zone polygon + stage obstacle — Turf overlap/containment.
- **Verify:** `npx tsx scripts/verify-auto-arrange-engine.ts`; `npx tsx scripts/verify-layout-pathfind.ts`; layout editor → deselect all → **Auto-Arrange** packs vendor booths into merged zone.

## Shipped this session (layout editor — auto-arrange refactor, patron flow overlay, OpenRouter fix, deployed 2026-06-09)
- **Auto-arrange grid (`auto-arrange.ts` + `deterministic-market-layout.ts`):** Back-to-back double-row blocks with mandatory **6′ patron aisles** (`PATRON_AISLE_MIN_FT`); strict collision via `placedObjectsOverlap` + expanded obstacle probes; removed greedy fallback packer that caused overlaps; unplaced booths stage to open slots or are omitted with `removedOverlapCount` + toast: *"Could only fit X booths safely. Removed Y overlapping items."*
- **Patron flow overlay:** `lib/floor-plan/patron-aisle-overlay.ts` + `PatronAisleOverlay` (green dashed 6′ corridor bands); **Toggle Patron Flow** (Route icon) in ROOM & CANVAS utilities sidebar; combines with existing `PatronTrafficPathOverlay` when doors exist.
- **OpenRouter:** `lib/ai/openrouter.ts` uses `getURL()` for `HTTP-Referer`; dev console hints when `OPENROUTER_API_KEY` missing; `/api/layout/recommend` + client handle `AI_UNAVAILABLE` without breaking the inspector panel.
- **Env:** `GOOGLE_MAPS_API_KEY` added on Vercel production (2026-06-09). Client reads `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; redeploy picks up maps/Places after key sync.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` (31 pass); layout editor → Auto-Arrange (grid) no overlapping booths; Toggle Patron Flow shows green aisles; Ask AI shows panel error cleanly when key unset (set `OPENROUTER_API_KEY` in `.env.local` for live feedback); `/coordinator/events/new` Step 1 Places autocomplete + `/discover` map pins after prod redeploy.

## Shipped this session (AI layout recommendation panel, deployed 2026-06-09)
- **`app/api/layout/recommend/route.ts`:** Coordinator-gated POST; OpenRouter Claude 3.5 Sonnet (`layout_recommend` task) evaluates active-room layout for safety/traffic flow; returns `recommendedObjects`, `changelog`, `rationale`.
- **`lib/floor-plan/ai-layout-recommend.ts` + `request-layout-recommend.ts`:** Server prompt/parse/clip; client payload build (room-local coords), fetch, merge back to global `FloorPlanDoc`.
- **UI:** Left-rail **💡 Ask AI for Layout Feedback** (`canvas-command-bar-blocks` utilities); right inspector **AI Spatial Assessment** card with changelog bullets + **Apply AI Layout Changes** (`ai-spatial-assessment-panel.tsx`); wired in `floor-plan-v2_wizard_qa.tsx` for `/coordinator/events/[id]/layout` only (`!isDashboard`).
- **Verify:** `npx tsx scripts/verify-ai-provider-fallback.ts` (layout_recommend → claude-3.5-sonnet); layout route with `OPENROUTER_API_KEY` → Ask AI → panel shows rationale/changelog → Apply moves objects (undo works).

## Shipped this session (spatial layout editor — save draft, auto-arrange, patron path, deployed 2026-06-09)
- **Save draft:** `SpatialLayoutToolbar` + canvas utilities row — **Save draft** persists `booth_layouts` via `persistLayoutDraft` without publishing the event; **Save & deploy** unchanged. Loading states + success toasts on both paths.
- **Auto-arrange grid:** `floor-plan-v2.tsx` grid mode uses `autoArrangeInRoom` (reads active room bounds e.g. Main Hall 50′×50′, distributes vendor booths with aisle gaps). Traffic-flow door prereqs only gate staggered/perimeter/AI modes — grid works immediately with booths placed.
- **Patron path tool:** Route icon in shape selector toggles `PatronTrafficPathOverlay` (dashed sky-blue walk path via `usePathfinding`). Wired in production `floor-plan-v2` + `floor-plan-v2_wizard_qa` canvas.
- **Toolbar UX:** Command ribbon uses `flex-nowrap overflow-x-auto` instead of chaotic double-row wrap; tooltips remain portaled to `document.body` via `TooltipWrapper`.
- **Sidebar utilities fix:** Left-rail `utilities` block restored fullscreen (Expand icon), labels toggle, save draft, and save deploy — previously only zoom was rendered in `sidebarLayout` mode.
- **Verify:** `/coordinator/events/[id]/layout` → Save draft (no deploy) → reload confirms layout; Auto-Arrange Floor Plan (grid) spreads overlapping vendor booths; Patron Path toggle shows/hides walk overlay.

## Shipped this session (spatial layout — vendor-only capacity counting, deployed 2026-06-09)
- **Root cause:** `placedCount` used `store.doc.objects.length`, so walls, doors, exits, and other structural fixtures inflated the "X of Y max" badge and canvas object counter.
- **`floor-plan-v2.tsx`:** `placedCount` / `onPlacedCountChange` now use `vendorBoothsInRoom(store.doc, activeRoomId).length` — vendor booths only, scoped to the active room (matches Step 2 `layoutCapacity`). Canvas status badge label → "vendor booths placed".
- **`property-inspector.tsx`:** Multi-select header shows "N Vendors Selected" when vendor booths are in the selection; structural/non-vendor picks are called out in the subtitle instead of inflating the vendor tally.
- **`layout-planner-stats.tsx`:** Wizard left-rail counter label aligned to "vendor booths placed".
- **Note:** Structural assets already use distinct `kind` values (`wall`, `door`, `emergency_exit`, etc.) — no schema change required.
- **Verify:** `/coordinator/events/[id]/layout` → place vendor booths + walls/doors → toolbar badge counts vendors only; multi-select 39 booths + 1 wall → "39 Vendors Selected".

## Shipped this session (vendor table wall orientation fix, deployed 2026-06-09)
- **Root cause:** Wall orientation only updated `rotation` without normalizing footprint (`width`/`height`), so a table stored as 2×6 could present its short edge to the wall. Auto-pack and placement preview also skipped orientation when outside the 3′ snap threshold.
- **`perimeter-booth-orientation.ts`:** Exported `boothSpanAndDepth()` (uses `tableLengthFt` when set) and `orientBoothToNearestWallEdge()` — long back edge toward nearest wall, center preserved.
- **`vendor-booth-placement.ts`:** Added `orientVendorBoothToNearestWall()`; `vendorBoothPerimeterSnapPatch()` now snap-or-orients on every draw/drag commit.
- **`BoothArrangementEngine.ts`:** Pack post-step uses full wall orientation (not rotation-only).
- **`table-placement-preview.ts`:** Ghost preview orients toward nearest wall even beyond 2′ snap.
- **`auto-arrange.ts`:** Direct perimeter slots normalize span×depth before rotation.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts` — place/drag vendor table near any wall → long edge flush, opening inward; interior placement still auto-rotates toward closest wall.

## Shipped this session (layout designer — left sidebar, portal tooltips, auto-arrange fix, deployed 2026-06-09)
- **`tooltip-wrapper.tsx`:** Tooltips portaled to `document.body` (escapes `overflow: hidden` on layout tools rail).
- **`floor-plan-v2_wizard_qa.tsx`:** Left sidebar `bg-white` + `border-r`; wired `handleAutoArrangeFloorPlan` via `autoArrangeInRoom` (reads active room e.g. Main Hall 50′×50′, grid-packs placed objects).
- **Verify:** `/coordinator/events/[id]/layout` → tools in left column; hover tooltips not clipped; Auto-Arrange Floor Plan moves booths when objects exist.

## Shipped this session (spatial layout editor — left panel section headers + rigid toolbar, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** Left-rail sidebar regrouped into **ROOM & CANVAS**, **SHAPES & BOOTHS**, and **ALIGNMENT & SPACING** (new `vendor-sizes` block for 5′–20′ grid chips).
- **`canvas-toolbar-static.tsx` + `canvas-toolbar-static_qa.tsx`:** Section headers (`text-xs font-semibold text-muted-foreground`), `border-t` dividers, `shrink-0` section shells.
- **`canvas-command-bar-blocks.tsx` + `_qa.tsx`:** Icon rows `flex-nowrap`; zoom % fixed width; selection metrics in absolute badge; labels toggle in alignment section.
- **`floor-plan-v2_wizard_qa.tsx`:** `/coordinator/events/[id]/layout` uses a fixed 300px left **Layout tools** rail (`staticLayout` + `sidebarLayout`); status badges use fixed-height slots so counts do not shift tool rows.
- **Verify:** Open event layout editor → left panel shows three labeled sections; place/select objects → toolbar icon rows do not wrap or jump.

## Shipped this session (Step 2 Capacity & Pricing layout refactor, deployed 2026-06-09)
- **`wizard-step-capacity.tsx`:** Two-column desktop layout — left **Physical & pricing setup** (floor stats + booth fee), right **Inventory & category limits** (suggested caps, MLM guard, accordion category editor). Removed `TableSizeSelector` from Step 2 (table size still driven via wizard context / floor plan).
- **`smart-populate-booth-caps.tsx`:** Floor math breakdown (gross floor, aisle subtractions, etc.) moved into a hover tooltip on **Usable floor** via `FloorCalculationBreakdown`.
- **`category-limit-editor.tsx`:** Flat 40-row table replaced with collapsible accordions grouped by broad type (Makers & Crafts, Art & Prints, Food & Beverage, Apparel, Commercial / MLMs); CSS grid aligns max-slot and fee inputs; Quick Start top, Add Category Slot bottom.
- **`market-booth-pricing-fields.tsx`:** Added `compact` prop for nested left-column layout.
- **`mlm-tier-guard.tsx`:** Grid alignment for Max MLMs input.
- **Verify:** Market wizard Step 2 → two columns on `lg+`; category sections collapse/expand with slot totals in headers; usable-floor (?) shows calculation tooltip; no table-size picker on this step.

## Shipped this session (coordinator dashboard — no forced initial room modal, deployed 2026-06-09)
- **Root cause:** `dashboard-bootstrap.tsx` and `Dashboard_qa.tsx` auto-mounted `InitialRoomModal` (full-screen overlay + body scroll lock) whenever a selected market had zero saved rooms — intercepting login before the dashboard shell was usable.
- **`dashboard-no-room-empty-state.tsx`:** Inline empty state in the canvas column (room dimensions form + "Open layout designer") — no portal, no scroll hijack.
- **`dashboard-bootstrap.tsx` + `Dashboard_qa.tsx`:** Removed mandatory `InitialRoomModal`; dashboard header + left rail render immediately; canvas shows inline empty state until first room is added.
- **`market-dashboard-client.tsx`:** Zero-events path button label → **Create New Market** (unchanged route `/coordinator/events/new`).
- **Verify:** Coordinator with a market but no rooms → lands on dashboard shell (header, left panel) with inline "Set up your floor plan" — not a blocking modal. Coordinator with zero markets → centered empty state + Create New Market.

## Shipped this session (Square OAuth blank-page hardening, deployed 2026-06-09)
- **`lib/square/app-credentials.ts`:** `resolveSquareApplicationId()` now reads `NEXT_PUBLIC_SQUARE_CLIENT_ID` and `SQUARE_SANDBOX_CLIENT_ID` (sandbox) in addition to existing keys; rejects literal `"undefined"` / `"null"` strings.
- **`lib/square/connect-url.ts`:** `buildSquareOAuthAuthorizeUrl` validates `client_id`, `redirect_uri`, and `state` before building; `tryBuildSquareOAuthAuthorizeUrl` catches/logs failures instead of crashing the page.
- **`app/api/square/oauth/callback/route.ts`:** Top-level try/catch; safe redirect base from `NEXT_PUBLIC_APP_URL` or request origin (fixes `Invalid URL` crash when env unset); JSON 500 fallback when redirect impossible.
- **`app/coordinator/payment-methods/`:** Server uses `tryBuildSquareOAuthAuthorizeUrl`; wired `SquareConnectAlerts`, `SandboxSquareOAuthNotice`, and dev sandbox bypass panel.
- **`connect-button.tsx`:** Client-side authorize URL validation blocks navigation when `client_id`/`state` missing; logs to console.
- **Verify:** Coordinator → Payment Methods → with valid env, Connect button href includes non-empty `client_id`; with missing app id, inline config message (not blank page); OAuth callback errors redirect to `/coordinator/payment-methods?error=…`.

## Shipped this session (market wizard draft save RLS fix, deployed 2026-06-09)
- **Root cause:** Production wizard called `persistEventDraft` from the browser Supabase client. `coordinator_id` came from a server-rendered prop, but RLS requires `auth.uid() = coordinator_id` on the JWT attached to the insert — a mismatch (or missing client session) triggers Postgres `42501`.
- **`lib/wizard/wizard-autosave.ts`:** `resolveCoordinatorIdForPersist()` reads the live session via `auth.getUser()` for direct client saves. Added `persistEventDraftViaApi()` so browser autosave posts to a server route. `persistEventDraft()` accepts `{ coordinatorId }` for server-verified writes with the admin client.
- **`app/api/coordinator/events/draft/route.ts`:** POST handler authenticates via cookie-backed `createClient()`, verifies coordinator role, checks draft ownership on update, then persists with `createAdminClient()` and explicit `coordinator_id: user.id`.
- **`components/coordinator/market-setup-wizard.tsx`:** Autosave / "Proceed to Capacity Settings" now calls `persistEventDraftViaApi` instead of a direct client-side `events` insert.
- **Verify:** Sign in as coordinator → `/coordinator/events/new` → complete Step 1 → Continue → Network shows `POST /api/coordinator/events/draft` 200 with `eventId`; no 42501 in response.

## Shipped this session (portal tab sync with patron routes, deployed 2026-06-09)
- **`lib/portals/active-portal.ts`:** Added `isPatronPortalPath()` for browse routes (`/discover`, `/favorites`, `/supplies`, `/events/*`, `/auctions/*`); `resolveActivePortal()` now prefers the current URL over the `active_portal` cookie on those paths so the Patron pill highlights correctly on `/discover` even when the cookie still says Coordinator/Vendor. Shared routes like `/wallet` still honor the cookie.
- **`lib/supabase/middleware.ts`:** Patron browse deep links sync the `active_portal` cookie to `patron` (same pattern as vendor/coordinator prefixed routes).
- **`lib/portals/qa-active-portal.ts`:** Updated assertions for discover + wallet behavior.
- **Verify:** Sign in as coordinator → visit `/discover` directly → Patron tab is active; switch to Coordinator → lands on `/coordinator/dashboard`; `/wallet` keeps prior portal tab.

## Shipped this session (initial loader tagline — Markets Made Easy, deployed 2026-06-09)
- **`components/brand/initial-loader-reveal.tsx`:** Tagline changed from "Plan · Host · Grow" to "Markets Made Easy"; extended SVG viewBox bottom padding, widened progress bar, reduced letter-spacing, and removed uppercase transform so the full phrase renders without clipping during the reveal animation.

## Shipped this session (Market Setup Wizard flyer upload fallback + toast, deployed 2026-06-09)
- **`hooks/use-flyer-scan.ts`:** Flyer parse failures log `console.warn` instead of throwing; JSON parse and `applyParsedFlyer` wrapped so the wizard stays interactive for manual entry.
- **`components/coordinator/flyer-parse-error-toast.tsx`:** Rose-themed top-right toast (`flex flex-row … max-w-sm`) with ✕ dismiss and 5s auto-close via Sonner `toast.custom`.
- **`wizard-step-event-details.tsx`:** Removed full-step parsing overlay so Event name, Description, and Start date/time stay focusable while AI runs in the background (`FlyerCoverUpload` inline status only).

## Shipped this session (auto commit message in Deploy-popuphub.bat, deployed 2026-06-09)
- **`Sync-DeployCommitMessageArtifacts`:** Refreshes `REM Next commit (auto):` in `PM/Deploy-popuphub.bat` and `PM/deploy-commit-message.txt` whenever handoff updates or deploy runs — no manual message editing.
- **`Deploy-popuphub.bat`:** Removed commit-message arg; double-click ships with auto-derived message from undeployed handoff sections.

## Shipped this session (deploy pipeline — duplicate Vercel builds + commit message, deployed 2026-06-09)
- **`vercel.json`:** `git.deploymentEnabled.master/main: false` — git push no longer triggers a production build; CLI `vercel deploy --prod` is the sole prod deploy path (fixes two builds per commit).
- **`scripts/get-deploy-commit-message.ps1`:** `Get-DeployCommitMessageFromHandoff` aggregates all `## Shipped this session (... , not deployed)` titles into the deploy commit message; `Mark-ShippedSectionsDeployed` flips them to `deployed yyyy-MM-dd` after handoff update.
- **`PM/Deploy-popuphub.bat`:** Removed stale hardcoded default message; omits `-Message` when arg 1 not passed so PowerShell derives message from session handoff.
- **`scripts/deploy-popuphub.ps1`:** Resolves commit message from handoff when `-Message` omitted; logs chosen message before commit.

## Shipped this session (Turf.js AutoArrangeEngine + canvas editor, deployed 2026-06-09)
- **`engine/AutoArrangeEngine.ts`:** `packBooths(roomPolygon, boothList)` — shelf scan inside merged_zone; largest-first sort; **5′ aisle** buffer; Turf `booleanPointInPolygon`, `booleanWithin`, `booleanOverlap` for room containment and collision with booths/stages/walls; unplaced booths → off-canvas sentinel (`x/y = -999`).
- **`engine/BoothArrangementEngine.ts`:** `PackBooths()` now delegates to AutoArrangeEngine; perimeter wall orientation preserved post-pack.
- **`canvas/canvas-editor.tsx`:** **Auto-Arrange** button (inspector canvas panel when nothing selected).
- **`floor-plan-v2.tsx`:** `handleAutoArrange` → `replaceObjects`; fixed `usePathfinding` hook order (TS2454).
- **Dependency:** `@turf/turf` added.
- **Verify:** `npx tsx scripts/verify-layout-pathfind.ts` — 4/4 booths placed + path visits all.

## Shipped this session (floor-plan A* pathfinding, deployed 2026-06-09)
- **`PathfindingService.ts`:** Navigation grid from merged_zone / room boundary polygons (`buildNavigationGrid`); walkable cells inside boundary rings; booth/stage/wall impassable; A* with Euclidean heuristic f(n)=g(n)+h(n); nearest-neighbor TSP booth order; entrance/exit optional.
- **`hooks/use-pathfinding.ts`:** `usePathfinding(doc, roomId, { booths, roomBoundary, cellFt, enabled })` returns optimal path coordinates.
- **`canvas-overlays.tsx`:** Patron path rendered as dashed SVG `<polyline>` (`strokeWidth={2}`, `pointerEvents="none"`).
- **`floor-plan-v2.tsx`:** Wired hook after auto-layout; path stays in sync with doc edits while enabled.
- **Verify:** `npx tsx scripts/verify-layout-pathfind.ts` — PackBooths + path visits all booths.

## Baseline
- Branch: `master` @ `08e6663` (pushed to `origin/master`)
- Production: https://popuphub.ca - **v1.0.0 build 97** | commit `08e6663` (handoff updated 2026-06-12 09:55)
- **Deploy script:** `PM/Deploy-popuphub.bat` [commit message] -> `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Stashed (not shipped):** `git stash` entry `loader WIP` - brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)


## Shipped this session (dynamic auth redirect base URL, deployed 2026-06-09)
- **`lib/url/public-app-url.ts`:** Added `getURL()` — resolves origin from `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_VERCEL_URL` / Vercel host envs → browser origin → `http://localhost:3000`; normalizes scheme and strips trailing slashes. Removed hardcoded `popup-hub.vercel.app` production fallback.
- **OAuth:** `getOAuthOrigin()` now uses live `window.location.origin` on any domain (including `popuphub.ca`); login/signup `signInWithOAuth` + signup `emailRedirectTo` use `buildOAuthCallbackUrl(getOAuthOrigin(), …)`.
- **API:** `app/api/auth/callback/route.ts` resolves redirect origin from `x-forwarded-host` / `host` + `x-forwarded-proto` (or `request.url` origin) — never env-based Vercel default; success redirect `${origin}${next}` default `/discover`.
- **`next.config.ts`:** Injected `NEXT_PUBLIC_APP_URL` via `getURL()` instead of hardcoded Vercel domain.
- **Manual (Supabase dashboard):** Set Site URL to `https://popuphub.ca`; add redirect wildcards `https://popup-hub.vercel.app/**`, `http://localhost:3000/**`.
- **Verify:** Set `NEXT_PUBLIC_SITE_URL=https://popuphub.ca` in Vercel production → Google OAuth from popuphub.ca returns to `/api/auth/callback` on same origin.

## Shipped this session (vendor passport TikTok field, deployed 2026-06-09)
- **Migration `098_vendor_passport_tiktok.sql`:** `vendor_passports.tiktok_url` optional text column alongside `instagram_url` / `facebook_url`.
- **Forms:** TikTok input in Online presence (`/vendor/passport` wizard + `PassportSocialFields`); `normalizeTikTokUrl` coerces `@handle` / bare handle → `https://tiktok.com/@handle` on save.
- **Public display:** `TikTokIcon` + `getPassportSocialLinks` renders TikTok on `PassportPublicCard` (and vendor link surfaces using shared social helpers).
- **Verify:** `/vendor/passport` → enter `@mybrand` in TikTok → save → public passport card shows TikTok icon linking to `https://tiktok.com/@mybrand` in a new tab.

## Shipped this session (vendor passport story per-file captions, deployed 2026-06-09)
- **`passport-story-uploader.tsx`:** Replaced `PendingItem` with `StoryDraft` (`id`, `file`, `previewUrl`, `captionText`); vendors get per-story caption inputs in the upload queue with live preview overlay; publish sends each draft's `captionText` to `POST /api/passport/stories`.
- **Coordinator market promos:** Unchanged — shared caption + hashtag rules still apply to the whole batch.
- **Verify:** `/vendor/dashboard` → Passport stories → queue 2+ files → add different captions → publish → published list shows each caption.

## Shipped this session (admin console menu link, deployed 2026-06-09)
- **`buildAppMenuExtraLinks`:** Slide-out menu shows **Feature requests** + **🛠️ Admin Console** (`/admin/feedback`) when `profile.is_admin`; wired in `AppNav` and `ShopperTopBar`.
- **Verify:** Sign in as admin → open hamburger menu → both links visible beneath Profile settings; non-admin sees neither.

## Shipped this session (admin feedback triage filters, deployed 2026-06-09)
- **`FeedbackAdminDashboard`:** Fourth metric card **Total Completed**; **Critical Urgency** excludes `status = completed`; incoming list hides completed rows; marking completed clears selection to next active item.
- **Verify:** Complete a ticket → leaves triage list, completed count increments, critical count drops if applicable.

## Shipped this session (admin notified on feature request submit, deployed 2026-06-09)
- **Migration `099_feature_request_admin_notification.sql`:** `feature_request_submitted` notification type.
- **`notifyAdminsOfFeatureRequest`:** After `POST /api/feedback/submit`, inserts in-app notifications for every `profiles.is_admin` user; message includes role + urgency prefix (Critical / Blocked-workflow / New).
- **UI:** Notification feed icon (lightbulb), visible in all portal tabs; tap opens `/admin/feedback`.
- **Verify:** Migration `099` applied to remote Supabase (with `098`); deploy app code — submit suggestion → admin sees unread badge + notification; click → `/admin/feedback`.

## Shipped this session (admin feedback route hardening + theme polish, deployed 2026-06-09)
- **Middleware:** `/admin/*` blocked unless `profiles.is_admin` or valid `ADMIN_SESSION_TOKEN` (`admin_session` cookie / Bearer header); non-admins redirect to role-appropriate dashboard via `accessDeniedRedirect`.
- **Layout + page:** Same gate with redirect (no blank page); header/back link use semantic `border-border`, `bg-card`, `bg-muted` tokens.
- **Dashboard:** Master-detail UI uses design tokens for dark/light (list cards, metric tiles, problem/solution blocks, role badges).
- **API:** `PATCH /api/feedback/update` unchanged — saves `status` + `developer_notes` without page refresh.
- **Verify:** Non-admin → `/admin/feedback` redirects to their portal home; admin (`is_admin`) → triage console loads; PATCH save updates list + detail in place.

## Shipped this session (notification count portal filter fix, deployed 2026-06-09)
- **Root cause:** `useNotificationCount` counted all unread notifications for the user, while `NotificationList` filters by active portal (`filterNotificationsForPortal`). A user in Patron portal with an unread Vendor notification saw header "1 unread notification" but an empty feed.
- **Fix:** `notificationTypesForPortal()` in `lib/notifications/portal-filter.ts`; `useNotificationCount(userId, activePortal)` applies `.in('type', portalTypes)`; `AppNav` and `NotificationPageHeader` pass resolved `activePortal`.
- **Verify:** `npx tsc --noEmit` passes. Manual: switch portal tabs with cross-portal unread rows — badge/subtitle should match visible list (or "You're all caught up" when filtered list is empty).

## Shipped this session (build + lint fixes, deployed 2026-06-09)
- **Lint:** `auto-arrange.ts` `prefer-const` (`let placed` → `const placed`).
- **Compile:** Removed self-import in `lib/auth/rbac.ts` (`canActAsCoordinator` defined twice).
- **Types:** Wallet-topup null guard + `is_admin` select; `AccessProfile` loosened; `applyCoordinatorEventScope` simplified to avoid deep Supabase instantiation; dashboard revenue query inlined.
- **Toolbar:** Restored missing `case 'optimize'` for Auto-Arrange Floor Plan button.
- **Verify:** `npm run lint` (0 errors) and `npm run build` pass locally.

## Shipped this session (floor-plan canvas UX optimization, deployed 2026-06-09)
- **Room controls:** Sidebar **ROOM CONTROLS** — undo, redo, rotate, delete, and copy icons in one horizontal row (`flex flex-row items-center gap-2 mt-2`) directly under the room picker; room rotate/join on a compact second row.
- **Placement preview:** Booth draw tool shows a semi-transparent cursor ghost (`opacity-40`) with predictive 2′ wall snap + auto-rotation via `table-placement-preview.ts` and `PLACEMENT_PREVIEW_WALL_SNAP_FT`.
- **Toolbar compaction:** Patron/vendor size selectors use utility chip grids; auto-arrange **Pattern** row uses inline Grid / Staggered / Perimeter chips; sidebar section padding tightened.
- **Verify:** `/coordinator/dashboard` — select vendor or patron table tool → ghost follows cursor, snaps/flips near walls; room action icons stay on one line.

## Shipped this session (build verification — local only, deployed 2026-06-09)
- **`npm run build`** passes on `master` @ `7c1654b` (TypeScript + static generation, build **46**).
- Prior Vercel prod failure (`51a871d`) was `b.category` on `BoothObject` in `request-ai-auto-arrange.ts` — fixed on master as `b.categoryName`.
- Preview deploy `cursor/dev-environment-setup-4447` @ `8de61c8` also builds locally; Vercel log truncated after cache restore (likely stale cache / infra — redeploy if still failing).

## Shipped this session (build fix — local only, deployed 2026-06-09)
- **`geometry.ts`:** `placedObjectsOverlap` passes `ctx?.doc` (not whole `MergeOverlapContext`) to `collisionProbeForObject` — fixes TS build failure.
- **`booth-access.ts`:** `EventAccessFields` uses `Pick<Event, …>` so `venue_verification_status` matches `VenueGateEvent`.
- **`feature-request-modal.tsx`:** Select `onValueChange` guards against `null` before `setTargetComponent`.
- **`verify-vendor-wall-snap.ts`:** Added required `RoomFrame.name` field.
- **Verify:** `npm run build` succeeds (build **29**).

## Shipped this session (admin feature-request triage console, deployed 2026-06-09)
- **Migration `094_admin_feature_request_management.sql`:** `profiles.is_admin`; `feature_requests.status`, `developer_notes`, `updated_at`; admin RLS read/update policies.
- **Route `/admin/feedback`:** Layout + middleware gate on `profiles.is_admin` or `ADMIN_SESSION_TOKEN` cookie/header (`admin_session`); non-admins redirect to role-appropriate dashboard.
- **UI:** Master-detail dashboard — metrics (Pending / Critical / Under Review), role + urgency badges, problem/solution preview, screenshot fullscreen dialog, status dropdown + developer notes, optimistic PATCH save.
- **API:** `PATCH /api/feedback/update` (admin-only).
- **Access:** `bradmulders@gmail.com` is sole platform **admin** (`is_admin` only — not a market host, not a payment settlement account). Optional `ADMIN_SESSION_TOKEN` for headless API.
- **Platform fees (3% + $1):** **Square-only** for this operator — card path → Square `appFeeMoney` on the Popup Hub Square application (`thetipsyfoxyeg@gmail.com` / The Tipsy Fox). Offline path → coordinators accrue `account_balances` (Stripe Checkout invoicing code exists but is unused/inactive for this operator). **Not** routed through coordinator Connect profiles; coordinator booth splits still go to each host's connected Square/Stripe.
- **Migrations `095`–`097`:** `platform_settings.platform_operator_id`, `platform_fee_email` (admin contact), `platform_square_email` (Square app owner); reverted mistaken coordinator promotion for operator login. Profile `a8356170-ac3b-4fd4-b59c-0efb39a00346`.
- **Script:** `npx tsx scripts/grant-platform-operator.ts` — admin grant only.
- **Admin superuser (`is_admin`):** Bypasses role gates in middleware, portal switcher (Patron · Vendor · Coordinator), coordinator/vendor layouts, `canActAsCoordinator` APIs, and `assertEventCoordinator` / `applyCoordinatorEventScope` (view any market). Profile stays **vendor** — not a market host. Nav menu → **Feature requests** → `/admin/feedback`.
- **Verify:** Sign in as `bradmulders@gmail.com` → portal tabs show all three portals → `/coordinator/dashboard` lists every market → open another coordinator's event setup/ops → `/admin/feedback` triage works without page refresh.

## Shipped this session (global feature-request module, deployed 2026-06-09)
- **`POST /api/feedback/submit`:** Multipart pipeline for title, role, target component, problem/dream copy, impact level, optional PNG/JPG screenshot (stored under `vendor-assets/{userId}/feature-requests/`).
- **`093_feature_requests.sql` + `094_admin_feature_request_management.sql`:** `feature_requests` table, user RLS, admin triage columns (`status`, `developer_notes`), `/admin/feedback` console.
- **Global entry points:** Navbar link + mobile menu item **Suggest an Improvement**; floating action button on patron/coordinator/vendor chrome (hidden on immersive viewport-fill routes like floor-plan canvas).
- **Modal UX:** Role-aware target dropdowns, required-field gating, drag-and-drop screenshot, success state **🚀 Idea Captured!**
- **Verify:** Sign in as coordinator/vendor/patron → open suggestion modal from nav link or FAB → submit → row appears in `/admin/feedback` (admin profile).

- **Migration `092_venue_verification_and_vendor_invites.sql`:** `events` venue verification columns; `event_booth_slots` + `vendor_priority_invites`; `vendor_access_equality_until`; `priority_booth_invite` notification type.
- **Venue verification:** `lib/venues/verify-venue-coordinates.ts` + `POST /api/coordinator/venues/verify`; gates on wizard publish, event form, status toggle, spatial layout deploy, vendor apply, Square/Stripe booth payment.
- **Vendor Matches (no distance cap):** `lib/vendors/category-vendor-matches.ts` + dashboard sidebar **Vendor Matches** panel (`vendor-matches-panel.tsx`) with **Send Priority Invites**; `GET/POST /api/coordinator/events/[eventId]/priority-invites`.
- **Access phases:** 24h `priority_exclusive` window → daily cron `vendor-priority-window-expiry` (7:00 UTC; Hobby plan limit) + lazy expiry on booth-access reads → `public_release` + 90-day equal queue (`shouldDisableRankingPriorityForEvent` in FCFS queue).
- **Vendor UX:** `GET /api/vendor/events/[eventId]/booth-access`; apply-button badges (priority invite / opens to all / new-vendor-friendly).
- **Verify:** `npx tsx scripts/verify-venue-coordinates.ts`; `npx tsx scripts/verify-category-vendor-matches.ts`; `npx tsx scripts/verify-priority-window-expiry.ts`.

## Shipped this session (unified auto-arrange floor plan + traffic-flow prerequisites, deployed 2026-06-09)
- **`traffic-flow-prerequisites.ts`:** Validates perimeter-snapped Entry (`door`/`entrance`) + Exit (`emergency_exit` or `door`/`exit`) before optimization; exports door snapshots with coordinates, rotation, and wall edge.
- **`floor-plan-v2.tsx`:** Single `handleAutoArrangeFloorPlan` with `scope: 'all'` — vendor + patron arranged in one pass; disabled until entry/exit prerequisites met.
- **`canvas-command-bar-blocks.tsx` + QA mirror:** New **`optimize`** toolbar block — prominent **Auto-Arrange Floor Plan** button at top of sidebar **Floor Plan** section; separate vendor/patron auto-arrange controls removed.
- **`lib/floor-plan/ai-auto-arrange.ts` + `request-ai-auto-arrange.ts`:** Gemini 2.5 Pro payload includes entry/exit fixture geometry + `trafficFlow` loop hint (vendors face primary path, patron zones in low-velocity areas); deterministic fallback uses `autoArrangeInRoom` for `scope: 'all'`.
- **Verify:** Dashboard with no doors → button disabled, hover tooltip: *Please place at least one Entry and one Exit door on your perimeter walls to optimize traffic flow.* Snap Door + Exit on walls, add booths/tables → button enables → one toast optimizes both asset types together.

## Shipped this session (floor-plan iron-dome + cyber-arcade fallback UI, deployed 2026-06-09)
- **`use-floor-plan-viewport-tier.ts`:** Iron dome — `isPocketSizedViewport` when `width < 1024` **or** `height < 550` (blocks landscape phones, tablets, and short windows).
- **`floor-plan-viewport-advisory.tsx`:** Full-screen blueprint/cyber-arcade fallback (`bg-slate-950` grid, amber neon card, Ant-Man copy, pro-tip box); **Abort Mission & Go Back 🚀** uses `router.push` to event hub or `/coordinator/dashboard`.
- **Canvas:** Still fully unmounted when pocket-sized; tablet advisory banner removed (subsumed by iron dome).
- **Verify:** Phone portrait/landscape, iPad, and narrow windows → fallback only; ≥1024×550 desktop → canvas loads.

## Shipped this session (mobile floor-plan gate exit + landscape phone block, deployed 2026-06-09)
- **`use-floor-plan-viewport-tier.ts`:** Tier detection uses width **and** height — landscape phones (`height < 550`, short axis `< 600`) stay on the mobile block even when width exceeds 768px.
- **`floor-plan-viewport-advisory.tsx`:** Portal-mounted overlay at `z-[10001]` with working **Go back** `Link` (event hub when a market is selected, else `/coordinator/dashboard`); body scroll locked while blocked.
- **`Dashboard_qa.tsx`:** Skips initial-room modal while the mobile gate is active (was stacking above the overlay at `z-9999`).
- **`dashboard-toolbar-portal.tsx`:** Sidebar/tablet portal routing uses the same tier helper so landscape phones do not mount the tablet drawer layout.

## Shipped this session (dashboard floor-plan viewport tiers: mobile block + tablet layout, deployed 2026-06-09)
- **`hooks/use-floor-plan-viewport-tier.ts`:** Three-tier breakpoints — mobile `<768`, tablet `768–1023`, desktop `≥1024`; portrait detection for tablet advisory.
- **`floor-plan-viewport-advisory.tsx`:** `FloorPlanViewportLayoutProvider`, full-screen **Desktop Screen Required** overlay on phones, fixed portrait **Landscape Mode Recommended** banner on tablets.
- **`dashboard-tablet-tools-dock.tsx` + `dashboard-app-shell.tsx`:** Tablet rail — 48px icon dock + sliding drawer for layout tools; grid `md:grid-cols-[3rem_1fr]` until `lg`.
- **`dashboard-toolbar-portal.tsx`:** Portals command bar into left rail on tablet (drawer) and desktop.
- **`Dashboard_qa.tsx`:** Canvas unmounted on mobile; portrait banner offset (`pt-11`) on canvas column.
- **`table-size-pill.tsx` + `command-button.tsx`:** Tablet touch padding on `5′`/`6′`/`8′` booth buttons; toolbar icons keep 48px targets through `lg`.
- **Verify:** `/coordinator/dashboard` — phone shows desktop-required modal (no canvas); iPad portrait shows landscape banner + dock hamburger; iPad landscape / desktop unchanged full rail.

## Shipped this session (vendor 360° collision buffer, deployed 2026-06-09)
- **`vendor-booth-placement.ts`:** Vendor booths use 2′ clearance on all four sides (6′×4′ → 10′×8′ collision probe). Wall-snapped booths omit the rear buffer against the perimeter; left/right/front buffers remain.
- **`geometry.ts` / `checkCollision()`:** Expanded probes flow through `placedObjectsOverlap` with doc context for wall exception.
- **`auto-arrange.ts`:** Slot placement + obstacle rects use vendor collision probes; validation passes overlap context.
- **Canvas / pointer:** `mergeOverlapCtx` includes full doc slice for asymmetric wall probes.
- **Verify:** `npx tsx scripts/verify-vendor-booth-clearance.ts`

## Shipped this session (table rotation handle fix, deployed 2026-06-09)
- **Root cause:** Rotate handles lived under a `pointerEvents="none"` SVG group (clicks fell through to the grid/booth), and live vendor wall-snap during drag overwrote manual rotation whenever the booth stayed within 3′ of a wall.
- **`canvas-overlays.tsx`:** Split `SelectionChrome` (non-interactive) + `SelectionRotateHandles` (interactive top layer with explicit `pointerEvents="auto"`).
- **`floor-plan-canvas.tsx`:** Render rotate handles **after** room selection overlay; removed debug `console.log`.
- **`canvas-grid.tsx`:** Grid layer `pointerEvents="none"` so it never intercepts transform handles.
- **`use-canvas-pointer.ts`:** Rotate/drag gestures mutually exclusive; rotate halt uses `rotatedAabb`; live vendor snap preserves non-cardinal manual rotation during drag (full orient snap still on pointer-up).
- **Verify:** Select vendor/patron table → rotate handle visible above selection → drag handle to rotate; manual angle persists when dragged away from walls.

## Shipped this session (vendor wall snap fix — drag clamp + live snap, deployed 2026-06-09)
- **Root cause:** `boothClampDeltaForRoom` used 4′ wall inset, preventing booths from entering the 3′ snap zone; snapped positions then failed `footprintWithinBounds` (also 4′) and reverted on drop.
- **`boundary-constraints.ts`:** Vendor booths use 1′ wall inset (`VENDOR_WALL_INSET_FT`); patron tables keep 4′ clearance.
- **`use-canvas-pointer.ts`:** Live perimeter snap + rotation during drag (not only on pointer-up).
- **`vendor-booth-placement.ts`:** Snap distance measured against placement-surface bounds (union/merged rooms), not raw room frame only.
- **Verify:** `npx tsx scripts/verify-vendor-wall-snap.ts` — drag vendor within 3′ of wall → rear flush, faces inward; >3′ → no snap.

## Shipped this session (vendor wall snap + lateral clearance, deployed 2026-06-09)
- **`vendor-booth-placement.ts`:** 3′ wall snap threshold with inward rotation (0/90/180/270°); lateral collision probe adds 2′ per side (6′×4′ → 10′×4′ effective).
- **`geometry.ts`:** `checkCollision()` / `placedObjectsOverlap` use lateral-expanded vendor probes.
- **`use-canvas-pointer.ts`:** Vendor snap on draw + drag commit (before overlap test); overlap blocks drop with red preview.
- **Verify:** Drag vendor booth within 3′ of wall → snaps flush, faces inward; place two booths <4′ apart laterally → blocked with violation styling.

## Shipped this session (vendor booth yellow canvas styling, deployed 2026-06-09)
- **`category-palette.ts`:** `VENDOR_BOOTH_PALETTE` — fill `#FEF08A`, stroke `#EAB308`.
- **`canvas-objects.tsx` + QA mirror:** All vendor booths render solid yellow (status patterns retired; payment state via label text).
- **`placement-theme.ts` + `canvas-legend.tsx`:** Legend adds yellow **Vendor** swatch (`bg-yellow-200 ring-yellow-500`) synced with canvas.
- **Verify:** `/coordinator/dashboard` — draw vendor booths → yellow fill + amber border; legend top-right shows yellow **Vendor** chip.

## Shipped this session (Gemini auto-arrange + boundary physics + label clipping, deployed 2026-06-09)
- **`lib/ai/tasks.ts`:** New `auto_arrange_layout` task → `google/gemini-2.5-pro` (fallback Claude 3.5 Sonnet).
- **`lib/floor-plan/ai-auto-arrange.ts` + `app/api/coordinator/auto-arrange/route.ts`:** OpenRouter optimization prompt (visibility, walkways, traffic flow); JSON placements returned to client.
- **`lib/floor-plan/request-ai-auto-arrange.ts`:** `runAutoArrangeWithAi` — Grid/Staggered/Perimeter all route through Gemini first; deterministic engine fallback when API unavailable.
- **`lib/floor-plan/boundary-constraints.ts`:** Strict booth footprint validation + post-AI coordinate clipping inside room clearances.
- **`structural-wall-snap.ts` + `use-canvas-pointer.ts`:** Doors/exits snap flush to nearest perimeter wall with wall-aligned rotation on draw/drag.
- **`canvas-label-text.ts` + `canvas-objects.tsx`:** Dynamic font shrink + ellipsis for long labels ("Unassigned Vendor", "Patron", status pills).
- **`floor-plan-v2.tsx` + wizard QA mirror:** Async auto-arrange handlers with loading toast.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` (31/31); `npx tsx scripts/verify-ai-provider-fallback.ts` (26/26). Coordinator dashboard: vendor/patron Auto-Arrange with `OPENROUTER_API_KEY` → success toast cites Gemini model; without key → deterministic fallback. Draw door on room edge → snaps flat to wall; drag booth past perimeter → rejected.

## Shipped this session (dashboard floor-plan sidebar vertical stack, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** `getVisibleSidebarSections` / `getVisibleSidebarSectionsQa` — four full-width blocks (Room Controls, Designer Tools, Patron Layout, Vendor Booths).
- **`canvas-toolbar-static.tsx` + `_qa`:** `sidebarLayout` renders stacked `SidebarToolbarSection` cards (no `grid-cols-2` split rows).
- **`dashboard-toolbar-portal.tsx`:** Portal host `flex flex-col gap-4 overflow-y-auto w-[300px] min-w-[300px] flex-shrink-0`.
- **`dashboard-app-shell.tsx` + `dashboard-bootstrap.tsx`:** Left rail fixed at 300px; **Full canvas** immersive mode keeps the left tools column (canvas expands, panel layout unchanged).
- **`floor-plan-v2.tsx`:** Dashboard always passes `sidebarLayout`; toolbar portals to left rail on desktop even in full canvas.
- **Verify:** `/coordinator/dashboard` — four labeled sections stack vertically at 300px; toggle **Full canvas** — left panel stays 300px with same section headers (no horizontal crush).

## Shipped this session (document scroll across portal pages, deployed 2026-06-09)
- **`portal-workspace-layout.tsx`:** `routeUsesViewportFill` is now an allowlist (command center, setup/layout wizards, experience designer) — removed blanket `/coordinator/*` and vendor dashboard/applications locks that trapped scroll in the center column.
- **Vendor workspace:** `/vendor/events` and `/vendor/passport` included in the 3-column grid with `documentScroll` mode (same as supplies).
- **`scripts/verify-document-scroll-routes.ts`:** Smoke test for viewport-locked vs document-scroll routes.
- **Verify:** Scroll wheel works anywhere on vendor dashboard/applications/events/passport and coordinator payment-methods, event overview, applications board — not only over list/card regions. Immersive routes (dashboard CAD, setup wizard, layout planner) still viewport-locked.

## Shipped this session (vendor supplies scroll fix, deployed 2026-06-09)
- **`site-app-shell.tsx`:** Non-viewport-fill routes use document scroll on `#site-main` (removed nested `overflow-y-auto`).
- **`portal-workspace-layout.tsx` + `command-center-shell.tsx`:** `/vendor/supplies` in vendor workspace grid; supplies uses `documentScroll` mode (no inner `overflow-y-auto` on center column).
- **`app/vendor/supplies/page.tsx`:** `min-h-screen w-full` page shell with horizontal padding.
- **`vendor-supplies-section.tsx`:** Grid/cards no longer use `h-full` height locks.
- **Verify:** `/vendor/supplies` — scroll wheel works over header, search, filters, and side rails; not limited to the card grid.

## Shipped this session (vendor supplies setup-order sort, deployed 2026-06-09)
- **`lib/vendor/supplies-catalog.ts`:** Each curated item has a `setupOrder` integer (phases 1–5: shelter → power → merchandising → POS → takeaway). `filterVendorSupplies` sorts filtered results by `setupOrder` so the **All** tab follows chronological booth setup; category tabs still filter exclusively and inherit the same within-group order.
- **`scripts/verify-vendor-supplies.ts`:** Asserts All-view id sequence and booth-tab order.
- **Verify:** `/vendor/supplies` — **All** shows tent → weights → table → tablecloth → extension cord → lights → display → signage → tools → packaging; **Packaging** tab shows only kraft bags + tissue paper.

## Shipped this session (nav role switcher tab deck, deployed 2026-06-09)
- **`components/nav/portal-tabs.tsx`:** Patron / Vendor / Coordinator switcher styled as a rounded segmented track (`rounded-full`, muted stone track, inset shadow); active tab elevated white pill with forest text + market shadow; inactive tabs muted with hover lift.
- **`components/nav/app-nav.tsx`:** Role switcher grouped with vertical divider + gap before contextual nav links (Dashboard, My Passport, etc.) on `md+`.
- **Verify:** Sign in as vendor or coordinator — header shows pronounced tab deck; active role pops above track; divider separates role block from page links on desktop.

## Shipped this session (Step 3 floor-plan layout — sidebar + toolbar wrap, deployed 2026-06-09)
- **`floor-plan-v2.tsx` + `floor-plan-v2_wizard_qa.tsx`:** Wizard layout uses a viewport row (`flex-row`, `overflow-hidden`, `h-full` embedded / `h-[calc(100vh-64px)]` standalone) — middle column holds wrapping command bar + scrollable canvas (`flex-1 max-w-full`); right properties panel fixed at `w-[320px] min-w-[320px] shrink-0 h-full`.
- **`canvas-command-bar.tsx` + `_qa`:** Non-static ribbon container uses `flex flex-wrap gap-2` so tool groups wrap instead of forcing one line.
- **`table-size-pill.tsx`:** Size chip rows use `flex-wrap gap-2` (was `flex-nowrap`).
- **`floor-plan-canvas.tsx`:** Canvas scroll host adds `min-w-0 max-w-full` so flex middle column can shrink without crushing the inspector.
- **Verify:** `/coordinator/events/[id]/setup?step=3` — properties sidebar stays 320px readable; toolbar wraps on narrow widths; canvas pans/zooms in middle column only.

## Shipped this session (simplify populate caps UX, deployed 2026-06-09)
- **`smart-populate-booth-caps.tsx`:** Renamed panel to "Suggested category caps"; plain-language description; compact preview (max booths, usable floor, suggested split); technical breakdown collapsed under "How we calculated this"; button "Apply suggested caps"; hide venue dimension inputs when `venueReadOnly`.
- **`booth-planner.tsx`:** Canvas action renamed "Auto-arrange booths" (was "Smart Populate Layout"); simplified tooltip; max-booths copy in Step 2.
- **`wizard-step-capacity.tsx`, `spatial-layout-toolbar.tsx`, `layout-planner-stats.tsx`, `floor-plan-stats-panel.tsx`, `floor-plan-inventory-panel.tsx`:** Replaced C_max jargon with "Max booths" / plain language.
- **Verify:** Market setup wizard Step 2 — apply suggested caps fills category editor; booth planner Step 3 — "Auto-arrange booths" distinct from cap panel; event form still shows editable venue dims.

## Shipped this session (wizard venue map auto-pin on address, deployed 2026-06-09)
- **`components/coordinator/wizard/wizard-step-venue.tsx`:** Address side-effect listeners — debounced geocode (400ms) plus immediate geocode on bulk fills (template, flyer OCR, paste); bootstrap geocode when Maps API loads with a pre-filled address; sync `lastGeocodedAddressRef` when parent drops pin (template/saved venue) to avoid duplicate lookups.
- **`components/map/map-recenter.tsx`:** After external coordinate/pin updates, trigger `resize` + `idle` refresh so Advanced Markers paint without requiring a map click; pan + zoom on first pin drop even when coords were set externally.
- **Verify:** `/coordinator/events/new` — pick Edmonton venue template or upload flyer with address → red pin appears and map pans immediately; type a full address manually → pin updates after brief debounce.

## Shipped this session (sign-out redirect fix, deployed 2026-06-09)
- **`lib/auth/sign-out.ts` (new):** Shared `signOutAndRedirectToLogin()` — sets intentional-signout flag, calls `supabase.auth.signOut()`, then `window.location.replace('/login')` for a clean login page without `redirectTo`.
- **`components/nav/app-nav.tsx` + `components/shopper/shopper-top-bar.tsx`:** Sign out menu actions use the shared helper instead of soft `router.push`.
- **`components/auth/auth-session-guard.tsx`:** Skips `redirectTo` query on intentional sign-out; falls back to plain `/login`.
- **Verify:** Sign in, open app menu → Sign out — lands on `/login` with no query params; no stuck protected-route error state.

## Shipped this session (flyer auto-detect quarter auction listing type, deployed 2026-06-09)
- **`lib/flyer/listing-type.ts` (new):** Maps AI `listing_type: "quarter_auction"` → wizard `garage_yard_sale`; text fallback for "Quarter Auction" / "Live Auction".
- **`lib/flyer/parse-flyer-vision.ts`:** OpenRouter prompt adds `listing_type` with auction visual/text cues; quarter auctions forced to `single_day`.
- **`lib/flyer/apply-parsed-flyer.ts` + `market-setup-wizard.tsx`:** Flyer scan calls `handleListingTypeChange` so LISTING TYPE toggles to Quarter auction immediately.
- **Verify:** `/coordinator/events/new` — upload quarter/live auction flyer → Quarter auction segment selected; community market flyer unchanged.

## Shipped this session (flyer date extraction — next occurrence + multi-day, deployed 2026-06-09)
- **`lib/flyer/normalize.ts`:** `resolveNextOccurrenceDate`, `parseMultiDayDateSpan`, and upgraded `normalizeFlyerDate` — month/day without year rolls to next calendar year when already passed; stale/wrong years (e.g. 2006) re-resolve to current/next occurrence; parses "Oct 5-6" spans.
- **`lib/flyer/parse-flyer-vision.ts`:** OpenRouter/Gemini prompt now requests `schedule_type`, `start_date`, `end_date`; explicit multi-day span rules; dynamic current-year guidance; snake_case coercion + schedule normalization.
- **`lib/flyer/apply-parsed-flyer.ts` + types + `/api/parse-flyer`:** Multi-day flyer results set wizard `multi` schedule, populate `dayRows` via `buildDayRowsForDateRange`, and assign independent start/end dates.
- **`scripts/verify-flyer-date-normalize.ts`:** 7/7 pass.
- **Verify:** `/coordinator/events/new` — upload flyer with "Oct 5-6" → Multi-Day selected, 2026-10-05 / 2026-10-06; month-only date after today uses 2026, before today uses 2027.

## Shipped this session (discover date filters + Add to Calendar, deployed 2026-06-09)
- **`lib/shopper/discover-date.ts`:** New presets `this_week` and `this_month` for URL `when=` param.
- **`lib/shopper/events.ts`:** `getThisWeekEndDate`, `getThisMonthEndDate`, `filterEventsByDateRange` — week runs today through upcoming Sunday; month runs today through end of calendar month.
- **`components/shopper/discover-screen.tsx` + `discover-date-filter.tsx`:** "This Week" and "This Month" buttons in WHEN row; date summary shows range labels.
- **`lib/shopper/calendar-export.ts`:** `buildEventCalendarPayload` — event name, times, venue address, description with popuphub event URL.
- **`components/shopper/add-to-calendar-button.tsx` (new):** Touch-friendly button downloads `market-event.ics` via blob.
- **`discover-event-cards.tsx`:** Directions + Add to Calendar side-by-side on each card.
- **`event-action-bar.tsx`:** Event detail sticky bar uses ICS download (labeled on mobile, icon on desktop).
- **Verify:** `/discover` — tap This Week / This Month; market cards show Add to Calendar; open `/events/[id]` on mobile — calendar button downloads `.ics`.

## Shipped this session (discover page copy + flyer upload removal, deployed 2026-06-09)
- **`components/shopper/discover-screen.tsx`:** Removed "Have a flyer?" upload section; page title changed from "Discover Community Markets" to "Popup Hub Community Markets".
- **Removed:** `components/shopper/discover-flyer-upload.tsx`, `lib/shopper/parse-flyer-image.ts` (shopper-only flyer heuristic; coordinator flyer OCR unchanged).
- **Verify:** Open `/discover` — no flyer upload card; heading reads "Popup Hub Community Markets".

## Shipped this session (initial loader logo clip + transparency fix, deployed 2026-06-09)
- **`components/brand/initial-loader-reveal.tsx`:** Restored full transparent `/popup-hub-brand.png` lockup (icon + wordmark); removed inner clip path that was cropping the logo during scale; `fitLogoInRing()` sizes by aspect ratio so the full mark fits inside the stall ring without overlap.
- **Verify:** Hard refresh — full "Popup Hub" wordmark visible, no checkerboard/solid box behind logo, nothing clipped at bottom during fade-in.

## Shipped this session (initial loader perimeter + logo overlap fix, deployed 2026-06-09)
- **`components/brand/initial-loader-reveal.tsx`:** Perimeter stalls now skip corners (top/bottom rows inset between side columns; side count capped so sides do not overlap bottom row). Logo uses square `/popup-hub-icon.png`, sizes to inner ring bounds, clips to inner rect, and fades in only after stalls finish (progress 0.58+).
- **Verify:** Hard refresh `/` or login — stalls form a clean ring with no corner overlap; logo glow and icon stay inside the ring during fade-in.

## Shipped this session (multi-instance Stage tool on layout designer, deployed 2026-06-09)
- **`lib/floor-plan/stage-placement.ts` (new):** Default 12×8′ tap footprint and `nextStageLabel()` — auto labels "Stage 1", "Stage 2", … from existing `objects[]` count.
- **`use-canvas-pointer.ts` (+ wizard QA mirror):** Stage draw uses centered default footprint on click (like food trucks); each commit appends a new stage with incrementing label — no replace/move of prior stages.
- **`canvas-objects.tsx`:** Stage outline-only rect (`fill="none"`), `cursor: move`, stroke stays visible when joined to a room perimeter.
- **`floor-plan-canvas.tsx` + `canvas-overlays.tsx`:** Selection overlay skips duplicate dashed box on stages; draft preview shows outline-only for stage placement.
- **Verify:** `npx tsx scripts/verify-canvas-state-smoke.ts` — 27/27 pass. Smoke `/coordinator/dashboard` — arm Stage in Designer Tools, click canvas repeatedly → multiple labeled stages; select + drag + trash each independently.

## Shipped this session (sticky placement tools on dashboard canvas, deployed 2026-06-09)
- **`floor-plan-v2.tsx`:** `handleAfterDrawCommit` — dashboard keeps draw tool armed after placement (clears selection only); wizard still reverts to Select. `stickyDrawPlacement={isDashboard}` on canvas.
- **`use-canvas-pointer.ts`:** `stickyDrawPlacement` option + hover ghost preview (`placementHoverRect` / `placementHoverKind`) between stamp clicks.
- **`floor-plan-canvas.tsx`:** Merges draft + hover preview for `DraftPreview`; crosshair cursor unchanged while draw tool armed.
- **Deactivation unchanged:** pointer/hand toolbar icons, different size/tool selection, `Escape` → Select.
- **Verify:** `tsc --noEmit` clean; smoke `/coordinator/dashboard` — arm vendor `6′`, click canvas repeatedly without re-selecting tool; ghost outline follows cursor between clicks.

## Shipped this session (layout designer sidebar row layout refactor, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** `STATIC_ROW_HEADERS`, `SIDEBAR_STATIC_ROW_SEGMENTS`, `getStaticRowSegments()` — sidebar moves undo/redo left with room controls; tools + zoom right.
- **`canvas-toolbar-static.tsx` (+ QA):** Split headers ("Room Controls" | "Designer Tools", "Patron Layout" | "Vendor Booths"); `sidebarLayout` two-column grid with vertical divider; bare block clusters (no per-block border crush).
- **`canvas-command-bar.tsx` (+ QA):** Passes `sidebarLayout` into block context and static toolbar.
- **`canvas-command-bar-blocks.tsx` (+ QA):** Sidebar branches — patron toggles-on-top + Grid dropdown; vendor 4-col size grid + Perimeter dropdown; primitives flex-wrap tool grid; zoom-only utilities.
- **`table-size-pill.tsx`:** `PatronSidebarControls`, `VendorSidebarSizeGrid`; vendor active sizes use `bg-forest`; patron sizes use violet.
- **`layout-room-bar.tsx`:** `sidebar` prop — vertical stack: room picker, dimensions (`40′ × 40′`), add room, undo/redo sibling block.
- **Verify:** `tsc --noEmit` clean; smoke `/coordinator/dashboard` at lg+ — left rail shows split headers, room column vs tool grid, patron/vendor divider with stacked controls.

## Shipped this session (OpenRouter AI gateway + task-based models, deployed 2026-06-09)
- **`lib/ai/tasks.ts` (new):** Central registry maps workloads → OpenRouter models — `flyer_vision` / `vision_json` → Gemini 2.5 Flash; `chat_json` → GPT-4o mini; `creative_layout` → Claude 3.5 Sonnet; `creative_generation` → Claude Sonnet 4. Per-task env overrides: `OPENROUTER_MODEL_<TASK>` / `OPENROUTER_MODEL_<TASK>_FALLBACK`.
- **`lib/ai/openrouter.ts` (new):** Server-side OpenRouter chat client (`openRouterChatForTask`) with quota/rate-limit fallback to each task's secondary model.
- **`lib/ai/generate-json-vision.ts`:** Vision JSON now routes exclusively through OpenRouter (no direct Gemini/Groq API calls).
- **`lib/ai/env.ts`:** `OPENROUTER_API_KEY` is the primary gateway; legacy `GEMINI_*` / `GROQ_*` keys deprecated.
- **`lib/flyer/parse-flyer-vision.ts`:** Flyer OCR uses task `flyer_vision`; `meta.source` is `openrouter` (or `heuristic` when key missing).
- **`lib/build-info.ts`:** `/version` payload adds `openRouterConfigured`; `geminiConfigured` now reflects any AI key. Env checks inlined (no `@/lib/ai/env` import — `next.config.ts` loads this file before path aliases resolve).
- **Verify:** `npx tsx scripts/verify-ai-provider-fallback.ts` — 22/22 pass. Set `OPENROUTER_API_KEY` on Vercel before deploy.
- **Not migrated:** Experience Designer still proxies to external Master Generator backend — wire via `creative_generation` task when that service moves in-app.

## Shipped this session (flyer AI parse → Gemini 2.5 Flash, superseded by OpenRouter task routing, deployed 2026-06-09)
- **`lib/ai/env.ts`:** Flyer vision always uses `google/gemini-2.5-flash` (override via `FLYER_GEMINI_MODEL_ID` only); global `GEMINI_MODEL_ID` default bumped to 2.5 Flash for other callers.
- **`lib/ai/generate-json-vision.ts`:** Optional `geminiModelId` per call so flyer parse can pin a model without affecting other vision callers.
- **`lib/flyer/parse-flyer-vision.ts`:** Uses `resolveFlyerGeminiModelId()`; strips markdown JSON fences before `JSON.parse`.
- **Verify:** Upload a flyer on market setup wizard Step 1 — fields populate; API `meta.source` is `gemini`; check Vercel logs if `GEMINI_API_KEY` missing (falls back to Groq or filename heuristic).

## Shipped this session (wizard event name + description limits, deployed 2026-06-09)
- **`copy-audit.ts`:** `DESCRIPTION_MAX_LENGTH = 2000` (was 800 in UI defaults).
- **`wizard-ui.tsx`:** New `WizardLabeledInput` — static label above field; Step 1 event name uses it instead of floating label inside the box. `WizardDescriptionField` default max 2000.
- **`wizard-step-event-details.tsx` (+ QA step1):** Event name * label sits above the input, matching description field layout.
- **`event-form.tsx`:** Description `maxLength` 2000.
- **Verify:** Market setup wizard Step 1 — event name label outside input; description accepts up to 2000 chars with counter `…/2000`.

## Shipped this session (vendor booth size → auto-arm draw tool, deployed 2026-06-09)
- **`canvas-command-bar-blocks.tsx` (+ QA):** Vendor booth size pills (`5′`, `6′`, `8′`, …) now call `activateTableSize` instead of `onTableSizeChange` only — sets size and arms the square/booth draw tool in one click; square icon highlights via existing `isTablePlacementActive('vendor')`.
- **Verify:** Smoke `/coordinator/dashboard` — click a vendor size in VENDOR BOOTHS; square icon turns amber-active and cursor places booths at that size without a second click on the square tool.

## Shipped this session (layout designer sidebar — merged control rows, deployed 2026-06-09)
- **`toolbar-static-layout.ts`:** Four accordion rows collapsed to two merged rows — `room-tools` (Room Controls + Designer Tools) and `placement` (Patron Layout + Vendor Booths); legacy localStorage row ids migrate on load.
- **`canvas-toolbar-static.tsx` + `canvas-toolbar-static_qa.tsx`:** Split-row flex layout — `lg:flex-row lg:justify-between` with vertical divider; left/right segments per row; wraps on medium viewports.
- **`canvas-command-bar.tsx` + QA mirror:** Passes `layoutCtx` for segment visibility (tools hidden until first room exists).
- **`canvas-command-bar-blocks.tsx` (+ QA):** Patron/vendor blocks use inline flex-wrap for side-by-side segment content.
- **Verify:** `tsc --noEmit` clean; smoke `/coordinator/dashboard` — sidebar shows 2 rows (room+tools, patron+vendor) on lg; canvas gains ~2 accordion header heights.


## Shipped this session (layout designer 1′ grid calibration, deployed 2026-06-09)
- **`canvas-grid-spacing.ts`:** Layout designer canvas always uses 1′ minor cells + major line every 5′ (`CANVAS_GRID_MAJOR_EVERY`); removed table-size-based 2′ mesh that made 50′ rooms span only 5 major (10′) blocks.
- **`floor-plan-v2.tsx`:** `canvasGridDocPatch()` keeps `gridSpacingFt` / `snapFt` at 1′ on load and table-size changes so pointer snap matches the visual grid.
- **`floor-plan-canvas.tsx`:** Grid layer reads calibrated spacing (unchanged API; now always 1′/5′).
- **Verify:** inline `canvasGridSpacingForTableFt(5..20)` → `minorFt === 1`; smoke `/coordinator/dashboard` — 50′ × 50′ Main Hall spans 50 minor subdivisions per edge; booth drop/snap unchanged at 1′.

## Shipped this session (deploy script streaming fix, deployed 2026-06-09)
- **`scripts/git-sync.ps1`:** `Invoke-NativeCommand` streams stdout/stderr line-by-line instead of buffering until process exit — `vercel deploy` no longer appears hung for 3-6 minutes with no output.
- **`Invoke-VercelProdDeploy`:** Sets `CI=1`, disables telemetry, passes `--non-interactive` for Explorer/bat launches.
- **`deploy-popuphub.ps1` / `ship.ps1`:** Use helper + hint that remote build takes several minutes.

## Shipped this session (patron table dimension lock + layout rows, deployed 2026-06-09)
- **`floor-plan-v2.tsx`:** Left-panel table size controls update the next-draw template only (`defaultPlacementSpec`); they no longer patch selected/placed booths when the pill changes after a draw auto-selects the new object.
- **`use-canvas-pointer.ts` (+ wizard QA):** `commitDraft` snapshots booth footprint via `boothPatchForTableSize` at drop time (`width`, `height`, `tableLengthFt`, shape/purpose, vendor clusters).
- **`table-size-pill.tsx` + `canvas-command-bar-blocks.tsx` (+ QA):** New `PatronTableSizeRows` — circle row and rectangle row (`flex-col` / `flex-nowrap`) with 5′/6′/8′ size pills; toolbar block wrappers use full width.
- **Verify:** `npx tsx scripts/verify-canvas-state-smoke.ts` — 23/23 pass.

## Shipped this session (initial room modal — table size removed, deployed 2026-06-09)
- **`initial-room-modal.tsx`:** Removed vendor table size selector (`Vendor table size` label, `TABLE SIZE` grid, caption) from **Create your first room**; modal now only collects Width/Length (ft) + **Open layout designer**.
- **`dashboard-bootstrap.tsx` + `Dashboard_qa.tsx`:** `onConfirm(widthFt, lengthFt)` passes footprint only; `appendLayoutRoom` defaults `baseline_table_length_ft` to 6′ (`DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT`).
- **Verify:** `npx tsx scripts/verify-table-size-default.ts` — 19/19 pass; `tsc --noEmit` clean. Smoke: `/coordinator/dashboard` on event with no saved rooms — modal shows dimensions only; canvas opens with 6′ baseline; table size changeable from designer toolbar.

## Shipped this session (tooltip height stretch fix, deployed 2026-06-09)
- **`components/coordinator/tooltip-wrapper.tsx`:** Anchor uses `relative inline-flex h-auto w-fit self-start` so flex toolbars no longer stretch the positioning box to full row height; bubble gets explicit `h-auto w-max`. Optional `className` prop (e.g. `w-full` for catalog rows).
- **`components/ui/tooltip.tsx`:** `TooltipTrigger` and `TooltipContent`/`Positioner` constrained with `h-auto w-fit self-start` — HelpCircle triggers no longer inherit flex cross-axis stretch.
- **`wizard-filter-tooltip.tsx`**, **`tooltip-wrapper_qa.tsx`**, map pin tooltips (`wizard-step-venue*.tsx`): same anchor/bubble sizing guards.

## Shipped this session (vendor table size selector — modular presets, deployed 2026-06-09)
- **`lib/booth-planner/layout-table-size.ts`:** Replaced single-dimension sizes (7′/9′ removed) with modular vendor presets: 5/6/8′ singles plus 10/12/15/16/18/20′ combined footprints (`VENDOR_TABLE_SIZE_OPTIONS`).
- **`components/coordinator/table-size-selector.tsx`:** 3×3 grid with modular sub-labels `(5′×2)` etc.; used by wizard capacity step and booth planner (not initial room modal).
- **`table-cluster-layout.ts` + `table-booth-consolidation.ts` + `use-canvas-pointer.ts`:** Contiguous multi-table clusters on draw/resize; geometry uses total length × 2′ depth.
- **`canvas-objects.tsx`:** Vertical dividers between sub-tables in clustered vendor booths.
- **Verify:** `npx tsx scripts/verify-table-size-default.ts` — 19/19 pass; `tsc --noEmit` clean.

## Shipped this session (discover page scroll fix, deployed 2026-06-09)
- **`components/shopper/shopper-shell.tsx`:** Removed viewport-locked nested scroll (`min-h-[100dvh]` + `main` `overflow-y-auto` / `min-h-0` / `flex-1`). Browse routes (`/discover`, `/favorites`, etc.) now use `min-h-screen` and natural document scroll so footer and expanded flyer content are reachable.


## Shipped this session (layout merge engine — polygon union, deployed 2026-06-09)
- **`src/utils/layoutMergeEngine.ts` (new):** `polygon-clipping` boolean union for room + stage; `unionLayoutParticipants`, `computeRoomStageUnion`, `resolvePerimeterUnionRingForRoom`, `runPatronPerimeterLayout` / `runVendorPerimeterLayout` (zero API tokens).
- **`room-union-merge.ts` + `geometry-sanitize.ts`:** Destructive merge stores multi-vertex `perimeterRing` (L-shapes preserved, not AABB-only).
- **`placement-surface.ts`:** Auto-unions touching stages into placement outer ring for perimeter auto-arrange.
- **`room-frames.tsx` + `canvas-objects.tsx` + `Canvas_qa.tsx`:** Unified perimeter path rendering; inner connecting wall suppressed on dissolved stages.
- **`floor-plan-v2.tsx`:** Dashboard perimeter auto-arrange routes through `layoutMergeEngine`.
- **`Dashboard_qa.tsx`:** Re-exports patron/vendor perimeter layout helpers.
- **Verify:** `npx tsx scripts/verify-layout-merge-engine.ts` — 6/6 pass.


## Shipped this session (AI Theme Wizard removed, deployed 2026-06-09)
- **Removed:** AI Theme Wizard UI (`ai-generation-guardrails_qa.tsx`), OpenRouter proxy (`lib/ai/openrouter.ts`, `app/api/coordinator/ai-theme-layout/route.ts`), spatial codec (`spatialCompressor.ts`, `aiTokenGuard.ts`), verify script, and `js-tiktoken` dependency.
- **`Dashboard_qa.tsx`:** Left rail is toolbar portal only; `QaAccordionHeader` kept for canvas toolbar QA typography.
- **Kept:** `layoutMergeLocal.ts` + `floor-plan-v2.tsx` local merge validation (RBush, no AI).


## Last deploy
- 2026-06-12 09:55 - Deploy via deploy-popuphub.ps1 (08e6663)


## Goal
**Native mobile apps (iOS first, Android later)** — wrap the existing Next.js product for App Store distribution, then Play Store. Apple Developer Program account is enrolled (2026-06-08); Android follows after iOS TestFlight / App Store path is proven.

**Web (ongoing):** UX + QA dashboard wiring — layout animation, mobile polish, booth pricing inputs, QA dashboard live on `/coordinator/dashboard`. Login QA Jurassic Park lockout shipped to prod (build 163).

### Native mobile — current baseline
- **Web stack:** Next.js App Router on Vercel (`https://popuphub.ca`); PWA already ships (`public/manifest.json`, service worker, `use-install-prompt` iOS/Android coaches).
- **Apple:** Developer account active — can create App ID, certificates, provisioning profiles, and App Store Connect listing.
- **Android:** Not started; defer until iOS shell + review flow validated.
- **Shell:** **Capacitor 7** — `capacitor.config.ts`, bundle id `ca.popuphub.app`, loads `https://popuphub.ca` via `server.url` (v1 remote web app; see `mobile/README.md` tradeoffs).
- **Repo layout:** `mobile/www/` fallback shell, `ios/` Xcode project (generated), `scripts/mobile/` asset + sync helpers, `PM/ios-testflight.md` internal TestFlight checklist.
- **npm scripts:** `mobile:assets`, `mobile:sync`, `mobile:ios:open`, `mobile:ios:add`.
- **OAuth URL scheme:** `ca.popuphub.app://auth/callback` patched into `ios/App/App/Info.plist` — add same redirect in Supabase Auth before TestFlight sign-in smoke.

## Shipped this session (discover map scope copy, deployed 2026-06-09)
- **`components/markets/distance-radius-picker.tsx`:** Active “everywhere” banner now reads `Showing Popup Hub markets everywhere` (clarifies platform-registered markets only).

## Shipped this session (major version bump, deployed 2026-06-09)
- **`package.json` / `build-number.json` / `package-lock.json`:** Major version `0.1.0` → `1.0.0`; build counter reset to `1` (footer display: `v1.0.1 · build 1`).
- **`PM/ios-testflight.md`:** Version table updated to `1.0.0`.

## Shipped this session (footer copyright removed, deployed 2026-06-09)
- **`components/brand/build-version-footer.tsx`:** Removed `© {year}` from global footer; line now reads `Popup Hub · v{version} · build {n} · {commit}` (version/build/commit unchanged).

## Shipped this session (legal contact email update, deployed 2026-06-09)
- Replaced `legal@popuphub.app` with `thetipsyfoxyeg@gmail.com` in `components/legal/legal-document.tsx` (About + all legal page footers), `app/legal/terms/page.tsx`, and `lib/legal/faq-content.tsx`.

## Shipped this session (About Us + FAQ fee transparency, deployed 2026-06-09)
- **`app/legal/about/page.tsx` (new):** Full Popup Hub story — founders, fee breakdown (patrons/vendors/coordinators), trust/honesty policy, discovery vision.
- **`lib/legal/about-content.ts` (new):** Section copy for the About page.
- **`lib/legal/faq-content.tsx`:** Converted from `.ts` to support React answers; added middle-positioned **How much does Popup Hub cost…** (pricing + bypass rules) and **Why does Popup Hub charge fees?** (summary linking to `/legal/about`).
- **`lib/legal/links.ts`:** Footer nav includes **About Us**.
- **`app/legal/faq/page.tsx`:** Updated last-modified date; intro links to About Us.
- **Build fix:** QA floor-plan canvases (`floor-plan-canvas-wizard_qa.tsx`, `floor-plan-canvas_dashboard_qa.tsx`) synced to unified `SelectionOverlay` (removed obsolete `layer="outline"|"controls"` props). `npm run build` passes (build 177).

## Shipped this session (wizard Step 1 layout + venue/map reactivity, deployed 2026-06-09)
- **`wizard-ui.tsx` / `globals.css`:** Floating textareas `pt-6`; description + labeled textareas use static labels with counters in a flex row below the field (never inside the input).
- **`venue-places-autocomplete_qa.tsx`:** Wizard floating-label inputs (`placeholder=" "`) with bidirectional `place_changed` sync + `useEffect` DOM mirror for sibling/map updates.
- **`wizard-google-place-select_qa.ts`:** `fromMapGeocode` flag — map click reverse-geocode fills venue name + address + pin without preserving stale typed venue draft.
- **`wizard-step-venue_predictive_search.tsx`:** Map click uses `resolveVenueNameFromMapGeocode` + `formatPlaceAddress`; shared `PlaceResult` type.
- **`map-recenter.tsx`:** Re-pans and re-zooms when pin moves (autocomplete, template, or map click).
- **`google-place-venue.ts`:** `resolveVenueNameFromMapGeocode` helper.

## Shipped this session (auto-layout & patron pathfind, deployed 2026-06-09)
- **`engine/BoothArrangementEngine.ts` (new):** `PackBooths()` — greedy MaxRects guillotine bin-packing inside merged_zone / placement surfaces with **5′ aisle** constraint; orients booths toward nearest perimeter wall via `rotationForPerimeterEdge`.
- **`engine/PathfindingService.ts` (new):** `CalculateOptimalPath()` — custom lightweight A* on a walkability grid (booths + stages impassable); nearest-neighbor booth order; entrance → all vendor booths → exit.
- **`floor-plan-v2.tsx`:** Inspector action **Auto-Layout & Pathfind** — clears vendor booth coords, packs, pathfinds, `replaceObjects`, stores path for overlay.
- **`canvas-overlays.tsx`:** `PatronTrafficPathOverlay` — semi-transparent dotted sky-blue polyline.
- **`property-inspector.tsx`:** Sidebar button when no selection is active.
- **Verify:** `npx tsx scripts/verify-layout-pathfind.ts` — 3/3 pass.

## Shipped this session (Google Places venue/address autocomplete fix, deployed 2026-06-09)
- **`venue-places-autocomplete_qa.tsx`:** Removed `placesReady` from input `key` — remounting after Places loaded detached Google Autocomplete from the live input (predictions never appeared).
- **`wizard-step-venue.tsx`:** `APIProvider` now passes `libraries={['places']}` (parity with event form + QA provider).

## Shipped this session (canvas geometry revert — pointer capture / blue mask, deployed 2026-06-09)
- **`floor-plan-canvas.tsx` (`LayoutCanvas`):** Reverted viewport-lock framing (`useCanvasViewportFraming`, `fitViewportToContent`, `contentFramingBounds`); restored pre-resize `frameActiveRoom` + scroll-container ResizeObserver; simplified `onPointerDown` (no capture swallow); added temp `console.log('Canvas Interaction State:', e.target)` on `onMouseDown`; single `SelectionOverlay` pass (no split outline/controls layer).
- **`canvas-overlays.tsx`:** Reverted object resize handles + dimension labels (removed `pointerEvents="all"` resize hit targets).
- **`canvas-objects.tsx`:** `merged_zone` render — `fillOpacity={0}` (decorative mask no longer tints rooms blue/teal); layer stays `pointerEvents="none"`.
- **`canvas-grid.tsx`:** Grid layer `pointerEvents="auto"` so clicks reach the surface.
- **`geometry-sanitize.ts`:** Reverted stricter `isValidPlacementLocationBBox` (centroid-only gate) — restores placement behavior consumed by `use-floor-plan-doc.ts` `isValidPlacementLocation`.
- **`use-floor-plan-doc.ts`:** No direct diff (unchanged since `a2e5286`); placement gate fix is via `geometry-sanitize` import.

## Shipped this session (event setup checklist reorder, deployed 2026-06-09)
- **`event-readiness-checklist.tsx`:** Reordered steps — Square + booth layout now precede "Event published"; quarter auction step only when `listing_type` is quarter auction (`garage_yard_sale` via `isQuarterAuctionListing`).
- **`app/coordinator/events/[id]/page.tsx`:** Quarter Auctions panel and header Auctions link hidden for standard community markets.

## Shipped this session (layout canvas viewport init + 100% zoom, deployed 2026-06-09)
- **`use-layout-viewport.ts`:** `VIEWPORT_FIT_PADDING_PX` (40px safe-zone); `fitViewportToContent` returns target zoom and prefers pixel padding for baseline framing.
- **`use-viewport.ts`:** `fitToBounds` accepts `paddingPx`; tracks `baselineZoom` (100% toolbar readout); `getBaselineZoom()` exposed on `ViewportApi`.
- **`use-canvas-viewport-framing.ts` (new):** `ResizeObserver` on the layout background host; initial fit in `useLayoutEffect`; re-fit on container resize (toolbar/window/inspector).
- **`floor-plan-canvas.tsx`:** Container + scroll-host split (`scrollHost` prop); removed one-shot-only resize skip; normalized zoom readout via baseline; production host uses `absolute inset-0`.
- **`floor-plan-canvas-wizard_qa.tsx`:** Synced with production fit math; removed conflicting canvas-centre scroll effect; spatial layout uses `scrollHost` + `h-full overflow-auto` (wizard embedded keeps page-scroll QA classes).
- **`floor-plan-v2.tsx` / `floor-plan-v2_wizard_qa.tsx`:** Zoom reset + viewport reset call `fitViewportToContent` (100% = fit with 40px pad); canvas host `flex flex-col min-h-0 h-full`.

## Shipped this session (canvas viewport fit-to-content, superseded by padding/resize pass above, deployed 2026-06-09)
- **`use-layout-viewport.ts`:** `contentFramingBounds`, `fitViewportToContent`, `VIEWPORT_FIT_PADDING` (0.125 → ~75% viewport fill). Replaces hard-coded zoom-1 / canvas-centre resets.
- **`floor-plan-canvas.tsx`:** Framing runs in `useLayoutEffect` before paint; zoom anchor uses active room centroid (not full canvas centre); removed conflicting canvas-dimension scroll centering that fought `fitToBounds`.
- **`use-canvas-workspace.ts` / `floor-plan-v2.tsx`:** `resetCanvasViewport`, `ensurePlaceableDocument`, and Center View fallbacks call `fitViewportToContent` instead of `resetViewport()`.

## Shipped this session (portal route sync, deployed 2026-06-09)
- **Active portal resolution (`lib/portals/active-portal.ts`):** Portal-prefixed routes (`/coordinator/*`, `/vendor/*`) now override the `active_portal` cookie in `resolveActivePortal` so top nav tabs match the URL (Option A sync).
- **Middleware (`lib/supabase/middleware.ts`):** Auto-sets `active_portal` cookie when visiting coordinator or vendor routes the account may access.
- **Coordinator + vendor layouts:** Server-side cookie sync on portal route entry as a belt-and-suspenders guard.
- **Workspace chrome (`portal-workspace-layout.tsx`):** MARKET OPS sidebar / telemetry panels only render when route prefix matches the workspace portal prop.
- **QA:** `lib/portals/qa-active-portal.ts` — 5 assertions for route/cookie precedence.

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
- **Deploy script (`deploy-popuphub.ps1`):** Clears stale `.next/lock` before build — fixes `Another next build process is already running` when dev server left a lock behind.
- **`Deploy-popuphub.bat` version tracking:** Header comment block documents floor-plan release track (object resize, measurements, viewport lock, layout fixes), prod baseline (build 155 / 7db76c6), `BUMP_BUILD_NUMBER=1` init, 5-step pipeline, optional `verify-canvas-state-smoke` / `verify-multi-room-canvas` / `verify-align-and-center` pre-flight.
- **Login QA wired to `/login`:** `app/(auth)/login/login-form.tsx` re-exports `LoginQa` — lockout + logo scale now live on `/login` and embedded signup login panel.
- **Login QA Jurassic Park lockout (`Login_qa.tsx`):** Portal to `document.body` at `z-[9999]`; fullscreen takeover on 3rd Supabase auth failure; `public/assets/nedry_magic_word.mp4` (video+audio, loop) with `public/assets/nedry.gif` fallback; always-mounted preload video primes audio on Sign-in click, then `play()` on lockout (unmuted with muted retry); **build fix:** Turbopack cannot `import` `.mp4` — serve from `/assets/` not module import.
- **Login QA logo scale (`Login_qa.tsx`):** Popup Hub wordmark `<img>` clamped to `w-44 h-auto object-contain mx-auto mb-4` (`/popup-hub-logo.png`).
- **Login QA lockout helpers (`login-lockout_qa.ts`):** Trimmed credentials + client validation; local-only password visibility toggle; strike/cooldown math. Legacy pixel CSS (`login-lockout_qa.css`) unused after video overlay — safe to delete on promotion cleanup.
- **QA dashboard wired:** `market-dashboard-client.tsx` → `DashboardBootstrapQa`; `floor-plan-v2.tsx` → `CanvasCommandBarQa`.
- **AI Theme Wizard (removed):** Former `ai-generation-guardrails_qa.tsx` + OpenRouter path deleted; local merge (`layoutMergeLocal.ts`) retained.
- **Initial loader:** Computed uniform perimeter tables; removed dashed ring; logo fades into geometric ring center (`ringCenterX` / `ringCenterY` in `initial-loader-reveal.tsx`).
- **Branding:** `PopupHubIcon` deprecated → full `popup-hub-brand.png`; sidewalk dash line removed from replay loader.
- **Mobile footer/nav:** `globals.css` scales `.popup-hub-chrome-footer` to **67%** on ≤767px; `shopper-bottom-nav` + main padding `2rem`; install prompt bottom offset aligned.
- **Room modal:** Portaled to `document.body`, `z-[9999]`, body scroll lock while open, `data-testid="initial-room-modal"`.
- **Booth pricing UX:** Focus-aware sync in `market-booth-pricing-fields.tsx`; category fee rows use text + placeholder (`category-limit-editor.tsx`).
- **Canvas draw/select (wizard QA):** `use-canvas-pointer-wizard_qa.ts` — draw-tool hits select/drag existing objects instead of stacking.
- **Patron-first / supplies / instant book:** Already in tree — `/discover` default, `/supplies` Market Supplies, `verify-instant-book-category-limits.ts` 4/4.

## Shipped this session (vendor clearance, deployed 2026-06-09)
- **Vendor auto-arrange spacing:** `BOOTH_PLACEMENT_GAP_FT` restored to **4′** edge-to-edge (2′ safety buffer per side via `BOOTH_SAFETY_BUFFER_FT` / `BOOTH_CORE_SEPARATION_CELLS` in `layout-clearance-constants.ts`). Grid column pitch, row-pack fallback, and deterministic layout `tableEdgeGapFt` all honor the 4′ gap; adjacent vendor tables no longer pack flush.
- **`validateClearances`:** Pair-aware minimum gaps — vendor↔vendor 4′, patron↔patron 2′, vendor↔patron 4′.
- **`patron-centric-layout.ts`:** Local edge clearance synced to 2′ per side.
- **Verify:** `npx tsx scripts/verify-auto-arrange.ts` — 31/31 pass.

## Shipped this session (QA Step 3 Add room clipping fix, deployed 2026-06-09)
- **`qa-scroll-layout_qa.ts` + `Canvas_qa.tsx`:** Added `QA_STEP3_CONTENT_CLASS` (`flex flex-col h-full overflow-y-auto`), `QA_ADD_ROOM_FORM_CLASS` (`relative z-10`); canvas constants use `flex-grow` instead of fixed viewport height.
- **`floor-plan-v2_wizard_qa.tsx`:** Step 3 inner column uses `QA_STEP3_CONTENT_CLASS`; canvas host drops `min-h-[min(480px,50vh)]` trap; `LayoutCanvasWizardQa` gets `flex-grow`.
- **`canvas-command-bar-blocks_qa.tsx`:** Embedded `LayoutRoomBar` (Add room width/length inputs) wrapped in `QA_ADD_ROOM_FORM_CLASS` so it stacks above canvas overlay.
- **`globals.css`:** `.layout-planner-root-qa` overrides unlock `FullscreenLayout` + `.floor-plan-canvas-host` — `overflow-y-auto` on editor shell, `flex-grow` + `overflow: visible` on canvas host (replaces prod `overflow-hidden` / `height: 100%` trap for Step 3).

## Shipped this session (QA global scroll unification, deployed 2026-06-09)
- **`layout-planner-shell_qa.tsx`:** QA wizard Step 3 shell — no `useLayoutCanvasViewportLock`, no nested `overflow-hidden`; content flows at natural height.
- **`qa-scroll-layout_qa.ts`:** Shared `QA_GLOBAL_PAGE_SCROLL`, `QA_CANVAS_VIEWPORT_CLASS`, `QA_CANVAS_CONTAINER_CLASS` — content-sized canvas, no fixed viewport height.
- **`wizard-step-floor-plan_qa.tsx`:** Uses `LayoutPlannerShellQa`; floor plan column is `w-full flex-1` (no `h-full min-h-0` trap).
- **`floor-plan-v2_wizard_qa.tsx`:** Removed nested overflow / `basis-0` / `h-full` on canvas host; wizard canvas is `relative w-full`; inspector panel no longer scrolls internally.
- **`floor-plan-canvas-wizard_qa.tsx` + `floor-plan-canvas_dashboard_qa.tsx`:** Canvas host `overflow-visible h-auto`; wheel without Ctrl passes through to page scroll; Ctrl+wheel zoom unchanged.
- **`Dashboard_qa.tsx`:** Left rail + canvas column no longer fixed to `100vh-64px` or `overflow-y-auto`; shell uses `dashboard-app-shell--qa-global-scroll`.
- **`canvas-command-bar_qa.tsx`:** Sidebar toolbar `overflow-visible` (accordions expand page height).
- **`globals.css`:** `.layout-planner-root-qa` + `.dashboard-app-shell--qa-global-scroll` overrides — `#site-main` and `.setup-wizard-body` are the sole vertical scroll hosts.
- **`events/new/page.tsx` + `market-setup-wizard.tsx`:** Dropped `overflow-hidden` / `min-h-0` traps on Create New Market Step 3 path.

## Shipped this session (wizard Step 1 field layout + Places sync, deployed 2026-06-09)
- **`wizard-ui.tsx`:** `WizardDescriptionField` (static label + counter row below); `WizardLabeledTextarea` for optional multi-line fields; floating inputs/textareas always use `placeholder=" "` (ignore consumer placeholder); textarea uses `field-sizing-fixed`; `--filled` triggers on any non-empty value.
- **`globals.css`:** Textarea floating-label padding increased (`pt-8 pb-3`); textarea label rest/active positions tuned; `:placeholder-shown` rule extended to textarea variant.
- **`wizard-step-event-details.tsx`:** Description → `WizardDescriptionField`; raffle → `WizardLabeledTextarea`.
- **`venue-places-autocomplete.tsx` + `use-google-places-autocomplete-widget.ts` (new, prod):** Google `Autocomplete` widget on both venue name and address; `place_changed` only syncs sibling field + map pin (no typing loops).
- **`wizard-google-place-select.ts` + `wizard-place-types.ts` (new, prod):** Two-way sync — venue pick fills address + pin; address pick fills distinct venue name (via `resolveVenueNameFromAddressPick`) + pin.
- **`wizard-step-venue.tsx`:** Replaced custom address typeahead + plain venue input with dual `VenuePlacesAutocomplete`; removed ~250 lines of duplicate prediction UI.
- **`market-setup-wizard.tsx`:** Wired to production venue step + place-select lib (was QA imports).

## Shipped this session (wizard Step 1 description layout, deployed 2026-06-09)
- **`wizard-ui.tsx`:** New `WizardDescriptionField` — static `WIZARD_FIELD_LABEL` above textarea; character counter + helper copy in a flex row below the input (counter right, helper left).
- **`wizard-step-event-details.tsx`:** Step 1 description uses `WizardDescriptionField` instead of `WizardFloatingTextarea` + nested counter `<p>` (eliminates label/text overlap and counter inside the typing area).

## Shipped this session (QA wizard description layout, deployed 2026-06-09)
- **`wizard-description-field_qa.tsx`:** Replaced floating-label `WizardFloatingTextarea` with static `WIZARD_FIELD_LABEL` + `mb-2` above a fixed-layout textarea (`min-h-[150px]`, `overflow-y-auto`, `resize-y`, `field-sizing-fixed`) so typed copy no longer overlaps the DESCRIPTION label; metrics block unchanged below.

## Shipped this session (QA canvas scroll fix, deployed 2026-06-09)
- **`Canvas_qa.tsx`:** `QA_CANVAS_VIEWPORT_CLASS` updated — `overflow-hidden` → `overflow-y-auto scrollbar-hide` so the main hall viewport accepts wheel scroll while hiding the track.
- **`globals.css`:** Added `.scrollbar-hide` utility (alias of `.scrollbar-none` for WebKit + Firefox).
- **`floor-plan-canvas_dashboard_qa.tsx`:** Inner `[role="application"]` scroll host restored to `overflow-auto` (matches prod `floor-plan-canvas.tsx`); outer wrapper uses updated `QA_CANVAS_VIEWPORT_CLASS` — no `onWheel`/`onScroll` on parent (wheel handled on inner via `use-viewport`).

## Shipped this session (QA absolute overrides, deployed 2026-06-09)
- **`Canvas_qa.tsx`:** Exported `QA_CANVAS_VIEWPORT_CLASS` (`flex-1 h-[calc(100vh-64px)] overflow-hidden relative bg-slate-50`) — structural lock for main hall viewport (superseded by scroll fix above).
- **`floor-plan-canvas_dashboard_qa.tsx`:** Canvas container `overflow-auto` → `overflow-hidden`; outer wrapper uses `QA_CANVAS_VIEWPORT_CLASS` (no right-edge scrollbar; pan/zoom handlers unchanged) — **reverted** inner to `overflow-auto` in scroll fix above.
- **`Dashboard_qa.tsx`:** Center column wrapped in `QA_CANVAS_VIEWPORT_CLASS`; exported `QA_PLACEMENT_TIP_VALID` / `QA_PLACEMENT_TIP_VIOLATION` (`Valid space` / `Rule conflict`); `QA_ACCORDION_HEADERS` + `QaAccordionHeader` h3 typography.
- **`canvas-toolbar-static_qa.tsx`:** Accordion triggers use `QaAccordionHeader` + `QA_ACCORDION_HEADERS` from `Dashboard_qa` (no row icon badges).
- **`canvas-legend_qa.tsx`:** Placement HUD microcopy wired to Dashboard QA tip constants.

## Shipped earlier this session (deployed 2026-06-09)
- **Vendor Supplies:** New `/vendor/supplies` page with Amazon.ca search (associate tag `thetipsyfox08-20`), 15 curated booth/display/packaging picks (all affiliate links), category + local filters, mandatory disclosure. Nav: **Vendor Supplies** in app nav + vendor workspace rail. Shared `lib/affiliate/amazon.ts` (material checklist re-exports). Verify: `npx tsx scripts/verify-vendor-supplies.ts`.

## Shipped this session (QA staging, deployed 2026-06-09)
- **`Dashboard_qa.tsx`:** `QA_PANEL_SCROLL_CLASSES` (`scrollbar-none` + WebKit/MS/Firefox hide); `DashboardLeftPanelQa` portal target is the sole scroll host (`overflow-x-hidden overflow-y-auto`, no visible tracks).
- **`canvas-command-bar_qa.tsx`:** Sidebar layout uses `overflow-hidden` so accordions scroll via portal target only (no nested scrollbars).
- **`tooltip-wrapper_qa.tsx`:** Left-rail anchors always pop right (`translateY(-50%)`, `anchor.right + 8px`); viewport edge clamp; scroll/resize listeners keep portal position in sync.
- **`canvas-toolbar-static_qa.tsx`:** Accordion headers → **ROOM CONTROLS**, **PATRON LAYOUT**, **VENDOR BOOTHS**, **DESIGNER TOOLS** (row icon badges removed; uppercase `h3` titles).
- **`Canvas_qa.tsx` + `floor-plan-canvas_dashboard_qa.tsx`:** Stage `fill="none"` single perimeter; `pointerEvents="all"` + `cursor: move`; `SelectionOverlayQa` skips duplicate dashed outline on selected stages; stage stays visible after merge join.
- **`toolbar-tooltip-copy_qa.ts` + command-bar blocks:** Micro-tooltip copy wired across toolbar/object brushes.
- **Build:** Local `npm run build` passes — **build 142** (uncommitted; `build-number.json` bumped by prebuild).

## Shipped this session (QA staging, deployed 2026-06-09)
- **`toolbar-tooltip-copy_qa.ts`:** Centralized micro-tooltip strings (e.g. `Clear all`, `Auto-arrange`, `Merge rooms`, `Space H`) — replaces long descriptive sentences across command-bar blocks.
- **`tooltip-wrapper_qa.tsx`:** Compact bubble styling (`text-xs px-2 py-1 bg-slate-800 text-white rounded shadow-sm`); narrower width estimate cap (160px).
- **`canvas-toolbar-static_qa.tsx`:** Accordion headers → **ROOM CONTROLS**, **PATRON LAYOUT**, **VENDOR BOOTHS**, **DESIGNER TOOLS** with `text-xs font-bold tracking-wider text-slate-700 uppercase`; chrome tooltips shortened.
- **`canvas-command-bar-blocks_qa.tsx` + `canvas-command-bar_qa.tsx`:** All toolbar/object-brush tooltips wired to micro-copy constants; merge/join hints shortened.

## Shipped this session (QA staging, deployed 2026-06-09)
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
2. **Mobile smoke-test** — `/discover` scroll + reduced footer; `/coordinator/dashboard`: initial room modal (dimensions only), then table size from designer menu
2. **Loader smoke-test** — hard refresh: perimeter booths, centered full logo, no grid/dash lines
3. **Wizard smoke-test** — Step 2 booth fee / discount backspace; category price placeholders
4. **Instant book** — re-run `npx tsx scripts/verify-instant-book-category-limits.ts` after any apply-route edits (currently 4/4)
5. **OpenRouter smoke-test** — set `OPENROUTER_API_KEY` on Vercel; upload flyer on wizard Step 1 → fields populate; API `meta.source` is `openrouter`
6. **Login QA smoke-test** — `/login`: 3 wrong passwords → fullscreen Nedry video (magic-word audio) + 30s lock; confirm `/assets/nedry_magic_word.mp4` loads on prod after deploy; verify trim + toggle do not leak globally
7. **Commit + deploy** when ready (`PM/Deploy-popuphub.bat` or `ship.ps1`); promote `_qa` modules after sign-off

## Goal (prior)
**QA folder staging — dashboard layout optimization & stage merge** — all layout/merge/canvas changes mirrored in `src/qa_review/` for manual testing before production promotion.

## Shipped this session (QA staging, deployed 2026-06-09)
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

## Shipped this session (local, deployed 2026-06-09)
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

## Shipped this session (local, deployed 2026-06-09)
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

## Shipped this session (local, deployed 2026-06-09)
- **Dashboard layout tools in left panel:** Removed **Event overview** back links from command-center header and curation column. Floor-plan `CanvasCommandBar` (static layout) portals into the left rail via `dashboard-toolbar-portal.tsx` on desktop — canvas column is toolbar-free for more layout space. Mobile and **Full canvas** immersive mode keep the ribbon above the canvas. `sidebarLayout` on `canvas-command-bar.tsx` drops the 36vh height cap for vertical scrolling in the rail.
- **Condensed canvas toolbars:** Floor-plan command ribbon, static dashboard rows, venue layout palette, and canvas utility bar are icon-only with `TooltipWrapper` labels. `CommandButton` is square (~1.65rem compact); removed Vendor/Patron/Room section badges and table-size column headers; embedded room bar uses icon **Add room**; reset/reorder chrome tightened. Files: `command-button.tsx`, `canvas-command-bar-blocks.tsx`, `canvas-toolbar-static.tsx`, `canvas-toolbar-reorder.tsx`, `layout-room-bar.tsx`, `table-size-pill.tsx`, `venue-layout-toolbar.tsx`, `canvas-utility-toolbar.tsx`.
- **Gemini → Groq AI fallback:** Flyer vision parse (`lib/flyer/parse-flyer-vision.ts`) tries Gemini first (`GEMINI_API_KEY`, model `google/gemini-2.5-flash` via `FLYER_GEMINI_MODEL_ID` / `GEMINI_MODEL_ID`), then Groq when quota/rate-limit/overload errors occur. Groq key reads `GROQ_API_KEY` or Vercel alias `POPUPHUB_API_KEY`; model defaults to `llama-3.2-90b-vision-preview` (`GROQ_MODEL_ID` optional). Shared helpers in `lib/ai/`. Verify: `npx tsx scripts/verify-ai-provider-fallback.ts`. **Note:** Experience Designer planning sessions still proxy to the external Master Generator backend — that service needs its own Gemini→Groq fallback if theme generation should use this pattern.
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

## Shipped this session (Unified Auto-Arrange + Patron Flow solver, deployed 2026-06-11)
- **`UnifiedLayoutSolver.ts`:** Coupled booth + spine solver — skeleton init (serpentine pathway + no-fly rects) → patron-centric slot seed → coupled force loop (4′ ideal / 2′–3′ / ≤2′ clearance bands + category proximity kernel) → hard projection + minimum-clearance enforcement.
- **Wiring:** `layoutSolver: 'unified'` on `PackBooths` / `autoArrangeVendorUnifiedInRoom`; AI Auto-Arrange (non-grid) tries unified first via `request-ai-auto-arrange.ts` deterministic fallback; traffic-aware pack remains fallback when unified places zero.
- **Overlay:** `UnifiedLayoutFlowOverlay` — emerald spine polyline + clearance-band heat field (`critical`/`tight`/`good`); auto-enabled after unified arrange / AI Auto-Arrange when solver meta present.
- **Verify:** `npx tsx scripts/verify-auto-arrange-engine.ts` — PASS (traffic-aware + unified placement + sparse-room ≥4′ clearance regression).

## Active work — Unified Auto-Arrange + Patron Flow (simultaneous optimization spec)

**Status:** Implemented locally — see shipped section above. Remaining: prod smoke-test on `/coordinator/dashboard` with entry/exit doors → AI Auto-Arrange (Staggered/Perimeter) → spine + heat overlay visible; Toggle Patron Flow still shows legacy aisle/path overlays.

**Existing anchors (do not duplicate):**
- Clearance bands: `lib/coordinator/booth-clearance-visual.ts` (`BOOTH_CLEARANCE_GOOD_FT = 4`, `TIGHT = 3`, `CRITICAL = 2`)
- Category proximity: `category-rules.ts` (`PROXIMITY_MIN_COLUMNS/ROWS` → spatial density kernel)
- Patron spine (v1): `patron-centric-layout.ts` `buildPatronPathway` + `AutoArrangeEngine.ts` `buildTrafficNoFlyRects`
- Modified Loop (grid preset): `lib/booth-planner/modified-loop-layout.ts` + `patron-path-trace.ts`
- Aisle target: `layout-clearance-constants.ts` `VENDOR_BOOTH_AISLE_FT = 3` (engine lifts auto-arrange floor to 4′ ideal via `UNIFIED_IDEAL_CLEARANCE_FT`)

~~**Next implementation steps:**~~
~~1. Add `UnifiedLayoutSolver` module~~ — **done**
~~2. Wire as opt-in mode on AI Auto-Arrange~~ — **done**
~~3. Extend `verify-auto-arrange-engine.ts`~~ — **done**
~~4. Patron Flow Overlay~~ — **done**

**Blockers:** None — prod smoke-test pending.

---

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
| Mobile wizard text fields | **Local** — Step 1 description/raffle static labels; venue+address Places two-way sync; re-test on phone |
| Blank start — only add-room + size fields | **Deployed** — sign-in smoke |
| Deploy / handoff script | **Fixed** — `update-session-handoff.ps1` ASCII punctuation (Windows PS parse error) |

**Manual checklist after sign-in:** `/coordinator/dashboard` — site footer hidden, canvas fills viewport below nav, toolbar buttons respond, curation queue select works; **Back to market** / **+ New market** / **Full canvas** toggle.

## Do not touch
- `booth-planner.tsx` unless asked
- Vendor / shopper / auction flows unless asked

## Blockers
- ~~**Google Maps API key missing on Vercel**~~ — `GOOGLE_MAPS_API_KEY` added (2026-06-09); smoke-test Places + discover map after redeploy.
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
- **AI gateway:** All in-app LLM calls route through **OpenRouter** with task-based model selection in `lib/ai/tasks.ts` (direct Gemini/Groq deprecated)

## Next actions
1. **Google Maps / Places smoke-test** — After prod redeploy with `GOOGLE_MAPS_API_KEY`: `/coordinator/events/new` Step 1 venue+address autocomplete shows predictions + map pin; `/discover` map renders event pins
2. **Notification count smoke-test** — Sign in as user with vendor-only unread → Patron portal: nav badge + `/notifications` subtitle should show caught-up/0; switch to Vendor portal → count and list should agree
3. **Dashboard toolbar-in-sidebar smoke-test** — `/coordinator/dashboard`: layout tools (Room / Patron / Vendor / Canvas) appear in left panel above curation queue; canvas fills full column height; **Full canvas** still shows toolbar strip; mobile shows toolbar above canvas
4. **Room merge smoke-test** — Add two touching rooms, Shift+select both (or park flush), **Merge (2)** → single hall in sidebar, booths stay put, grid shows through stage outline
5. **Room move/resize smoke-test** — Add room → confirm Select tool active, eight dots on perimeter, drag room interior/wall to move, drag corner/edge dot to resize; toolbar W×L readout updates
6. **Passport smoke-test** — `/profile/passport`: image stories without backdrop show brand logo on dark wrapper; video stories show logo poster while loading and in list/carousel thumbnails; click card opens Full Details modal; delete still works without opening modal
7. **Commit + deploy** room merge + stage fill + prior local fixes when ready
8. **Profile smoke-test** — `/profile`: legal name + private phone save to `profiles` only; notification toggles persist; Change Password modal; no org/website fields on profile
9. **Passport smoke-test (public)** — bio + Instagram/Facebook/Website on public `/coordinators/[id]` and `/patrons/[id]`; stories strip still opens story viewer
10. **Coordinator smoke-test** after deploy: manually place patron cluster near vendors → Patron Auto-Arrange should stay inside cluster box or show density toast without wiping tables; vendor auto-arrange should leave patrons fixed
11. **Verify Clear all** on dashboard + wizard Step 3 after sign-in
12. **Food truck draw** after deploy: parking-lot placement outside Main Hall; vendor auto-arrange should treat truck as obstacle
13. **Mobile smoke-test** — coordinator event detail, payment methods, events/new wizard on phone
14. If placement rejected, watch for toast (“Draw inside the room interior”) — click closer to room center after **Add room**
15. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. scaffold Capacitor iOS shell + TestFlight | coordinator smoke-test Step 3 on Spring market]
```
