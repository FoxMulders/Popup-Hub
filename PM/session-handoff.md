# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Do not leave handoff stale.

## Baseline
- Branch: `master` (last pushed `5ce02ef`)
- Production: https://popuphub.ca (build **84**) — **does not include fixes below until commit + deploy**
- **Local WIP (uncommitted):** command-center nav + blank canvas + build fix (see below)
- **Local build:** passes (`npm run build`, build **85** in working tree)

## Goal
**Redesign layout surfaces with zero preassigned objects** — open grid only; coordinators add rooms and fixtures manually. Restore reliable exit navigation from wizard Step 3, command center, and `/coordinator/events/[id]/layout`.

## Active work — Layout blank start + navigation

### Root causes addressed (WIP)
1. **`roomsFromBoothLayout(null)`** seeded a default Main Hall (50×50) into wizard/layout sidebar state.
2. **`layoutHasPlacedGeometry`** treated `venue_elements` (entrance/exit fixtures) as “saved geometry,” hydrating Door · IN / EXIT onto the canvas from metadata-only saves.
3. **localStorage multi-room draft** could restore stale room + doors even when sidebar rooms were empty.
4. **`handleDeleteRoom`** blocked deleting the last room (“At least one room is required”).
5. **Canvas fullscreen CSS** (`popup-hub-canvas-fullscreen`, `command-center-canvas-fullscreen`) could persist after leaving the editor and hide `#site-app-nav`.
6. **Command center** wired `command-center-canvas-fullscreen` into `FullscreenLayout` → `popup-hub-canvas-fullscreen` fixed the canvas at `z-index: 9998` over the whole viewport, swallowing clicks on **Back to market**, **New market**, and site nav.

### Fixes (WIP files)
| Area | Change |
|------|--------|
| **Build / nav (this pass)** | Removed invalid `Button asChild` (Base UI Button has no slot) — exit/new-market links are styled `Link` + `buttonVariants`; strip `popup-hub-canvas-fullscreen` on command-center mount |
| **Placement (this pass)** | Show **Add room** toolbar when `rooms.length === 0`; fit blank canvas to viewport; toast when drawing with no room |
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
| Command center (this pass) | Decouple dashboard immersive from `FullscreenLayout`; `preferServerLayout` on dashboard; `Button asChild`+`Link` for exit/new market; default panels visible; skip/clear local draft when canvas empty |

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
- Markets with **only** saved `venue_elements` (doors) and no cells will now open **blank** — coordinators use **Add room** then draw; intentional for redesign
- **`Button asChild`** was breaking TypeScript build and nesting `<Link>` inside `<button>` broke navigation clicks

## Decisions
- **Drawable geometry = booth `cells` only** — not `venue_elements`, not `layout_rooms` metadata alone
- **Zero rooms by default** on wizard Step 3 and layout editor until user adds a room or has saved booth cells
- **Hydration rule (unchanged intent):** metadata-only Main Hall rows → blank canvas
- **Handoff:** always update this file when finishing a task

## Next actions
1. **Deploy WIP** — commit, push, `npx vercel deploy --prod --yes` so popuphub.ca matches local fixes
2. **Smoke-test** — Command center: **Back to Spring market**, **+ New market**, site nav work with panels default; empty grid (use **Clear all** once if a stale local draft remains); Step 3 + layout: same blank-start rules
3. **Saved markets with real booths** — confirm cells still restore after deploy
4. Continue Step 1 QA promotion per patch docs when layout sign-off is done

## How to start the next chat
```
@PM/session-handoff.md

Task: [e.g. deploy layout blank-start fixes / smoke-test Step 3]
```
