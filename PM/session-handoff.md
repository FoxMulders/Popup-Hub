# Session handoff — PopUp Hub

**Agent rule:** Update this file at the end of every scoped task (baseline, active work, blockers, next actions). Do not leave handoff stale.

## Baseline
- Branch: `master` (last pushed `5ce02ef` — fix(layout): blank canvas when layout has room metadata only)
- Production: https://popuphub.ca (build **84** per last deploy)
- **Local WIP (uncommitted):** empty standalone layout editor + coordinator back-navigation fixes (see Active work)

## Goal
Finish QA validation of the **Market Setup Wizard** (Steps 1 & 3), restore the **standalone layout editor** canvas when ready, then promote `src/qa_review/` modules into production paths when signed off.

## Active work — Wizard QA staging

QA modules live under `src/qa_review/` and are wired into production entry points via direct imports. **Do not promote to `@/components` / `@/lib` until QA approves** — use the patch checklists in `src/qa_review/components/coordinator/market-setup-wizard-step*-patch_qa.md`.

### Step 1 — Event & Venue (partially wired)
- **Wired in prod wizard:** Places autocomplete (`WizardStepVenueWithMapsProvider`, `applyWizardGooglePlaceSelect`, `PlaceResult` types)
- **Still production:** `WizardStepEventDetails` (description overlap fix + multi-payment toggles live in QA only)
- Patch doc: `src/qa_review/components/coordinator/market-setup-wizard-step1-patch_qa.md`
- Requires: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with Places API enabled

### Step 3 — Floor plan canvas (wired in wizard only)
- Blank 50×50 canvas on new markets; open-grid placement without room polygons
- Clears stale `localStorage` multi-room drafts on entry
- Hydrates saved geometry only when `cells` or `venue_elements` exist (`layoutHasPlacedGeometry`)
- Patch doc: `src/qa_review/components/coordinator/market-setup-wizard-step3-patch_qa.md`
- Wizard still uses `floor-plan-v2_wizard_qa.tsx` via `WizardStepFloorPlan` in `market-setup-wizard.tsx`

### Layout editor — **reset to empty shell (WIP)**
- `/coordinator/events/[id]/layout` still imports `spatial-layout-editor_qa.tsx`, but the editor **no longer mounts** `FloorPlanV2WizardQa` — toolbar + blank canvas only (intentional rebuild surface)
- Save shows “being rebuilt” toast; draft save still navigates to event overview
- **Not removed from repo:** `floor-plan-v2_wizard_qa.tsx`, hydration QA — re-wire when standalone editor is ready again

### Coordinator navigation fixes (WIP, production paths)
- `coordinatorNavBackHref(pathname)` in `lib/coordinator/coordinator-event-route.ts` — logo/back targets **event overview** when pathname is `/coordinator/events/[id]/…`, else command center
- Wired: `app-nav.tsx` (logo), `coordinator-workspace-rail.tsx`, `coordinator-context-panel.tsx`, `payment-methods-form.tsx`
- `portal-workspace-layout.tsx`: immersive routes include `…/layout`, `…/setup`, `/coordinator/events/new` (no 3-column shell)
- `spatial-layout-shell.tsx`: unmount clears `popup-hub-canvas-fullscreen` / `command-center-canvas-fullscreen` so top nav stays usable after leaving canvas

## Files in scope (QA tree)
See full list in `src/qa_review/MANIFEST.md`. Key entry points:

| Entry | QA import / status |
|-------|-------------------|
| `components/coordinator/market-setup-wizard.tsx` | Step 1 venue + Step 3 floor plan QA modules |
| `app/coordinator/events/[id]/layout/page.tsx` | `spatial-layout-editor_qa.tsx` (empty shell) |
| `src/qa_review/lib/floor-plan/layout-hydration-wizard_qa.ts` | Blank-canvas hydration + `layoutHasPlacedGeometry` |
| `src/qa_review/components/coordinator/floor-plan-v2/floor-plan-v2_wizard_qa.tsx` | Wizard Step 3 only (not layout page until re-wired) |

## Do not touch
- `components/coordinator/booth-planner.tsx` — legacy planner; wizard uses floor-plan-v2 QA stack
- Production `floor-plan-v2.tsx` / `use-canvas-store.ts` — changes belong in QA modules until promotion
- Vendor / shopper / passport / wallet flows unless explicitly asked
- Quarter-auction planning (`app/coordinator/auctions`, `components/auction/**`) — separate initiative

## Blockers
- **Standalone layout route:** floor plan intentionally stripped; must re-attach `FloorPlanV2WizardQa` + `useSpatialLayoutState` (or promoted prod stack) before layout QA can resume
- Step 1 QA promotion blocked on: wiring `WizardStepEventDetailsQa` + `vendorPaymentMethods` array state in `market-setup-wizard.tsx`

## Decisions
- **QA-first:** stage under `src/qa_review/`, wire via imports, promote with patch docs — never edit production modules in place during QA
- **Hydration rule:** `layout_rooms` metadata alone → blank canvas; doors/booths load only when real geometry exists
- **C<sub>max</sub> readout:** Step 2 `layoutCapacity` display only; not a draw/drop validator (Auto-Arrange cap only)
- **Coordinator back nav:** event routes use event overview as “home”; command center remains explicit (`/coordinator/dashboard` or `?event=`)
- **Next.js 16:** read `node_modules/next/dist/docs/` before writing framework code
- **Release:** commit only when explicitly asked; after commit → `git push` → `npx vercel deploy --prod --yes`
- **Handoff:** always update `PM/session-handoff.md` when finishing a task

## Next actions
1. **Smoke-test navigation (WIP)** — from layout/setup/event pages: logo → event overview; Dashboard nav → command center; payment-methods back link; nav visible after leaving layout
2. **Re-wire standalone layout editor** — restore `FloorPlanV2WizardQa` in `spatial-layout-editor_qa.tsx` with `preferServerLayout` + hydration QA; confirm blank canvas + back nav still work
3. **Smoke-test Step 3 (wizard)** — new draft: blank grid, draw/drag, no stale localStorage; saved booths restore when cells exist
4. **Smoke-test Step 1 venue search** — Places autocomplete fills fields + map pin
5. **Wire Step 1 QA event details** — see step1 patch doc
6. **Promote Step 3 / Step 1** — per patch docs after QA sign-off

## How to start the next chat
```
@PM/session-handoff.md

Task: [pick one next action above — local only unless commit/deploy requested]
```

Keep new chats scoped: cite this file + at most 1–2 target files. Avoid opening `floor-plan-v2.tsx`, `booth-planner.tsx`, or broad repo searches unless the task requires it.
