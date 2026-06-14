# Layout Strategies — Vendor Fairness Layout Engine

Option A: **strategy-based integration** for PopupHub floor-plan auto-arrange.
Existing traffic-aware packing (`AutoArrangeEngine.ts`) and `PathfindingService.ts`
are preserved unchanged; new strategies wrap or extend them.

## Folder tree

```
lib/layout-strategies/
  README.md                          ← this document
  index.ts                           ← public exports + default orchestrator singleton
  types.ts                           ← LayoutRequest, LayoutResult, BoothPlacement, …
  LayoutMode.ts                      ← enum + future strategy registry keys
  LayoutStrategy.ts                  ← LayoutStrategy interface
  AutoArrangeOrchestrator.ts         ← strategy orchestrator (spec: AutoArrangeEngine class)
  strategies/
    TrafficAwareStrategy.ts          ← wraps packBoothsTrafficAware / packBoothsForRoom (zero behavior change)
    FairnessFirstStrategy.ts         ← vendor fairness optimization entry
    future/                          ← placeholders for extensibility (not wired yet)
      BalancedStrategy.ts
      RevenueMaxStrategy.ts
      PremiumBoothOptimizationStrategy.ts
      EmergencyFlowOptimizationStrategy.ts
  adapters/
    floor-plan-doc-adapter.ts        ← FloorPlanDoc + roomId ↔ LayoutRequest / apply LayoutResult
  fairness-engine/
    snake-circulation.ts             ← serpentine patron route (delegates to buildPatronPathway)
    exposure-simulator.ts            ← virtual attendee impressions along route
    placement-validator.ts           ← booth-in-room, aisle, overlap checks
    simulated-annealing.ts           ← swap/nudge optimizer for exposure equity
    fairness-scorer.ts               ← 0–100 fairness score from exposure variance
    generate-fair-layout.ts          ← FairnessFirstStrategy core pipeline

lib/vendor-fairness-layout/          ← shared canonical types + geometry (prior session)
  types.ts
  constants.ts
  geometry/
    polygon.ts

components/coordinator/floor-plan-v2/
  engine/
    AutoArrangeEngine.ts             ← UNCHANGED traffic-aware implementation (packBooths*, applyPlacements*)
    PathfindingService.ts            ← UNCHANGED; reused by FairnessFirst for route validation
    BoothArrangementEngine.ts        ← MINIMAL: vendorLayoutMode → orchestrator when FAIRNESS_FIRST
    auto-arrange.ts                  ← UNCHANGED grid/staggered/perimeter passes
    patron-centric-layout.ts         ← reused by TrafficAware + snake circulation
    UnifiedLayoutSolver.ts           ← UNCHANGED unified solver path
  state/
    types.ts                         ← FloorPlanDoc.vendorLayoutMode optional field
  tools/
    canvas-command-bar-blocks.tsx    ← vendor layout mode selector + fairness score toast hook
  floor-plan-v2.tsx                  ← state + persist vendorLayoutMode on doc / save bridge

types/database.ts                    ← LayoutRoom.vendor_layout_mode optional (JSON round-trip)

scripts/
  verify-layout-strategies.ts        ← regression + fairness fixtures (tsx assert pattern)
```

## Integration points

| Caller | Default mode | Fairness path |
|--------|--------------|---------------|
| `BoothArrangementEngine.PackBooths` | `TRAFFIC_AWARE` | `vendorLayoutMode: FAIRNESS_FIRST` → orchestrator |
| `autoArrangeInRoom` / grid modes | unchanged | N/A (pattern modes separate from engine mode) |
| `runAutoArrangeWithAi` unified path | `unified` solver | optional future: fairness pre-pass |
| Floor plan UI **Optimize** control | traffic-aware | secondary **Engine** toggle: Traffic / Fairness |
| Save bridge `legacyRoomsFromDoc` | — | persists `vendor_layout_mode` per room |

## Strategy contract

```typescript
interface LayoutStrategy {
  generateLayout(request: LayoutRequest): Promise<LayoutResult>
}

enum LayoutMode {
  TRAFFIC_AWARE,
  FAIRNESS_FIRST,
  // future: BALANCED, REVENUE_MAX, PREMIUM_BOOTH, EMERGENCY_FLOW
}
```

`LayoutResult` always includes `fairnessScore` (0–100). Traffic-aware mode derives
score from exposure distribution along the patron pathway; fairness-first optimizes for it.

## Backward compatibility

- All existing exports from `AutoArrangeEngine.ts` remain identical.
- `PathfindingService` is not modified.
- Callers omitting `vendorLayoutMode` / `LayoutMode` default to `TRAFFIC_AWARE`.
- `layoutSolver: 'traffic-aware' | 'unified'` behavior is unchanged when `vendorLayoutMode` is unset.

## Testing

```bash
npx tsx scripts/verify-layout-strategies.ts
npx tsx scripts/verify-auto-arrange-engine.ts   # existing traffic-aware smoke (unchanged)
```

Regression: fixed rectangle fixture — `TrafficAwareStrategy` output must match
pre-refactor `packBoothsTrafficAware` byte-for-byte on placement coordinates.
