/** Shared place pick payload for wizard Step 1 venue + address fields. */
export interface PlaceResult {
  address: string
  lat: number
  lng: number
  name: string
  cityId: string | null
  isEstablishment: boolean
  postalCode: string | null
  country: string | null
  /** Google Places `types` from autocomplete — used for publish verification without server Geocoding. */
  googlePlaceTypes?: string[]
  /** When true, always apply `name` to the venue name field (venue autocomplete). */
  preferVenueName?: boolean
}

export type WizardPlacesAutocompleteMode = 'venue' | 'address'
