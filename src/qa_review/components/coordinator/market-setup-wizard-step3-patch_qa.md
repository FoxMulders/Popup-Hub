# Step 3 wizard — promotion patch (QA → production)

Apply after QA sign-off. **Do not merge this file**; use it as a checklist.

## Problem fixed in QA

1. **Stale localStorage draft** — Production `hydrateFloorPlanDoc` restores a multi-room crash-recovery draft on Step 3 entry, which could show frozen geometry, ghost objects, or a non-interactive canvas with a stuck "0 objects placed" readout.
2. **Auto Main Hall seed** — Production `useCanvasStore` + mount effects inject a default Main Hall when `doc.rooms` is empty, fighting the wizard's intentional blank start.
3. **Hydration** — QA clears the draft, starts with a fully blank 50×50 ft canvas (no room frames, no objects), and only hydrates saved geometry when editing a market with `existingLayout`.
4. **Open-grid placement** — QA pointer + validation allow draw/drop on the canvas when no room polygons exist (production blocked all placement without a room hit-test).
5. **No sidebar room projection** — QA does not sync wizard `layoutRooms` onto `doc.rooms` on mount (that caused structural outlines + frozen "0 objects placed").

## 1. `market-setup-wizard.tsx`

Replace Step 3 import:

```ts
import { WizardStepFloorPlan } from '@/src/qa_review/components/coordinator/wizard/wizard-step-floor-plan_qa'
// After promotion, move files and import from @/components/coordinator/wizard/wizard-step-floor-plan
```

Pass `existingLayout` into Step 3 (already available on wizard props):

```tsx
{currentStep === 3 && eventId && !skipVenueLayout ? (
  <WizardStepFloorPlan
    eventId={eventId}
    existingLayout={existingLayout ?? null}
    layoutRooms={rooms}
    layoutActiveRoomId={activeRoomId}
    /* …rest unchanged… */
  />
) : null}
```

## 2. Promote file paths

Copy from `src/qa_review/` to production paths (or merge into existing modules):

| QA path | Production target |
|---------|-------------------|
| `lib/floor-plan/layout-hydration-wizard_qa.ts` | `lib/floor-plan/layout-hydration-wizard.ts` (new) |
| `components/coordinator/floor-plan-v2/use-canvas-store-wizard_qa.ts` | fold into `use-canvas-store.ts` or new wizard hook |
| `components/coordinator/floor-plan-v2/floor-plan-v2_wizard_qa.tsx` | fold into `floor-plan-v2.tsx` behind `variant="wizard"` |
| `components/coordinator/wizard/wizard-step-floor-plan_qa.tsx` | `wizard-step-floor-plan.tsx` |

## 3. Placement HUD / C<sub>max</sub> note

The left-rail **C<sub>max</sub> 48** readout is `layoutCapacity` from Step 2 (net booth ceiling after aisle reserve). It is **not** a canvas dimension cap and does **not** block draw/drop — only Auto-Arrange uses it as `maxBooths`. Red Placement HUD swatches come from overlap, barrier, or same-category proximity rules in production canvas code; no QA override was required after draft-clear + blank hydration.

## 4. QA smoke test

- [ ] New draft market, Step 3: blank grid, room frame(s) from wizard, **0 objects placed**, canvas accepts draw/drag.
- [ ] Refresh Step 3: no stale booths from prior session localStorage.
- [ ] Edit existing market with saved layout: booths restore from server when `existingLayout` is passed.
- [ ] Left rail C<sub>max</sub> matches Step 2 capacity; placing booths increments object count live.

See `src/qa_review/MANIFEST.md` for the full Step 3 file list.
