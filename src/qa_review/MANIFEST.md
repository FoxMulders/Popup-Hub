# QA staging — predictive venue search (Step 1 wizard)

**Feature:** Google Places Autocomplete on **Venue Name** and **Address** with city biasing, bi-directional fill, and map pin sync.

**Wired for local/preview testing:** `market-setup-wizard.tsx` imports QA modules (minimal production touch — import paths only).

## Staged files

| QA file | Role |
|---------|------|
| `lib/wizard/places-autocomplete-request_qa.ts` | Builds biased Autocomplete requests (`establishment` vs address) |
| `lib/wizard/wizard-google-place-select_qa.ts` | Applies place pick to wizard state (`preferVenueName`) |
| `components/coordinator/wizard/wizard-place-types_qa.ts` | `PlaceResult` type |
| `components/coordinator/wizard/venue-places-autocomplete_qa.tsx` | Shared predictive input + dropdown |
| `components/coordinator/wizard/wizard-step-venue_predictive_search.tsx` | Step 1 venue zone (map + both autocompletes) |

## Production paths after approval

Copy QA files to canonical paths (drop `_qa` / `_predictive_search` suffixes):

- `places-autocomplete-request_qa.ts` → `lib/wizard/places-autocomplete-request.ts`
- `wizard-google-place-select_qa.ts` → `lib/wizard/wizard-google-place-select.ts` (or inline in wizard)
- `wizard-place-types_qa.ts` → merge `PlaceResult` into `wizard-step-venue.tsx`
- `venue-places-autocomplete_qa.tsx` → `components/coordinator/wizard/venue-places-autocomplete.tsx`
- `wizard-step-venue_predictive_search.tsx` → `components/coordinator/wizard/wizard-step-venue.tsx`

Then revert `market-setup-wizard.tsx` imports to `@/components/coordinator/wizard/wizard-step-venue`.

## Requirements checklist

- [x] Google Places Autocomplete on address field (`Search address near {city}…`)
- [x] Predictive **Venue Name** (`establishment` type, city-biased)
- [x] Pick fills venue name + address + lat/lng + map pin
- [x] Canada + location bias 50 km around selected market city

## Env

Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with Places API enabled.
