export interface MarketCity {
  id: string
  label: string
  lat: number
  lng: number
}

export const MARKET_CITIES: MarketCity[] = [
  { id: 'edmonton', label: 'Edmonton, AB', lat: 53.5461, lng: -113.4938 },
  { id: 'calgary', label: 'Calgary, AB', lat: 51.0447, lng: -114.0719 },
  { id: 'red-deer', label: 'Red Deer, AB', lat: 52.2681, lng: -113.8112 },
  { id: 'lethbridge', label: 'Lethbridge, AB', lat: 49.6956, lng: -112.8451 },
  { id: 'medicine-hat', label: 'Medicine Hat, AB', lat: 50.0405, lng: -110.6764 },
  { id: 'grande-prairie', label: 'Grande Prairie, AB', lat: 55.1707, lng: -118.7947 },
  { id: 'fort-mcmurray', label: 'Fort McMurray, AB', lat: 56.7267, lng: -111.379 },
  { id: 'sherwood-park', label: 'Sherwood Park, AB', lat: 53.5413, lng: -113.2958 },
  { id: 'st-albert', label: 'St. Albert, AB', lat: 53.6304, lng: -113.6258 },
  { id: 'spruce-grove', label: 'Spruce Grove, AB', lat: 53.545, lng: -113.9009 },
  { id: 'leduc', label: 'Leduc, AB', lat: 53.2594, lng: -113.5492 },
  { id: 'fort-saskatchewan', label: 'Fort Saskatchewan, AB', lat: 53.7133, lng: -113.2137 },
  { id: 'camrose', label: 'Camrose, AB', lat: 53.0168, lng: -112.8268 },
  { id: 'lloydminster', label: 'Lloydminster, AB', lat: 53.284, lng: -110.0059 },
  { id: 'airdrie', label: 'Airdrie, AB', lat: 51.2917, lng: -114.0147 },
  { id: 'okotoks', label: 'Okotoks, AB', lat: 50.725, lng: -113.9749 },
  { id: 'cochrane', label: 'Cochrane, AB', lat: 51.1918, lng: -114.4687 },
  { id: 'canmore', label: 'Canmore, AB', lat: 51.089, lng: -115.359 },
  { id: 'banff', label: 'Banff, AB', lat: 51.1784, lng: -115.5708 },
  { id: 'jasper', label: 'Jasper, AB', lat: 52.8737, lng: -118.0814 },
]

export const DEFAULT_MARKET_CITY_ID = 'edmonton'

export function getMarketCityById(id: string): MarketCity {
  return MARKET_CITIES.find((c) => c.id === id) ?? MARKET_CITIES[0]!
}

export function isEdmontonMarketCity(cityId: string): boolean {
  return cityId === 'edmonton'
}

/** Guess market city from a formatted address string. */
export function inferMarketCityId(address: string): string {
  const lower = address.toLowerCase()
  const sorted = [...MARKET_CITIES].sort(
    (a, b) => b.label.length - a.label.length
  )
  for (const city of sorted) {
    const cityName = city.label.split(',')[0]!.trim().toLowerCase()
    if (lower.includes(cityName)) return city.id
  }
  return DEFAULT_MARKET_CITY_ID
}

export function resolveMarketCityId(
  stored: string | null | undefined,
  address?: string | null
): string {
  if (stored && MARKET_CITIES.some((c) => c.id === stored)) return stored
  if (address?.trim()) return inferMarketCityId(address)
  return DEFAULT_MARKET_CITY_ID
}
