/**
 * Search-radius config for vendor / patron market discovery.
 *
 * Previously the UI exposed four preset cards (5 / 15 / 25 / 50+ km) but
 * coordinators asked for finer-grained control, so the picker now uses a
 * continuous slider. The constants below describe the slider's bounds,
 * step size, the "show everywhere" sentinel, and the default value.
 */

/** Minimum slider value in km. Anything smaller is too small to be useful. */
export const DISTANCE_RADIUS_MIN_KM = 5

/** Maximum slider value before the slider snaps to the "show all" sentinel. */
export const DISTANCE_RADIUS_MAX_KM = 200

/** Step size (km) for slider movement. */
export const DISTANCE_RADIUS_STEP_KM = 5

/** Default radius shown on first load — matches the 25 km preset card. */
export const DEFAULT_DISTANCE_RADIUS_KM = 25

/** sessionStorage key used to persist the user's last selected radius. */
export const MARKET_RADIUS_STORAGE_KEY = 'popup-hub:market-radius-km'

/** Vendor apply flow — separate from patron Discover so radius choices do not bleed. */
export const VENDOR_MARKET_RADIUS_STORAGE_KEY = 'popup-hub:vendor-market-radius-km'

/**
 * The DistanceRadiusKm type is `number | null` — `null` represents the
 * "show everywhere" / "no radius cap" sentinel returned by the secondary
 * action button next to the slider. Callers that filter events should
 * treat `null` as "do not filter by distance".
 */
export type DistanceRadiusKm = number | null

/**
 * Format a slider value for display (e.g. `"25 km"` or `"Everywhere"`).
 * Centralised so the picker, the summary line, and the map legend all
 * agree on the rendered label.
 */
export function formatDistanceRadiusKm(km: DistanceRadiusKm): string {
  if (km == null) return 'Everywhere'
  return `${km} km`
}

/**
 * Quantise an arbitrary km value onto the slider grid. Useful when
 * rehydrating from storage or accepting URL parameters from older builds
 * that may have written values like `15` (legacy preset) — those line up
 * naturally with the new step grid.
 */
export function clampSliderRadiusKm(km: number): number {
  if (!Number.isFinite(km)) return DEFAULT_DISTANCE_RADIUS_KM
  const clamped = Math.max(
    DISTANCE_RADIUS_MIN_KM,
    Math.min(DISTANCE_RADIUS_MAX_KM, Math.round(km / DISTANCE_RADIUS_STEP_KM) * DISTANCE_RADIUS_STEP_KM)
  )
  return clamped
}

/**
 * Convert a search radius (km) into a Google Maps zoom level so the map
 * frames the entire search circle. Hand-tuned for the discovery view's
 * default container size; lower zoom = wider frame.
 */
export function zoomForRadiusKm(km: DistanceRadiusKm): number {
  if (km == null) return 5
  if (km <= 5) return 12
  if (km <= 10) return 11
  if (km <= 25) return 10
  if (km <= 50) return 9
  if (km <= 100) return 8
  if (km <= 150) return 7
  return 6
}
