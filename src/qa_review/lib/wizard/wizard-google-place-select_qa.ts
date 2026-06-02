import { resolveVenueNameForPlace } from '@/lib/wizard/google-place-venue'
import type { PlaceResult } from '@/src/qa_review/components/coordinator/wizard/wizard-place-types_qa'

export interface WizardGooglePlaceSelectSetters {
  setAddress: (v: string) => void
  setLat: (v: number) => void
  setLng: (v: number) => void
  setPinDropped: (v: boolean) => void
  setMarketCity: (fn: (current: string) => string) => void
  setLocationName: (fn: (current: string) => string) => void
}

/** Apply a Places pick to wizard Step 1 state (venue + address + map pin). */
export function applyWizardGooglePlaceSelect(
  place: PlaceResult,
  setters: WizardGooglePlaceSelectSetters
): void {
  setters.setAddress(place.address)
  setters.setLat(place.lat)
  setters.setLng(place.lng)
  setters.setPinDropped(true)

  if (place.cityId) {
    setters.setMarketCity((current) =>
      place.cityId !== current ? place.cityId! : current
    )
  }

  setters.setLocationName((current) => {
    if (place.preferVenueName && place.name.trim()) {
      return place.name.trim()
    }
    const next = resolveVenueNameForPlace({
      placeName: place.name,
      formattedAddress: place.address,
      isEstablishment: place.isEstablishment,
      currentVenueName: current,
    })
    return next ?? current
  })
}
