import type { VenueElement } from '@/types/database'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'

const INDOOR_VENUE_PRESET_IDS = new Set<VenuePresetId>(['kilkenny'])

/** Preset ids that are always indoor (no tent vendors). */
export function isIndoorVenuePreset(presetId: VenuePresetId): boolean {
  return INDOOR_VENUE_PRESET_IDS.has(presetId)
}

/** True when the hall has indoor structural markers (corridor auto-detect). */
export function hallHasIndoorShell(
  elements: VenueElement[],
  _cols: number,
  _rows: number
): boolean {
  return elements.some((el) => {
    const label = (el.label ?? '').trim()
    return (
      label === 'Bar Area' ||
      label === 'Raised Stage' ||
      label === 'Stage Stairs' ||
      (el.type === 'aisle' && /row aisle|shared aisle/i.test(label))
    )
  })
}

/** Indoor profile — explicit preset (e.g. Kilkenny) or detected perimeter wall shell. */
export function isIndoorVenueProfile(
  presetId: VenuePresetId,
  elements: VenueElement[],
  cols: number,
  rows: number
): boolean {
  if (isIndoorVenuePreset(presetId)) return true
  return hallHasIndoorShell(elements, cols, rows)
}

export const TENT_OUTDOOR_ONLY_TOOLTIP = 'Tents are restricted to outdoor row presets.'
