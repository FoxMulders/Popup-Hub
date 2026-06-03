# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Run `.\scripts\update-session-handoff.ps1` after deploys. Do not leave handoff stale.

## Baseline
- Branch: `master` @ `aa20311` (pushed to `origin/master`)
- Production: https://popuphub.ca — **build 89** · commit `5f978e1` (handoff updated 2026-06-03 15:57)
- **Deploy script:** `PM/Deploy-popuphub.bat` → `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)
- **Stashed (not shipped):** `git stash` entry `loader WIP` — brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)

## Last deploy
- 2026-06-03 15:57 - tooling test (aa20311)

## Goal
**Redesign layout surfaces with zero preassigned objects** — open grid only; coordinators add rooms and fixtures manually. Restore reliable exit navigation from wizard Step 3, command center, and `/coordinator/events/[id]/layout`.

## Shipped this session
- FF-merge `feature/step-2-fix` → `master`: Step 2 scroll (`setup-wizard-body` + `overflow-y-auto` on setup page; Step 3 keeps `overflow: hidden` via `.layout-planner-root`)
- Layout blank-start + command-center nav on `master` (`3147712` / `59ec24f`)
- `chore: ship build 89` + build **90** on Vercel (`e764f5e`)
- **Footer chrome trim:** single footer row (legal links, logo, copyright + build version); duplicate strip removed in `03a56fb` / `aa20311` — **needs prod deploy**
- **Blank room interiors:** no interior tints; presets seed zero `venue_elements` (`03a56fb`)
- **Deploy tooling:** `init-shell-env.ps1` (PATH for Explorer launches), `git-sync.ps1`, `deploy-popuphub.ps1`, `update-session-handoff.ps1`; `Deploy-popuphub.bat` uses delayed expansion, repo validation, deploy lock, race-safe push

## Active work — Layout blank start + navigation

### Root causes addressed
1. **`roomsFromBoothLayout(null)`** → `roomsFromBoothLayoutForEditor`
2. **`layoutHasPlacedGeometry`** → `layoutHasDrawableGeometry` (cells only)
3. **localStorage multi-room draft** — cleared when no drawable geometry / empty `layoutRooms`
4. **Delete last room** — allowed in wizard + standalone layout
5. **Fullscreen CSS** — stripped on route change + command-center mount
6. **Command center** — exit/new-market as `Link` + `buttonVariants`

### Wizard Step 3 QA wiring
- `floor-plan-v2_wizard_qa.tsx` via `WizardStepFloorPlan`
- Hydration: `layout-hydration-wizard_qa.ts` + `roomsFromBoothLayoutForEditor`

## Smoke-test status (2026-06-03)
| Check | Result |
|-------|--------|
| Prod build / alias | **Stale** — prod still on build 90 / `e764f5e`; local `aa20311` not deployed |
| Step 3 blank canvas (interactive) | **Blocked** — coordinator login |
| Step 2 Capacity scroll | **Not run** |
| Command center nav | **Not run** |
| Saved markets with booth cells | **Not run** |

**Manual checklist after sign-in:** Command center **Back to market** / **+ New market** / site nav; wizard Step 3 empty grid (**Clear all** if stale draft); layout page same rules; event with saved **cells** hydrates booths.

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
1. **Run deploy** — `PM\Deploy-popuphub.bat` or `.\scripts\deploy-popuphub.ps1` to ship `aa20311`+ to https://popuphub.ca
2. **Coordinator smoke-test** — Step 2 scroll, Step 3 blank start, command center exit links, cell hydration
3. **Pop stash** for brand loader: `git stash list` → apply on `feature/step-2-fix` or new branch
4. Step 1 QA promotion per patch docs when layout sign-off is done

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. coordinator smoke-test Step 3 on Spring market]
```
