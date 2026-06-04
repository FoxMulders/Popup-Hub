# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Baseline
- Branch: `master` @ `31b1882` (pushed to `origin/master`)
- Production: https://popup-r72i8nd4q-thetipsyfoxyeg-2911s-projects.vercel.app — **build 95** · commit `e2f60d9` (handoff updated 2026-06-03 19:11)
- **Deploy script:** `PM/Deploy-popuphub.bat` → `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Stashed (not shipped):** `git stash` entry `loader WIP` — brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)

## Last deploy
- 2026-06-03 19:11 - Deploy via deploy-popuphub.ps1 (31b1882)


## Goal
**Canvas interaction lock** — wheel zoom, scroll pan, tool placement, and toolbar brush state must work on Step 3 + command center (`floor-plan-canvas.tsx`, not legacy `designer/Canvas.tsx`).

## Shipped this session (local, uncommitted)
- **Spatial layout remount + reload:** Restored `layoutGeneration` state, `key={layoutGeneration}` on `<FloorPlanV2 />`, and "Reload saved layout" toolbar button. Handler clears multi-room localStorage draft and increments generation for a clean canvas remount (fixes 500de9d regression without dangling props).
- **Canvas input lock fix:** SVG `onWheel` was calling `stopPropagation()`, so zoom/scroll never reached the viewport scroll container when the cursor was over the drawing surface; wheel now uses `onWheelCapture` on the scroll host and the SVG swallow handler was removed. Hand-tool pointer down no longer `preventDefault`s so pan can bubble to the viewport hook. `use-canvas-pointer` reads `toolState` / `panActive` from refs (avoids stale gesture gates). `use-viewport` clears orphaned pan/pinch if the pointer ends outside the canvas.
- **QA mirror:** same wheel/hand fixes in `floor-plan-canvas-wizard_qa.tsx`
- **Add-room placement fix (prior):** `hydrateFloorPlanDoc` + `resolvePlacementRoomId` / `isPointInRoomForObject`; verify with `npx tsx scripts/verify-room-add-placement.ts`

## Prior shipped (prod build 91)
- FF-merge `feature/step-2-fix` → `master`: Step 2 scroll (`setup-wizard-body` + `overflow-y-auto` on setup page; Step 3 keeps `overflow: hidden` via `.layout-planner-root`)
- Layout blank-start + command-center nav on `master` (`3147712` / `59ec24f`)
- `chore: ship build 89` + build **90** on Vercel (`e764f5e`)
- **Footer chrome trim:** single footer row (legal links, logo, copyright + build version); duplicate strip removed in `03a56fb` / `aa20311` — **live on prod** (`c661640` / build 91)
- **Blank room interiors:** no interior tints; presets seed zero `venue_elements` (`03a56fb`)
- **Deploy tooling:** `init-shell-env.ps1` (PATH for Explorer launches); `git-sync.ps1` (`Invoke-NativeCommand` / `Invoke-Git`, stale lock recovery); `Deploy-popuphub.bat` (pwsh when available, any cwd, `--no-pause`)
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
| Booth draw (any size → table footprint) | **Fixed locally** — needs deploy + sign-in |
| Booth select / move / rearrange | **Fixed locally** — needs deploy + sign-in |
| Table size pill drives new draws | **Fixed locally** |
| Rotate room / auto-arrange toolbar | **Wired** — re-test after deploy (blocked on object select before) |
| Step 3 blank canvas (interactive) | **Fixed locally** (wheel/pan/draw) — needs deploy + sign-in |
| Wheel zoom / scroll pan over canvas | **Fixed locally** — SVG stopPropagation removed |
| Step 2 Capacity scroll | **Not run** |

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
1. **Smoke-test** `/coordinator/events/[id]/layout` — verify "Reload saved layout" remounts canvas; zoom/pan/draw after reload
2. **Commit + deploy** spatial remount + canvas input lock + add-room placement
3. **Coordinator smoke-test** — toolbar active states, table size pill, select/move, rotate room on Step 3 + dashboard
4. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. coordinator smoke-test Step 3 on Spring market]
```
