import { getMarketCityById } from '@/lib/wizard/market-cities'

/** ~50 km bias box around the selected market city (Edmonton default). */
export function marketCityLatLngBoundsLiteral(
  cityId: string
): google.maps.LatLngBoundsLiteral {
  const city = getMarketCityById(cityId)
  const delta = 0.45
  return {
    south: city.lat - delta,
    west: city.lng - delta,
    north: city.lat + delta,
    east: city.lng + delta,
  }
}
