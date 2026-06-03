# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Baseline
- Branch: `master` @ `c661640` (pushed to `origin/master`)
- Production: https://popuphub.ca — **build 91** · commit `c661640` (handoff updated 2026-06-03 16:12)
- **Deploy script:** `PM/Deploy-popuphub.bat` → `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Uncommitted local:** deploy stderr fix (`Invoke-NativeCommand`, Vercel pipeline, stale lock, pwsh preference)
- **Stashed (not shipped):** `git stash` entry `loader WIP` — brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)

## Last deploy
- 2026-06-03 16:12 - Deploy script stderr fix; prod deploy c661640 build 91 (c661640)


## Goal
**Coordinator command center layout fix** — stop the runaway panel above the site footer from blocking the booth designer viewport; restore canvas/toolbar interactivity on `/coordinator/dashboard`.

## Shipped this session (local, uncommitted)
- **Command center layout regression fix:** `useCoordinatorRouteChromeCleanup` no longer clears `data-dashboard-command-center` on the dashboard route (was racing with `CommandCenterFullscreenProvider` and leaving site footer + broken flex height chain visible)
- **CSS fallback:** `body:has(.coordinator-dashboard-workspace)` mirrors command-center viewport constraints so footer hides and flex chain holds even if the body data attr is stale
- **Canvas column:** replaced `absolute inset-0` mount with flex `flex-1 overflow-hidden` in `dashboard-canvas-column.tsx`

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
| Prod build / alias | **OK** — build 91 / `c661640` at https://popuphub.ca |
| Command center layout (footer / viewport) | **Fixed locally** — needs deploy + coordinator sign-in |
| Step 3 blank canvas (interactive) | **Blocked** — coordinator login |
| Step 2 Capacity scroll | **Not run** |
| Command center nav | **Not run** |
| Saved markets with booth cells | **Not run** |

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
1. **Commit + deploy command center layout fix** (this session's changes)
2. **Coordinator smoke-test** — dashboard viewport, toolbar/canvas interactivity, Step 2 scroll, Step 3 blank start, exit links
3. **Commit deploy fix** — `Invoke-NativeCommand` in `git-sync.ps1` if not bundled with layout fix
4. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch
5. Step 1 QA promotion per patch docs when layout sign-off is done

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. coordinator smoke-test Step 3 on Spring market]
```
