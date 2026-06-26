import { rotatedAabb, type Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { edgeClearanceBetweenRects } from '@/lib/floor-plan/rect-edge-clearance'
import {
  findOutdoorExposureIssue,
  listOutdoorExposureIssues,
  OUTDOOR_EXPOSURE_SOURCE_ID,
  type OutdoorExposureIssue,
} from './outdoor-exposure-rules'

/** Edge-to-edge buffer from heat sources to melt-sensitive booths (ft). */
export const MELT_ZONE_BUFFER_FT = 8

const HEAT_SOURCE_KINDS = new Set<PlacedObject['kind']>(['food_truck', 'food_court'])

const HEAT_SOURCE_CATEGORY_MATCHERS = [
  'food (truck)',
  'beverage (truck)',
  'food & beverage',
  'baking',
  'bakery',
  'fresh produce',
]

const MELT_SENSITIVE_CATEGORY_MATCHERS = [
  'candles',
  'wax',
  'chocolate',
  'soap',
  'soaps',
  'body care',
  'wax melt',
]

function normalizeCategory(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

function matchesAny(name: string, patterns: readonly string[]): boolean {
  if (!name) return false
  return patterns.some((p) => name.includes(p))
}

export function isMeltSensitiveCategory(categoryName: string | null | undefined): boolean {
  return matchesAny(normalizeCategory(categoryName), MELT_SENSITIVE_CATEGORY_MATCHERS)
}

export function isHeatSourceCategory(categoryName: string | null | undefined): boolean {
  return matchesAny(normalizeCategory(categoryName), HEAT_SOURCE_CATEGORY_MATCHERS)
}

export function isHeatSourceObject(obj: PlacedObject): boolean {
  if (HEAT_SOURCE_KINDS.has(obj.kind)) return true
  if (obj.kind !== 'booth') return false
  const booth = obj as BoothObject
  if (!isVendorBoothObject(booth)) return false
  return isHeatSourceCategory(booth.categoryName)
}

/** Heat-source footprint expanded by the melt-zone buffer. */
export function meltZoneRect(
  source: PlacedObject,
  bufferFt = MELT_ZONE_BUFFER_FT
): Rect {
  const base = rotatedAabb(source)
  return {
    x: base.x - bufferFt,
    y: base.y - bufferFt,
    width: base.width + bufferFt * 2,
    height: base.height + bufferFt * 2,
  }
}

export function boothWithinMeltZone(
  boothRect: Rect,
  heatSource: PlacedObject,
  bufferFt = MELT_ZONE_BUFFER_FT
): boolean {
  const zone = meltZoneRect(heatSource, bufferFt)
  const clearance = edgeClearanceBetweenRects(boothRect, zone)
  return clearance < MELT_ZONE_BUFFER_FT
}

export interface MeltZoneIssue {
  kind: 'heat_proximity' | 'outdoor_exposure'
  boothId: string
  boothLabel: string
  categoryName: string
  heatSourceId: string
  heatSourceLabel: string
  clearanceFt: number
}

export function findMeltZoneViolation(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  bufferFt = MELT_ZONE_BUFFER_FT
): MeltZoneIssue | null {
  if (!isVendorBoothObject(booth)) return null
  if (!isMeltSensitiveCategory(booth.categoryName)) return null

  const boothRect = rotatedAabb(booth)
  const categoryName = booth.categoryName ?? 'Unknown'

  for (const obj of objects) {
    if (obj.id === booth.id) continue
    if (!isHeatSourceObject(obj)) continue

    const zone = meltZoneRect(obj, bufferFt)
    const clearance = edgeClearanceBetweenRects(boothRect, zone)
    if (clearance < bufferFt) {
      return {
        kind: 'heat_proximity',
        boothId: booth.id,
        boothLabel:
          booth.label?.trim() ||
          `Booth at ${Math.round(booth.x)}′, ${Math.round(booth.y)}′`,
        categoryName,
        heatSourceId: obj.id,
        heatSourceLabel:
          obj.label?.trim() ||
          (obj.kind === 'food_truck'
            ? 'Food truck'
            : obj.kind === 'food_court'
              ? 'Food court'
              : `Heat source at ${Math.round(obj.x)}′, ${Math.round(obj.y)}′`),
        clearanceFt: Math.round(clearance * 10) / 10,
      }
    }
  }

  return null
}

export function outdoorExposureToMeltZoneIssue(issue: OutdoorExposureIssue): MeltZoneIssue {
  return {
    kind: 'outdoor_exposure',
    boothId: issue.boothId,
    boothLabel: issue.boothLabel,
    categoryName: issue.categoryName ?? 'Vendor',
    heatSourceId: OUTDOOR_EXPOSURE_SOURCE_ID,
    heatSourceLabel: 'Open outdoor lot',
    clearanceFt: 0,
  }
}

export function findHeatProximityViolation(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  bufferFt = MELT_ZONE_BUFFER_FT
): MeltZoneIssue | null {
  return findMeltZoneViolation(booth, objects, bufferFt)
}

export function listHeatProximityIssues(
  objects: ReadonlyArray<PlacedObject>,
  bufferFt = MELT_ZONE_BUFFER_FT
): MeltZoneIssue[] {
  const issues: MeltZoneIssue[] = []

  for (const obj of objects) {
    if (obj.kind !== 'booth') continue
    const booth = obj as BoothObject
    const violation = findMeltZoneViolation(booth, objects, bufferFt)
    if (violation) issues.push(violation)
  }

  return issues.sort((a, b) => a.clearanceFt - b.clearanceFt)
}

export function listMeltZoneIssues(
  doc: FloorPlanDoc,
  bufferFt = MELT_ZONE_BUFFER_FT
): MeltZoneIssue[] {
  const byBooth = new Map<string, MeltZoneIssue>()
  for (const issue of listHeatProximityIssues(doc.objects, bufferFt)) {
    byBooth.set(issue.boothId, issue)
  }
  for (const outdoor of listOutdoorExposureIssues(doc)) {
    if (!byBooth.has(outdoor.boothId)) {
      byBooth.set(outdoor.boothId, outdoorExposureToMeltZoneIssue(outdoor))
    }
  }
  return [...byBooth.values()]
}

/** Obstacle rects for auto-arrange soft penalty — expanded heat-source zones. */
export function meltZoneObstacleRects(
  objects: ReadonlyArray<PlacedObject>,
  bufferFt = MELT_ZONE_BUFFER_FT
): Rect[] {
  return objects.filter(isHeatSourceObject).map((source) => meltZoneRect(source, bufferFt))
}

export function boothInMeltZoneBand(
  booth: BoothObject,
  doc: FloorPlanDoc,
  bufferFt = MELT_ZONE_BUFFER_FT
): boolean {
  if (findOutdoorExposureIssue(doc, booth)) return true
  return findMeltZoneViolation(booth, doc.objects, bufferFt) !== null
}

export function boothInMeltZoneBandFromObjects(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>,
  bufferFt = MELT_ZONE_BUFFER_FT
): boolean {
  return findMeltZoneViolation(booth, objects, bufferFt) !== null
}

export interface MeltZoneTheme {
  fill: string
  stroke: string
  fillOpacity: number
}

export const MELT_ZONE_THEME: MeltZoneTheme = {
  fill: '#fed7aa',
  stroke: '#ea580c',
  fillOpacity: 0.76,
}

export function vendorBoothMeltZoneByObjectId(
  doc: FloorPlanDoc,
  bufferFt = MELT_ZONE_BUFFER_FT
): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const issue of listMeltZoneIssues(doc, bufferFt)) {
    map.set(issue.boothId, true)
  }
  return map
}

export function meltZoneThemeForProbe(
  booth: BoothObject,
  doc: FloorPlanDoc,
  bufferFt = MELT_ZONE_BUFFER_FT
): MeltZoneTheme | null {
  return boothInMeltZoneBand(booth, doc, bufferFt) ? MELT_ZONE_THEME : null
}

export function slotOverlapsMeltZone(
  rect: Rect,
  doc: FloorPlanDoc,
  categoryName: string | null,
  bufferFt = MELT_ZONE_BUFFER_FT
): boolean {
  const probe: BoothObject = {
    id: '__melt_probe__',
    kind: 'booth',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: 0,
    categoryName,
    tablePurpose: 'vendor',
  }
  if (findOutdoorExposureIssue(doc, probe)) return true
  if (!isMeltSensitiveCategory(categoryName)) return false
  return findMeltZoneViolation(probe, doc.objects, bufferFt) !== null
}
