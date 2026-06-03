# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Do not leave handoff stale.

## Baseline
- Branch: `master` @ `e764f5e` (pushed to `origin/master`)
- Production: https://popuphub.ca — **build 90** · commit `e764f5e` (footer + `/version` confirmed 2026-06-03)
- Deploy: https://popup-gurygz96z-thetipsyfoxyeg-2911s-projects.vercel.app (aliased popuphub.ca)
- **Stashed (not shipped):** `git stash` entry `loader WIP` — brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix`
- Local `build-number.json` may show **89** until next local `npm run build`; Vercel prebuild bumped to **90** on deploy

## Goal
**Redesign layout surfaces with zero preassigned objects** — open grid only; coordinators add rooms and fixtures manually. Restore reliable exit navigation from wizard Step 3, command center, and `/coordinator/events/[id]/layout`.

## Shipped this session
- FF-merge `feature/step-2-fix` → `master`: Step 2 scroll (`setup-wizard-body` + `overflow-y-auto` on setup page; Step 3 keeps `overflow: hidden` via `.layout-planner-root`)
- Layout blank-start + command-center nav already on `master` from `3147712` / `59ec24f`
- `chore: ship build 89` commit + push + `npx vercel deploy --prod --yes`
- **Footer chrome trim:** removed duplicate `BuildVersionStrip` above the footer; kept single footer row with legal links, logo, and copyright + build version
- **Blank room interiors:** removed interior tints from `room-frames` / `room-drop-zones`; all room presets seed zero `venue_elements`

## Active work — Layout blank start + navigation (on prod)

### Root causes addressed
1. **`roomsFromBoothLayout(null)`** seeded default Main Hall — replaced by `roomsFromBoothLayoutForEditor`
2. **`layoutHasPlacedGeometry`** — now `layoutHasDrawableGeometry` (cells only)
3. **localStorage multi-room draft** — cleared when no drawable geometry / empty `layoutRooms`
4. **Delete last room** — allowed in wizard + standalone layout
5. **Fullscreen CSS** — stripped on route change + command-center mount
6. **Command center** — exit/new-market as `Link` + `buttonVariants`; dashboard decoupled from viewport-swallowing fullscreen

### Wizard Step 3 QA wiring
- `floor-plan-v2_wizard_qa.tsx` via `WizardStepFloorPlan`
- Hydration: `layout-hydration-wizard_qa.ts` + `roomsFromBoothLayoutForEditor`

## Smoke-test status (2026-06-03)
| Check | Result |
|-------|--------|
| Prod build / alias | **Pass** — login footer `v0.1.90 · build 90 · e764f5e`, `/version` JSON matches |
| Step 3 blank canvas (interactive) | **Blocked** — needs coordinator login; verify on a draft event with `?step=3` |
| Step 2 Capacity scroll | **Not run** — same auth blocker |
| Command center nav | **Not run** — same auth blocker |
| Saved markets with booth cells | **Not run** — post-login checklist |

**Manual checklist after sign-in:** Command center **Back to market** / **+ New market** / site nav; wizard Step 3 empty grid (use **Clear all** if stale local draft); layout page same rules; event with saved **cells** still hydrates booths.

## Do not touch
- `booth-planner.tsx`, production `floor-plan-v2.tsx` until QA promotion
- Vendor / shopper / auction flows unless asked

## Blockers
- Interactive coordinator smoke-test requires user credentials (no prod mock-login)
- Markets with **only** `venue_elements` and no cells open **blank** by design

## Decisions
- **Drawable geometry = booth `cells` only**
- **Zero rooms by default** until user adds a room or saved booth cells exist
- **Room interiors are blank** — perimeter walls + labels only; no interior fill tint; presets never seed fixtures
- **Handoff:** always update this file when finishing a task

## Next actions
1. **Coordinator smoke-test** — Step 2 scroll, Step 3 blank start, command center exit links, cell hydration on a real market
2. **Pop stash** if resuming brand loader work: `git stash list` → apply on `feature/step-2-fix` or new branch
3. Step 1 QA promotion per patch docs when layout sign-off is done

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. coordinator smoke-test Step 3 on Spring market]
```
