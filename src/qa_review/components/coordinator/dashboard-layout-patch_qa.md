# Dashboard layout optimization — QA staging

**Strict:** Do not promote by editing production paths until QA approves. All changes live under `src/qa_review/`.

---

## Scope

- Remove curation queue (Market Intake, Curation Queue, Available Pool) from dashboard left rail
- Fixed-height left panel (`h-[calc(100vh-64px)]`, `overflow-hidden`) — no inner scrollbars
- Mandatory initial room dimensions modal before canvas mount
- Stage merge uses full 2D bounding box (not width-only line projection)
- Stage SVG renders with `fill="none"` — single outer stroke, draggable like booths
- Portal tooltips escape left-rail overflow; text section headers replace row icon badges

---

## Staged files

| QA path | Role |
|---------|------|
| `components/coordinator/dashboard/Dashboard_qa.tsx` | Bootstrap + left panel + initial room modal + QA re-exports |
| `components/coordinator/dashboard/tooltip-wrapper_qa.tsx` | Portal tooltips with `w-80` sidebar bounds check |
| `components/coordinator/floor-plan-v2/tools/canvas-toolbar-static_qa.tsx` | Uppercase text accordion headers |
| `components/coordinator/floor-plan-v2/tools/canvas-command-bar_qa.tsx` | Dashboard ribbon wired to QA toolbar + tooltips |
| `components/coordinator/floor-plan-v2/tools/command-button_qa.tsx` | Command buttons with portal tooltips |
| `components/coordinator/floor-plan-v2/tools/canvas-command-bar-blocks_qa.tsx` | Block renderer using QA command buttons |
| `components/coordinator/floor-plan-v2/canvas/Canvas_qa.tsx` | Object layer — stage single perimeter + drag |
| `components/coordinator/floor-plan-v2/canvas/floor-plan-canvas_dashboard_qa.tsx` | Canvas host — no duplicate stage selection outline |
| `components/coordinator/floor-plan-v2/state/Merge_qa.ts` | Merge (2) union bounds with 2D stage footprint |
| `components/coordinator/floor-plan-v2/state/destructive-merge_qa.ts` | Drop-in `destructiveMergeInDoc` re-export |

---

## Manual test wiring

### 1. Dashboard layout (required)

In `components/coordinator/dashboard/market-dashboard-client.tsx`:

```tsx
import { DashboardBootstrapQa } from '@/src/qa_review/components/coordinator/dashboard/Dashboard_qa'
// replace DashboardBootstrap with DashboardBootstrapQa
```

In `components/coordinator/floor-plan-v2/floor-plan-v2.tsx` (dashboard command ribbon):

```tsx
import { CanvasCommandBarQa as CanvasCommandBar } from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/canvas-command-bar_qa'
```

### 2. Stage fill on canvas (optional E2E)

In `components/coordinator/floor-plan-v2/floor-plan-v2.tsx`:

```tsx
import { LayoutCanvasDashboardQa as LayoutCanvas } from '@/src/qa_review/components/coordinator/floor-plan-v2/canvas/floor-plan-canvas_dashboard_qa'
```

### 3. Merge (2) stage geometry (optional E2E)

In `components/coordinator/floor-plan-v2/state/use-floor-plan-doc.ts`:

```tsx
import { destructiveMergeInDoc } from '@/src/qa_review/components/coordinator/floor-plan-v2/state/destructive-merge_qa'
```

Or run headless checks:

```bash
npx tsx scripts/verify-merge-qa.ts
npx tsx scripts/verify-destructive-merge.ts   # production merge baseline
```

---

## Smoke-test checklist

1. `/coordinator/dashboard` — new market with no saved rooms → blurred modal → set 50×50 → canvas opens
2. Left rail — Room / Patron / Vendor / Canvas tools only; **no** Market intake, Curation queue, or Available pool
3. Left rail — no vertical scrollbar at 1080p; toolbar accordions fit in fixed height
4. Draw stage against room edge → **Merge (2)** → merged hall includes stage depth (south bump)
5. Stage outline — grid visible through stage (`fill="none"`, rose stroke only); single perimeter when selected (no dashed double outline)
6. Stage drag — select + move stage across grid like a booth block (including after merge join)
7. Left rail tooltips — hover toolbar icons; hints render via portal, not clipped by sidebar
8. Left rail headers — accordion rows show **ROOM LAYOUT**, **PATRON PLACEMENTS**, **VENDOR PLACEMENTS**, **CANVAS SETTINGS** (no standalone row icons)
9. Placement HUD — floats top-right on canvas
10. **Full canvas** mode — toolbar returns above canvas on mobile / immersive

---

## Promotion checklist

- [ ] `Dashboard_qa` → `dashboard-bootstrap.tsx` + `dashboard-left-panel.tsx` + `initial-room-modal.tsx`
- [ ] `Canvas_qa` stage branch → `canvas-objects.tsx`
- [ ] `Merge_qa` bounds → `room-union-merge.ts` / `geometry-sanitize.ts`
- [ ] Remove temporary import swaps in `market-dashboard-client`, `floor-plan-v2`, `use-floor-plan-doc`
- [ ] `npm run build` + coordinator sign-in smoke on prod preview
