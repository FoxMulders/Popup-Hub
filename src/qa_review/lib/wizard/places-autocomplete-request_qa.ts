import { getMarketCityById } from '@/lib/wizard/market-cities'

export type WizardPlacesAutocompleteMode = 'venue' | 'address'

const CITY_BIAS_RADIUS_M = 50_000

/**
 * Build a Google Places Autocomplete request biased to the wizard market city.
 * Venue mode prioritizes named establishments; address mode allows streets and POIs.
 */
export function buildWizardPlacesAutocompleteRequest(
  input: string,
  cityId: string,
  mode: WizardPlacesAutocompleteMode
): google.maps.places.AutocompletionRequest {
  const city = getMarketCityById(cityId)
  const request: google.maps.places.AutocompletionRequest = {
    input,
    componentRestrictions: { country: ['ca'] },
    locationBias: {
      center: { lat: city.lat, lng: city.lng },
      radius: CITY_BIAS_RADIUS_M,
    },
  }

  if (mode === 'venue') {
    request.types = ['establishment']
  }

  return request
}
