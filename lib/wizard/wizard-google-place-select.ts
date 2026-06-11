import type { Dispatch, SetStateAction } from 'react'
import { resolveVenueNameFromAddressPick } from '@/lib/wizard/google-place-venue'
import type { PlaceResult } from '@/lib/wizard/wizard-place-types'

export interface WizardGooglePlaceSelectSetters {
  setAddress: (v: string) => void
  setLat: (v: number) => void
  setLng: (v: number) => void
  setPinDropped: (v: boolean) => void
  setMarketCity: Dispatch<SetStateAction<string>>
  setLocationName: Dispatch<SetStateAction<string>>
  setVenuePlaceTypes?: Dispatch<SetStateAction<string[]>>
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
  if (place.googlePlaceTypes?.length) {
    setters.setVenuePlaceTypes?.(place.googlePlaceTypes)
  }

  if (place.cityId) {
    setters.setMarketCity((current) =>
      place.cityId !== current ? place.cityId! : current
    )
  }

  if (place.preferVenueName && place.name.trim()) {
    setters.setLocationName(place.name.trim())
    return
  }

  const venueFromAddress = resolveVenueNameFromAddressPick({
    placeName: place.name,
    formattedAddress: place.address,
    isEstablishment: place.isEstablishment,
  })
  if (venueFromAddress) {
    setters.setLocationName(venueFromAddress)
  }
}
