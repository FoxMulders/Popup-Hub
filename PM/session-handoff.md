# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Baseline
- Branch: `master` @ `54e1c56` (pushed to `origin/master`)
- Last deploy commit: `54e1c56` - feat: floor-plan object resize, measurements, viewport lock, and layout fixes
- Production: https://popuphub.ca - **build 118** | commit `28d0de9` (handoff updated 2026-06-05 10:10)
- **Deploy script:** `PM/Deploy-popuphub.bat` [commit message] -> `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Stashed (not shipped):** `git stash` entry `loader WIP` - brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)


## Last deploy
- 2026-06-05 10:10 - Deploy via deploy-popuphub.ps1 - `feat: floor-plan object resize, measurements, viewport lock, and layout fixes` (54e1c56)


## Goal
**Coordinator smoke-test on prod** — verify layout fixes shipped in build **106** (`cde554e` @ https://popuphub.ca). Auto-arrange keeps vendor booths and patron tables on **separate passes** (see **Vendor placements** / **Patron placements** below). Verify vendor-only and patron-only behavior with `npx tsx scripts/verify-auto-arrange.ts` (guest-table section today; extend when patron mode parity ships).

**Fixed (local):** Vendor auto-arrange no longer **deletes** booths when obstacles / space restrictions block some deterministic slots — scans all valid grid slots, fallback row-pack, keeps unmoved booths at their prior position when reposition fails (toast: “left in place”). `lib/floor-plan/deterministic-market-layout.ts` + `engine/auto-arrange.ts`.

## Vendor placements

Vendor booths are rectangular sellable units (`tablePurpose: 'vendor'`). They drive venue capacity, hall baseline, category proximity, and multi-table consolidation.

| Aspect | Detail |
|--------|--------|
| **Draw** | Toolbar **Booth**; Table size pill **Booth** column (vendor rectangular, hall baseline length) |
| **Canvas** | Solid booth rectangle; included in booth matrix / placement status / telemetry |
| **Consolidation** | Multi-table vendors collapse to one footprint before arrange (`consolidateBoothsForAutoArrange`) |
| **Auto-arrange scope** | **Vendor booths only** — patron/guest tables are never moved or merged in this pass |
| **Auto-arrange modes** | **Grid** — aligned rows/columns, 8′ aisles, entrance-first row order · **Staggered** — alternating half-width row offset for sightlines · **Perimeter** — boundary loop (top → right → bottom → left) |
| **Engine** | `autoArrangeVendorBooths` in `components/coordinator/floor-plan-v2/engine/auto-arrange.ts`; layout modes via `lib/floor-plan/deterministic-market-layout.ts` |
| **Toolbar** | **Vendor** ribbon block: **Booth** draw + Booth size pill + mode select (Grid / Staggered / Perimeter) + **Auto-Arrange**; enabled when ≥1 vendor booth in active room |
| **Shipped** | Dedicated vendor toolbar block (`vendor` in `toolbar-order.ts` / `canvas-command-bar-blocks.tsx`); `scope: 'vendor'` in `auto-arrange.ts` |
| **Verify** | `npx tsx scripts/verify-auto-arrange.ts` — grid, staggered, perimeter, multi-room, category proximity |

## Patron placements

Patron (guest) seating tables are non-vendor fixtures (`tablePurpose: 'guest'`). Round and rectangular banquet sizes; they do **not** change venue capacity or hall baseline.

| Aspect | Detail |
|--------|--------|
| **Draw** | Toolbar **Patron round** / **Patron rect**; Table size pill **Round** or **Patron** columns (5′ / 6′ / 8′) |
| **Canvas** | Round = ellipse; rect = dashed rectangle; excluded from vendor “Unassigned” styling and booth matrix vendor counts |
| **Consolidation** | None — each table keeps its laid footprint (round tables stay circular) |
| **Auto-arrange scope** | **Patron tables only** — vendor booths are obstacles/fixed context, not rearranged in this pass |
| **Auto-arrange modes (target)** | Same three options as vendor: **Grid**, **Staggered**, **Perimeter** — applied only to guest/patron units, respecting vendor footprints and structural obstacles |
| **Engine (shipped)** | `arrangeGuestTables` in `auto-arrange.ts` — row-pack near prior placement / open space away from vendors (no mode selector yet) |
| **Engine (target)** | Patron-only pass mirroring vendor mode API (`grid` / `staggered` / `perimeter-only`); reuse deterministic layout where footprints are uniform, custom pack/orient for mixed round+rect sizes |
| **Toolbar** | **Patron** ribbon block: **Patron round** / **Patron rect** + Round/Patron size pill + mode select + **Auto-Arrange**; enabled when ≥1 patron table in active room — independent of vendor mode state |
| **Shipped** | Dedicated patron toolbar block; `scope: 'patron'` keeps vendor booths fixed while `arrangeGuestTables` runs (`isGuestTableBooth` in `lib/booth-planner/table-shape.ts`) |
| **Verify** | Guest-table block in `scripts/verify-auto-arrange.ts` (4/4 pass); add grid/staggered/perimeter patron cases when mode parity lands |

## Shipped this session (local, not deployed)
- **Mobile page scroll fix:** Coordinator/vendor workspace pages (`CommandCenterShell`, `DashboardAppShell`) hide left/right rails below `lg` so the center column fills the viewport and scrolls. `events/new` and setup wizard bodies use the same scroll shell. Fixes clipped main body on phones.
- **Mobile wizard field overlap fix:** Floating inputs/textareas use `min-h-14` / `!h-auto` instead of fixed `h-11` so labels and entered text no longer collide.
- **Brand logo refresh:** Replaced master `public/popup-hub-logo.png` with the official forest-green storefront lockup (994x1024). Ran `npm run assets:logo` to regenerate `popup-hub-brand.png`, `popup-hub-icon.png`, `logo.png`, favicons, PWA icons, and `app/icon.png` / `apple-icon.png`. Fixed `scripts/process-logo.mjs` atomic writes on Windows. Updated nav/footer/auth logo dimensions (`popup-hub-logo.tsx`), loader pin offset (`loader-variants/shared.ts`), animation wordmark/stroke colors to `#2d5a27` (`popup-loader-scene.tsx`, `initial-loader-reveal.tsx`), PWA `theme_color`, and service-worker cache `v11`.
- **CI lint fix:** `prefer-const` on `rowStartX` in `auto-arrange.ts` — GitHub CI `npm run lint` was failing (1 error, 359 warnings). Local lint now exits 0. Booths were dropped from the doc when deterministic slots overlapped obstacles or failed the 2′ edge rule, even with open floor left. Layout now walks **all** valid slot candidates (not just the first N), perimeter slots respect restricted zones, column pitch includes the 2′ edge gap, and a fallback grid scan runs before giving up. Unplaced vendor booths **stay on canvas** at their last valid position (not removed); toast says “left in place”. Verify: `npx tsx scripts/verify-auto-arrange.ts` (15-booth wall case + main grid cases).
- **Food truck placement (canvas-open):** New `food_truck` fixture kind and toolbar **Food truck** draw tool. Trucks may sit anywhere inside the advisory canvas bounds, including parking areas outside room polygons (no room owner / no perimeter touch required). Inside a room, centroid still resolves `objectRoom` for save bridge. Legacy round-trip via `custom_label` + `FOODTRUCK@` sentinel. `lib/floor-plan/canvas-open-placement.ts`, `is-point-in-room.ts`, `use-canvas-pointer.ts`, canvas render + QA pointer. Verify: `npx tsx scripts/verify-food-truck-placement.ts`.
- **Viewport zoom/pan flicker fix:** `frameActiveRoom` depended on the `viewport` API object, which is recreated every render (including each zoom tick). That re-ran `fitToBounds` continuously — zoom buttons flickered and scroll snapped back to the room center. Framing now reads `viewportRef` and only runs when `viewportFramingKey` / `roomsFramingKey` changes (room switch, resize, merged zone). `floor-plan-canvas.tsx` + QA mirror.
- **Clear all crash fix:** `useCanvasStore` memoizes its return value so dashboard `onStoreReady` / `registerFloorPlanStore` no longer run every render (max-update-depth / page crash after Clear all). Wizard QA `handleClearAll` clears parent `layoutRooms` and suppresses auto Main Hall (parity with production). `use-canvas-store.ts`, `floor-plan-v2_wizard_qa.tsx`.
- **Patron tables: no vendor “Unassigned” styling; draw stays patron:** Guest/patron seating is excluded from dashboard booth placement status (canvas fill, booth matrix a11y table, telemetry booth counts). Resizing a selected patron table via the Round/Patron pill now syncs the next-draw template so a follow-up placement does not fall back to a vendor booth. `floor-plan-v2.tsx`, `market-management-context.tsx`, `canvas-objects.tsx`, `booth-matrix-a11y-table.tsx`. Verify: `npx tsx scripts/verify-canvas-state-smoke.ts`.
- **Table size / draw mode: last placed table stays put:** New draws auto-select the booth; switching Patron round ↔ Booth (vendor) or Round ↔ Booth pill columns was reshaping the selection via `planTableSizeChange`. Now patches apply only when purpose+shape match the selection; cross-category changes update the next-draw template and clear selection. Draw-toolbar buttons use `templateOnly`. `table-size-selection.ts` + `floor-plan-v2.tsx` / wizard QA. Verify: `npx tsx scripts/verify-canvas-state-smoke.ts`.
- **Auto-arrange: separate vendor vs patron passes:** Vendor booths use grid/staggered/perimeter (`autoArrangeVendorBooths`). Patron tables run a second pass (`arrangeGuestTables`) — excluded from vendor consolidation and the vendor grid; row-pack near draw origin or open space away from vendors, preserving laid width/height (round stays circular). `AutoArrangeScope` (`vendor` / `patron` / `all`) in `auto-arrange.ts`.
- **Toolbar split: Vendor / Patron / Room:** Canvas ribbon reorganized into three labeled blocks — **Vendor** (Booth + booth sizes + vendor auto-arrange), **Patron** (round/rect + Round/Patron sizes + patron auto-arrange), **Room** (tabs, rotate, merge/unjoin). Canvas tools (select/hand, walls, doors, label, delete) stay in **primitives**; history, align, zoom, save in other blocks. `TableSizePill` accepts `sections: 'vendor' | 'patron'`. Legacy toolbar block ids migrate on load (`toolbar-order.ts`). QA mirrors updated.

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
- **Guest seating tables (not vendor booths):** `tablePurpose: 'vendor' | 'guest'` on booths. Step 3 **Table size** pill has three groups — **Booth** (vendor rectangular, hall baseline), **Round** (5′/6′/8′ guest), **Rect** (5′/6′/8′ guest banquet, 2.5′ depth). Guest tables do not change venue capacity or hall baseline. Canvas: round = ellipse; guest rect = dashed rectangle; vendor = solid booth rect.
- **Round table options (5′ / 6′ / 8′):** `lib/booth-planner/table-shape.ts` — guest round diameters, footprint math, `tableShape` + `tablePurpose` on booths. Verification: `npx tsx scripts/verify-round-table-options.ts`.
- **Round / patron table draw tools:** Toolbar has **Patron round** and **Patron rect** (alongside **Booth**) — each atomically sets placement spec and draw mode. Table size pill **Patron** column (5′/6′/8′ banquet) also auto-switches to draw. Patron tables skip vendor category seeding and proximity rules so multiple tables can be placed near each other.
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
| Patron rect table 5′ / 6′ / 8′ pill + canvas | **Deployed** — sign-in smoke |
| Booth placement inside room | **Deployed** — sign-in smoke |
| Vendor auto-arrange (Grid / Staggered / Perimeter) | **Local** — vendor toolbar block + `scope: 'vendor'`; re-test after deploy |
| Patron auto-arrange (separate pass) | **Local** — patron toolbar block + `scope: 'patron'`; mode selector UI shipped; engine still row-pack (Grid/Staggered/Perimeter parity pending) |
| Toolbar Vendor / Patron / Room blocks | **Local** — sign-in smoke after deploy |
| Rotate room toolbar | **Deployed** — sign-in smoke |
| Step 3 blank canvas (interactive) | **Deployed** — sign-in smoke |
| Wheel zoom / scroll pan over canvas | **Deployed** — sign-in smoke |
| Stage draw outside room (join) | **Deployed** — verify-asset-type-joins + sign-in |
| Step 2 Capacity scroll | **Local** — setup-wizard-body scroll + mobile workspace center scroll; manual check on phone |
| Mobile workspace page scroll | **Local** — side rails hidden below lg; center column scrolls |
| Mobile wizard text fields | **Local** — floating label/input overlap fixed |
| Blank start — only add-room + size fields | **Deployed** — sign-in smoke |
| Deploy / handoff script | **Fixed** — `update-session-handoff.ps1` ASCII punctuation (Windows PS parse error) |

**Manual checklist after sign-in:** `/coordinator/dashboard` — site footer hidden, canvas fills viewport below nav, toolbar buttons respond, curation queue select works; **Back to market** / **+ New market** / **Full canvas** toggle.

## Do not touch
- `booth-planner.tsx` unless asked
- Vendor / shopper / auction flows unless asked

## Blockers
- Interactive coordinator smoke-test requires user credentials
- Markets with **only** `venue_elements` and no cells open **blank** by design

## Decisions
- **Drawable geometry = booth `cells` only**
- **Zero rooms by default** until user adds a room or saved booth cells exist
- **Room interiors are blank** — perimeter walls + labels only
- **Vendor vs patron auto-arrange are independent** — each pass moves only its placement type; neither pass may reposition the other category
- **Shared mode vocabulary** — both vendor and patron auto-arrange expose **Grid**, **Staggered**, and **Perimeter** (same semantics as `AutoArrangeMode` / `deterministic-market-layout.ts`)
- **Handoff:** always update `PM/session-handoff.md` when finishing a task; run `update-session-handoff.ps1` or deploy/ship scripts to refresh baseline automatically

## Next actions
1. **Commit + deploy** auto-arrange space-restriction fix + food truck / viewport / Clear all WIP when ready
2. **Verify Clear all** on dashboard + wizard Step 3 after sign-in (blank canvas, no crash, toolbar shows Add room only)
3. **Patron auto-arrange mode parity** — patron toolbar mode select is wired; engine still ignores mode (row-pack). Implement Grid / Staggered / Perimeter for patron-only pass (`arrangeGuestTables` or patron-centric layout).
4. **Food truck draw** after deploy: parking-lot placement outside Main Hall; vendor auto-arrange should treat truck as obstacle
5. **Coordinator smoke-test** after deploy: Vendor block auto-arrange (each mode) moves only booths; Patron block auto-arrange moves only guest tables; Room block merge/rotate; mixed layout with round + rect patron tables
6. **Mobile smoke-test** — coordinator event detail, payment methods, events/new wizard on phone: page body scrolls; floating fields do not overlap when typing
7. If placement rejected, watch for toast (“Draw inside the room interior”) — click closer to room center after **Add room** (food trucks use canvas bounds only)
8. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch
9. Commit handoff + script fix when ready (`update-session-handoff.ps1`, `deploy-popuphub.ps1`, `PM/session-handoff.md`)

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. coordinator smoke-test Step 3 on Spring market]
```
