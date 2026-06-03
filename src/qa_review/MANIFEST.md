# QA staging — Market Setup Wizard

**Strict:** Do not promote by editing production files until QA approves. Use the step-specific patch docs below.

---

## Step 1 — Event & Venue

**Scope:** Description layout overlap, predictive venue/address search, multi-payment method toggles.

See `components/coordinator/market-setup-wizard-step1-patch_qa.md`.

### Staged files

| QA path | Role |
|---------|------|
| `lib/wizard/places-autocomplete-request_qa.ts` | Autocomplete option helpers (mode types) |
| `lib/wizard/wizard-places-bounds_qa.ts` | City-biased `bounds` for Places |
| `lib/wizard/wizard-google-place-select_qa.ts` | Applies place pick → venue, address, map pin |
| `lib/wizard/vendor-payment-methods_qa.ts` | Payment method array ↔ flags helpers |
| `hooks/use-google-places-autocomplete-widget_qa.ts` | `google.maps.places.Autocomplete` + `place_changed` |
| `styles/wizard-places-autocomplete_qa.css` | `.pac-container` z-index above wizard UI |
| `components/coordinator/wizard/wizard-places-api-provider_qa.tsx` | `APIProvider` with `libraries={['places']}` |
| `components/coordinator/wizard/wizard-place-types_qa.ts` | `PlaceResult` type |
| `components/coordinator/wizard/venue-places-autocomplete_qa.tsx` | Venue + address inputs (native Autocomplete widget) |
| `components/coordinator/wizard/wizard-step-venue_predictive_search.tsx` | Venue zone + map |
| `components/coordinator/wizard/wizard-description-field_qa.tsx` | Description textarea + metrics (no overlap) |
| `components/coordinator/wizard/wizard-payment-preview-strip_qa.tsx` | Multi-select payment chips + array state |
| `components/coordinator/wizard/wizard-step-event-details_step1_qa.tsx` | Full Step 1 identity/schedule/rules deck |
| `components/coordinator/wizard/wizard-step1-integration_qa.tsx` | Re-export bundle for wizard wiring |
| `components/coordinator/market-setup-wizard-step1-patch_qa.md` | Promotion checklist |

### Fixes

1. **Description overlap** — Metrics and helper copy live in a separate block below the floating textarea.
2. **Predictive search** — Loads Places library on `APIProvider`; attaches `google.maps.places.Autocomplete` to venue/address inputs; `place_changed` fills both fields and map pin (city-biased, Edmonton default).
3. **Multi-payment** — Checkbox toggles; form state is `VendorPaymentMethodKey[]`; at least one method required.

---

## Step 3 — Floor Plan canvas

**Scope:** Blank interactive grid on wizard entry (no stale localStorage draft), live object-count sync, optional server layout when editing.

See `components/coordinator/market-setup-wizard-step3-patch_qa.md`.

### Staged files

| QA path | Role |
|---------|------|
| `lib/floor-plan/layout-hydration-wizard_qa.ts` | Clears draft; blank canvas unless cells/venue_elements exist |
| `components/coordinator/spatial-layout/spatial-layout-editor_qa.tsx` | Full layout editor (`/events/.../layout`) on QA canvas |
| `lib/floor-plan/placement-validation-wizard_qa.ts` | Open-canvas placement when no room frames exist |
| `components/coordinator/floor-plan-v2/use-canvas-store-wizard_qa.ts` | Store with `disableAutoMainHall`, wizard placement validation |
| `components/coordinator/floor-plan-v2/interactions/use-canvas-pointer-wizard_qa.ts` | Draw/drop on open grid without requiring room polygon |
| `components/coordinator/floor-plan-v2/canvas/floor-plan-canvas-wizard_qa.tsx` | Canvas wired to wizard pointer hook |
| `components/coordinator/floor-plan-v2/floor-plan-v2_wizard_qa.tsx` | Wizard workspace; no sidebar→doc room projection on mount |
| `components/coordinator/wizard/wizard-step-floor-plan_qa.tsx` | Step 3 shell → `FloorPlanV2WizardQa` |
| `components/coordinator/market-setup-wizard-step3-patch_qa.md` | Promotion checklist |

### Fixes

1. **Stale draft** — `hydrateFloorPlanDocForWizardQa` + mount `clearMultiRoomDraft` so crash-recovery localStorage cannot freeze the canvas.
2. **Blank start** — Empty doc unless saved layout has cells or venue_elements (room metadata alone no longer paints Main Hall).
3. **Open-grid placement** — When `doc.rooms` is empty, booths/labels/walls/doors may be drawn anywhere on the canvas bounds (production required a room polygon).
4. **Object count** — `onPlacedCountChange` wired through QA step shell; left-rail stats update as objects are drawn.
5. **C<sub>max</sub> readout** — Displays Step 2 `layoutCapacity` (e.g. 48); not a drop validator (Auto-Arrange cap only).

---

## Env

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with Places API enabled (Step 1).

