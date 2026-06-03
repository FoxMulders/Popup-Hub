# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Do not leave handoff stale.

## Baseline
- Branch: `master` (last pushed `5ce02ef`)
- Production: https://popuphub.ca (build **84**) — **does not include fixes below until commit + deploy**
- **Local WIP (uncommitted):** blank layout start (no preassigned rooms/fixtures), delete-last-room, nav/chrome cleanup, layout editor restored

## Goal
**Redesign layout surfaces with zero preassigned objects** — open grid only; coordinators add rooms and fixtures manually. Restore reliable exit navigation from wizard Step 3 and `/coordinator/events/[id]/layout`.

## Active work — Layout blank start + navigation

### Root causes addressed (WIP)
1. **`roomsFromBoothLayout(null)`** seeded a default Main Hall (50×50) into wizard/layout sidebar state.
2. **`layoutHasPlacedGeometry`** treated `venue_elements` (entrance/exit fixtures) as “saved geometry,” hydrating Door · IN / EXIT onto the canvas from metadata-only saves.
3. **localStorage multi-room draft** could restore stale room + doors even when sidebar rooms were empty.
4. **`handleDeleteRoom`** blocked deleting the last room (“At least one room is required”).
5. **Canvas fullscreen CSS** (`popup-hub-canvas-fullscreen`, `command-center-canvas-fullscreen`) could persist after leaving the editor and hide `#site-app-nav`.

### Fixes (WIP files)
| Area | Change |
|------|--------|
| `lib/booth-planner/layout-rooms.ts` | `layoutHasDrawableGeometry` (cells only); `roomsFromBoothLayoutForEditor` (empty unless booths saved); `getActiveRoom` safe when no rooms |
| `src/qa_review/lib/floor-plan/layout-hydration-wizard_qa.ts` | No draft restore when `layoutRooms` empty; hydration uses cells-only rule |
| `market-setup-wizard.tsx` | `roomsFromBoothLayoutForEditor`; delete last room allowed |
| `use-spatial-layout-state.ts` | Same empty start + delete last room on standalone layout |
| `floor-plan-v2_wizard_qa.tsx` | Reset canvas when `layoutRooms` becomes `[]` |
| `spatial-layout-editor_qa.tsx` | Floor plan re-wired (not empty shell) |
| `use-coordinator-route-chrome-cleanup.ts` + `portal-site-chrome.tsx` | Strip fullscreen classes on every route change |
| `layout-planner-header.tsx` | Wizard: **Event overview** link beside Back |
| `spatial-layout-toolbar.tsx` | **Event overview** link with higher z-index |
| Nav (prior WIP) | `coordinatorNavBackHref`, immersive routes for setup/new/layout |

### Wizard Step 1 & 3 QA (unchanged wiring)
- Step 3 still uses `floor-plan-v2_wizard_qa.tsx` via `WizardStepFloorPlan`
- Step 1 venue Places autocomplete wired; event details QA not promoted

## Files in scope (QA tree)
| Entry | Notes |
|-------|--------|
| `market-setup-wizard.tsx` | `roomsFromBoothLayoutForEditor` |
| `spatial-layout-editor_qa.tsx` | Standalone layout page |
| `layout-hydration-wizard_qa.ts` | Blank + draft rules |
| `floor-plan-v2_wizard_qa.tsx` | Empty-room canvas reset |

## Do not touch
- `booth-planner.tsx`, production `floor-plan-v2.tsx` until QA promotion
- Vendor / shopper / auction flows unless asked

## Blockers
- **Production** still on build 84 until WIP is committed and deployed
- Markets with **only** saved `venue_elements` (doors) and no cells will now open **blank** — coordinators re-draw; intentional for redesign

## Decisions
- **Drawable geometry = booth `cells` only** — not `venue_elements`, not `layout_rooms` metadata alone
- **Zero rooms by default** on wizard Step 3 and layout editor until user adds a room or has saved booth cells
- **Hydration rule (unchanged intent):** metadata-only Main Hall rows → blank canvas
- **Handoff:** always update this file when finishing a task

## Next actions
1. **Deploy WIP** — commit, push, `npx vercel deploy --prod --yes` so popuphub.ca matches local fixes
2. **Smoke-test** — Step 3 + layout: empty grid, no door/room until user adds; delete last room; logo / Event overview / top nav leave the page
3. **Saved markets with real booths** — confirm cells still restore after deploy
4. Continue Step 1 QA promotion per patch docs when layout sign-off is done

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. deploy layout blank-start fixes / smoke-test Step 3]
```
