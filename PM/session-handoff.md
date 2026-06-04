# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Baseline
- Branch: `master` @ `eb14c5b` (pushed to `origin/master`)
- Production: https://popup-8gsnahq8j-thetipsyfoxyeg-2911s-projects.vercel.app — **build 99** · commit `4125379` (handoff updated 2026-06-03 20:59)
- **Deploy script:** `PM/Deploy-popuphub.bat` → `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Stashed (not shipped):** `git stash` entry `loader WIP` — brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)

## Last deploy
- 2026-06-03 20:59 - Deploy via deploy-popuphub.ps1 (eb14c5b)


## Goal
**Booth draw commit** — click/drag with Booth (or wall/stage) tool must persist objects inside room polygons on Step 3, standalone layout (`/coordinator/events/[id]/layout`), and command center.

## Shipped this session (local, uncommitted)
- **Table size pill reset fix:** baseline sync `useEffect` depended on whole `store` (identity changes every doc mutation) — reverted pill selection after `patchDoc` on size change. Now `[safeTableSizeFt, store.patchDoc]` in `floor-plan-v2.tsx` + QA mirrors.
- **Table size → draw footprint:** QA canvas used `safeTableSizeFt` (wizard prop) instead of `defaultPlacementSizeFt` (local pill state) for `defaultBoothTableLengthFt` and auto-arrange — new draws ignored pill until Step 2 baseline changed.
- **QA placement room resolve:** `use-canvas-pointer-wizard_qa` uses `resolvePlacementRoomId` + `isPointInRoomForObject` when rooms exist (matches production); keeps open-canvas path for blank start.
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
| Booth draw click-to-place | **Fixed locally** — `draftRef` + QA `useLayoutEffect` room sync; needs deploy + sign-in |
| Booth select / move / rearrange | **Fixed locally** — needs deploy + sign-in |
| Table size pill drives new draws | **Fixed locally** — store-dep reset + QA `defaultPlacementSizeFt` wiring |
| Booth placement inside room | **Fixed locally** — QA `resolvePlacementRoomId` parity; needs deploy + sign-in |
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
1. **Deploy** table-size + placement fixes; smoke-test pill → draw footprint + booth/wall/stage inside room on Step 3 + `/coordinator/events/[id]/layout` + dashboard
2. If placement still rejected, watch for toast (“Draw inside the room interior”) — click closer to room center after **Add room**
3. **Coordinator smoke-test** — select/move, table size pill, rotate room, zoom/pan
4. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. coordinator smoke-test Step 3 on Spring market]
```
