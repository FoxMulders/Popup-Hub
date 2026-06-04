# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Baseline
- Branch: `master` @ `a2e5286` (pushed to `origin/master`)
- Production: https://popup-7styr08ee-thetipsyfoxyeg-2911s-projects.vercel.app — **build 101** · commit `03d5bf1` (handoff updated 2026-06-04 07:59)
- **Deploy script:** `PM/Deploy-popuphub.bat` [commit message] → `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff + commit message in baseline)
- **Stashed (not shipped):** `git stash` entry `loader WIP` — brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)

## Last deploy
- 2026-06-04 07:59 - Deploy via deploy-popuphub.ps1 (a2e5286)


## Goal
**Booth/table select metrics + resize** — clicking a booth or table shows its measurements and supports canvas resize handles (alongside table-size pill and inspector).

## Shipped this session (local, uncommitted)
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

## Smoke-test status (2026-06-03)
| Check | Result |
|-------|--------|
| Prod build / alias | **OK** — build 92 / `d382293` at https://popuphub.ca |
| Command center layout (footer / viewport) | **Shipped** build 92 — re-verify after booth fix deploy |
| Add room → draw booth inside room | **Fixed locally** — `verify-room-add-placement.ts`; needs deploy + sign-in |
| Booth draw click-to-place | **Fixed locally** — `draftRef` + QA `useLayoutEffect` room sync; needs deploy + sign-in |
| Booth select / move / rearrange | **Fixed locally** (QA room-drag order + cluster hit-test) — needs deploy + sign-in |
| Booth/table select → measurements + resize handles | **Fixed locally** — on-canvas label + toolbar pill + drag handles; needs deploy + sign-in |
| Table size pill drives new draws | **Fixed locally** — store-dep reset + QA `defaultPlacementSpec` wiring |
| Round table 5′ / 6′ / 8′ pill + canvas | **Fixed locally** — Patron round draw tool + pill auto-draw; needs deploy + sign-in |
| Patron rect table 5′ / 6′ / 8′ pill + canvas | **Fixed locally** — Patron rect draw tool, no vendor proximity block; needs deploy + sign-in |
| Booth placement inside room | **Fixed locally** — QA `resolvePlacementRoomId` parity; needs deploy + sign-in |
| Rotate room / auto-arrange toolbar | **Wired** — re-test after deploy (blocked on object select before) |
| Step 3 blank canvas (interactive) | **Fixed locally** (wheel/pan/draw) — needs deploy + sign-in |
| Wheel zoom / scroll pan over canvas | **Fixed locally** — ResizeObserver reframe + roomsFramingKey origin leak |
| Stage draw outside room (join) | **Fixed locally** — joinable touch placement; verify-asset-type-joins |
| Step 2 Capacity scroll | **Not run** |
| Blank start — only add-room + size fields | **Fixed locally** — needs deploy + sign-in |

**Manual checklist after sign-in:** `/coordinator/dashboard` — site footer hidden, canvas fills viewport below nav, toolbar buttons respond, curation queue select works; **Back to market** / **+ New market** / **Full canvas** toggle.

## Do not touch
- `booth-planner.tsx`, production `floor-plan-v2.tsx` until QA promotion
- Vendor / shopper / auction flows unless asked

## Blockers
- Interactive coordinator smoke-test requires user credentials
- Markets with **only** `venue_elements` and no cells open **blank** by design

## Decisions
- **Drawable geometry = booth `cells` only**
- **Zero rooms by default** until user adds a room or saved booth cells exist
- **Room interiors are blank** — perimeter walls + labels only
- **Handoff:** always update `PM/session-handoff.md` when finishing a task; run `update-session-handoff.ps1` or deploy/ship scripts to refresh baseline automatically

## Next actions
1. **Deploy** object resize + measurement chrome; smoke-test select booth/table → see W×H label, drag corner handle, table-size pill stays in sync
2. **Deploy** viewport + stage-placement fixes; smoke-test wheel pan/zoom (pan away from room, zoom in/out, drag room — camera should stay put) and stage flush against room edge → **Join**
2. **Deploy** round-table + table-size + placement fixes; smoke-test pill → draw footprint (rect + round) + booth/wall inside room on Step 3 + `/coordinator/events/[id]/layout` + dashboard
2. Blank start: set room W×L in toolbar, **Add room**, then draw booths — full toolbar returns after first room
3. If placement still rejected, watch for toast (“Draw inside the room interior”) — click closer to room center after **Add room**
4. **Coordinator smoke-test** — select/move, table size pill, rotate room, zoom/pan
5. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. coordinator smoke-test Step 3 on Spring market]
```
