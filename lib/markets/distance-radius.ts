/** Preset search radii for vendor / patron market discovery. */
export const DISTANCE_RADIUS_OPTIONS = [
  { id: '5', label: '5 km', km: 5 },
  { id: '15', label: '15 km', km: 15 },
  { id: '25', label: '25 km', km: 25 },
  { id: '50plus', label: '50 km+', km: null },
] as const

export type DistanceRadiusOption = (typeof DISTANCE_RADIUS_OPTIONS)[number]
export type DistanceRadiusKm = DistanceRadiusOption['km']

export const DEFAULT_DISTANCE_RADIUS_KM: number = 25

export const MARKET_RADIUS_STORAGE_KEY = 'popup-hub:market-radius-km'

export function isDistanceRadiusActive(
  selected: number | null,
  optionKm: number | null
): boolean {
  return selected === optionKm
}
