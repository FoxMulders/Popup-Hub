# Popup Hub — Trade Secrets Register

**Classification:** Internal — confidential  
**Last updated:** June 23, 2026  
**Owner:** Tipsy Fox Creations Inc. (Alberta — incorporation pending; see `PM/ip-entity-setup-checklist.md`)

Trade secret protection requires that these assets remain **non-public**. Do not open-source, publish algorithm details in blog posts, or share source with anyone without NDA + IP assignment.

---

## Access policy

| Rule | Detail |
|---|---|
| **Authorized access** | Brad M. only (solo private repo) |
| **Future contractors** | NDA + work-for-hire IP assignment required before any repo or production access |
| **Server-side only** | Core algorithms must not ship in client bundles — audit `NEXT_PUBLIC_*` env vars |
| **On leak** | Act immediately — GitHub takedown, rotate secrets, legal counsel (trade secret status can be lost once public) |

---

## Registered trade secrets

| Module / asset | Location | Description | First documented |
|---|---|---|---|
| Fairness layout engine | `lib/layout-strategies/`, `lib/vendor-fairness-layout/` | Exposure simulation, simulated annealing, fairness scoring, multi-scenario candidate generation | 2026-06-22 |
| HubGrid pathfinding | `components/coordinator/floor-plan-v2/engine/PathfindingService.ts` | Grid A* pathfinder with LOS smoothing, door terminals, bottleneck detection | 2026-06-22 |
| Clearance engine | `lib/coordinator/booth-clearance-visual.ts` | Three-band edge clearance, door egress zones, perimeter orientation | 2026-06-22 |
| Category separation rules | `floor-plan-v2/interactions/category-rules.ts`, `lib/categories/mlm-constraints.ts` | 4-column / 2-row same-category freeze, MLM slot caps | 2026-06-22 |
| Unified layout solver | `floor-plan-v2/engine/UnifiedLayoutSolver.ts`, `AutoArrangeEngine.ts` | Booth bin-packing inside merged zones, traffic-aware pack | 2026-06-22 |
| AI auto-arrange DSL | `lib/floor-plan/ai-auto-arrange.ts` | Gemini prompt schema, collision escalation, spatial advisor chain | 2026-06-22 |
| Escrow / trust model | `lib/coordinator/escrow-policy.ts`, `lib/coordinator/escrow.ts` | Coordinator payout gating, vouch exemption, audit integration | 2026-06-22 |
| Payment chase dunning | `lib/applications/chase-unpaid-payments.ts`, `payment-deadline.ts` | Three-stage reminders, deadline formula, auto-release | 2026-06-22 |
| Edmonton venue registry | `lib/booth-planner/edmonton-venue-registry.ts` | Hardcoded venue blueprints with dimensions and door segments | 2026-06-22 |
| Quarter auction state machine | `lib/quarter-auction/` | Real-time auction phases, paddle pool, winner reveal | 2026-06-22 |
| HubGuard trust directory logic | `lib/organizers/`, coordinator vetting flows | Platform trust ratings and nomination rules | 2026-06-22 |

---

## Maintenance

- Add new confidential modules to this table when created
- Review quarterly: confirm modules remain server-side and repo stays private
- After incorporation: confirm register ownership in the IP assignment deed to **Tipsy Fox Creations Inc.**
