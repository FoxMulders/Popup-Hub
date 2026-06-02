/** Shared place pick payload for wizard Step 1 (QA staging). */
export interface PlaceResult {
  address: string
  lat: number
  lng: number
  name: string
  cityId: string | null
  isEstablishment: boolean
  postalCode: string | null
  country: string | null
  /** When true, always apply `name` to the venue name field (venue autocomplete). */
  preferVenueName?: boolean
}
