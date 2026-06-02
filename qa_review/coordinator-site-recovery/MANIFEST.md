# Coordinator site recovery — QA staging

**Session:** coordinator site recovery (layout, back link, create market)  
**Source commit:** `ea0a6b1` — fix(coordinator): recover layout page, CI, and Main Hall bootstrap  
**Staged:** 2026-05-29  
**Production note:** This commit was already pushed to `origin/master` and deployed to https://popuphub.ca before QA staging was requested. These copies are for formal review and regression sign-off.

## Staged files

| QA path | Canonical production path |
|---------|---------------------------|
| `components/coordinator/spatial-layout/spatial-layout-editor_qa.tsx` | `components/coordinator/spatial-layout/spatial-layout-editor.tsx` |
| `components/coordinator/spatial-layout/use-spatial-layout-state_qa.ts` | `components/coordinator/spatial-layout/use-spatial-layout-state.ts` |
| `components/coordinator/floor-plan-v2/floor-plan-v2_qa.tsx` | `components/coordinator/floor-plan-v2/floor-plan-v2.tsx` |
| `components/coordinator/floor-plan-v2/state/canvas-session-guards_qa.ts` | `components/coordinator/floor-plan-v2/state/canvas-session-guards.ts` |
| `components/coordinator/floor-plan-v2/state/use-canvas-store_qa.ts` | `components/coordinator/floor-plan-v2/state/use-canvas-store.ts` |
| `components/coordinator/floor-plan-v2/state/use-floor-plan-doc_qa.ts` | `components/coordinator/floor-plan-v2/state/use-floor-plan-doc.ts` |
| `lib/booth-planner/layout-rooms_qa.ts` | `lib/booth-planner/layout-rooms.ts` |

## Review focus

- Layout page renders (no `onReloadFromServer` ReferenceError).
- CI / `npm run build` passes.
- Main Hall id alignment (`main-hall`) between wizard and canvas.
- `disableAutoMainHall` / `preferServerLayout` skips auto-seed on standalone layout route.
- `sessionStorage` suppress flag per event survives reload after clear.
- Empty layout when no saved `existingLayout`; last room deletable on that path.

## Manual QA checklist

See `docs/COORDINATOR_QA.md` — especially layout route, create market wizard, and booth placement.
