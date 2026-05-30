import type { LayoutRoom, VenueElement } from '@/types/database'
import {
  EDMONTON_VENUE_BLUEPRINTS,
  EDMONTON_VENUE_BY_ID,
  getEdmontonVenueById,
  isEdmontonVenueId,
  type EdmontonVenueId,
} from '@/lib/booth-planner/edmonton-venue-registry'
import { SpatialBitGrid, CELL_LOCK, CELL_WALL } from '@/lib/booth-planner/spatial-bitmap'
import {
  clearInnerClearanceRing,
  collectOpeningCellKeys,
} from '@/lib/booth-planner/perimeter-clearance'
import { stripLockedPerimeterWallElements } from '@/lib/booth-planner/perimeter-wall-segments'
import {
  buildLockedStructuralElements,
  buildUniversalPerimeterWalls,
  buildUniversalPerimeterWallsSkipping,
} from '@/lib/booth-planner/layout-engine/universal-frame'
import type { OffFloorZone } from '@/lib/booth-planner/off-floor-zones'
import { annexElementsFromOffFloorZones } from '@/lib/booth-planner/off-floor-zones'

export type VenuePresetId = 'blank' | EdmontonVenueId

export type VenueFixedAssetType = 'Wall' | 'Lock'

export interface VenueFixedAsset {
  type: VenueFixedAssetType
  x: number
  y: number
  w: number
  h: number
  label?: string
  /** When false, stage stays on the template but vendors may occupy those cells (market demos). */
  lockCells?: boolean
}

export interface VenuePresetDoorSegment {
  type: 'entrance' | 'exit' | 'aisle'
  row: number
  col: number
  colSpan?: number
  rowSpan?: number
}

export interface VenuePreset {
  id: EdmontonVenueId
  label: string
  canvasWidth: number
  canvasHeight: number
  entrance: 'north' | 'south' | 'east' | 'west'
  fixedAssets: VenueFixedAsset[]
  /** Perimeter door openings carved from [W] walls (walkable, not blocked as wall). */
  doorSegments: VenuePresetDoorSegment[]
  offFloorZones?: OffFloorZone[]
}

export const VENUE_PRESET_OPTIONS: { id: VenuePresetId; label: string }[] = [
  { id: 'blank', label: 'Blank Canvas' },
  ...EDMONTON_VENUE_BLUEPRINTS.map((v) => ({ id: v.id as VenuePresetId, label: v.label })),
]

/** @deprecated Import from edmonton-venue-registry */
export const KILKENNY_COMMUNITY_HALL: VenuePreset = EDMONTON_VENUE_BY_ID.kilkenny

export const VENUE_PRESETS: Record<EdmontonVenueId, VenuePreset> = EDMONTON_VENUE_BY_ID

function newId(): string {
  return crypto.randomUUID()
}

/** Map preset top-left (x, y) to 1′ grid row (row 0 = south wall, row rows-1 = north). */
export function presetUserYToGridRow(y: number, canvasHeight: number, height: number): number {
  return canvasHeight - y - height
}

export function presetAssetToGridRect(
  asset: VenueFixedAsset,
  canvasHeight: number
): { col: number; row: number; colSpan: number; rowSpan: number } {
  return {
    col: asset.x,
    row: presetUserYToGridRow(asset.y, canvasHeight, asset.h),
    colSpan: asset.w,
    rowSpan: asset.h,
  }
}

/** Paint outer border: row 0, row rows-1, col 0, col cols-1 (skips door opening cells). */
export function buildPerimeterWallElements(
  cols: number,
  rows: number,
  skipCells: Set<string> = new Set()
): VenueElement[] {
  return buildUniversalPerimeterWallsSkipping(cols, rows, skipCells)
}

function openingElementsFromSegments(segments: VenuePresetDoorSegment[]): VenueElement[] {
  return segments.map((seg) => ({
    id: newId(),
    type: seg.type,
    row: seg.row,
    col: seg.col,
    colSpan: seg.colSpan ?? 1,
    rowSpan: seg.rowSpan ?? 1,
    locked: seg.type === 'aisle',
  }))
}

/**
 * Loop preset fixtures into live venue_elements: [W] walls on perimeter, [L] locked blocks.
 * Called immediately on hall-template selection.
 */
export function buildVenueElementsFromPreset(preset: VenuePreset): VenueElement[] {
  const { canvasWidth: cols, canvasHeight: rows, fixedAssets, doorSegments } = preset
  const walls = buildUniversalPerimeterWalls(cols, rows, doorSegments)
  const structural = buildLockedStructuralElements(fixedAssets, rows)
  const openings = openingElementsFromSegments(doorSegments)

  return stripLockedPerimeterWallElements(
    clearInnerClearanceRing([...walls, ...structural, ...openings], cols, rows),
    cols,
    rows
  )
}

/** Write preset walls (0b01) + locked zones (0b100) into the spatial matrix. */
export function buildPresetSpatialBitmap(preset: VenuePreset): SpatialBitGrid {
  const cols = preset.canvasWidth
  const rows = preset.canvasHeight
  const grid = new SpatialBitGrid(cols, rows)
  const elements = buildVenueElementsFromPreset(preset)
  grid.markVenueElements(elements)
  grid.markVirtualPerimeterShell(collectOpeningCellKeys(elements))
  return grid
}

/** Verify a cell in the preset bitmap is marked as wall or locked fixture. */
export function presetCellIsBlocked(preset: VenuePreset, row: number, col: number): boolean {
  const grid = buildPresetSpatialBitmap(preset)
  const code = grid.get(row, col)
  return code === CELL_WALL || code === CELL_LOCK
}

export function getVenuePresetById(id: VenuePresetId): VenuePreset | null {
  if (id === 'blank') return null
  return getEdmontonVenueById(id) ?? null
}

export function getOffFloorZonesForPreset(presetId: VenuePresetId | null | undefined): OffFloorZone[] {
  if (!presetId || presetId === 'blank') return []
  return getEdmontonVenueById(presetId)?.offFloorZones ?? []
}

/** Geometry-only signature — ignores element ids so saved layouts can be compared to fresh presets. */
export function elementGeometrySignature(el: VenueElement): string {
  return `${el.type}@${el.row},${el.col}:${el.colSpan ?? 1}x${el.rowSpan ?? 1}:${(el.label ?? '').trim()}`
}

export function canonicalPresetElementSignature(elements: VenueElement[]): string {
  return elements.map(elementGeometrySignature).sort().join('|')
}

export function fullVenueElementsFromPreset(preset: VenuePreset): VenueElement[] {
  return [
    ...buildVenueElementsFromPreset(preset).map((el) => ({
      ...el,
      locked: true,
    })),
    ...annexElementsFromOffFloorZones(
      preset.offFloorZones ?? [],
      preset.canvasHeight,
      preset.canvasWidth
    ),
  ]
}

/** True when saved fixtures match the current code-defined preset (same types, spans, labels). */
export function savedVenueMatchesCurrentPreset(
  savedElements: VenueElement[],
  presetId: VenuePresetId,
  venueWidth: number,
  venueLength: number
): boolean {
  if (presetId === 'blank') return savedElements.length === 0
  const preset = getVenuePresetById(presetId)
  if (!preset) return false
  if (venueWidth !== preset.canvasWidth || venueLength !== preset.canvasHeight) return false
  const fresh = fullVenueElementsFromPreset(preset)
  return (
    canonicalPresetElementSignature(savedElements) === canonicalPresetElementSignature(fresh)
  )
}

/** Legacy Kilkenny saves before preset revision — bar block inside hall, stage at wrong edge. */
function inferLegacyKilkennyPresetId(room: LayoutRoom): VenuePresetId | null {
  if (room.venue_width !== 40 || room.venue_length !== 72) return null
  const elements = room.venue_elements ?? []
  if (elements.some((e) => e.label === 'Bar Area')) return 'kilkenny'
  if (elements.some((e) => e.label === 'Raised Stage' || e.label === 'Stage Stairs')) return 'kilkenny'
  return null
}

/** Refresh venue_elements when preset code changed but saved layout still carries old geometry. */
export function migrateRoomToCurrentPreset(room: LayoutRoom): LayoutRoom {
  const presetId =
    room.venue_preset_id && room.venue_preset_id !== 'blank'
      ? (room.venue_preset_id as VenuePresetId)
      : inferLegacyKilkennyPresetId(room)

  if (!presetId || presetId === 'blank') return room

  const elements = room.venue_elements ?? []
  if (savedVenueMatchesCurrentPreset(elements, presetId, room.venue_width, room.venue_length)) {
    return room.venue_preset_id ? room : { ...room, venue_preset_id: presetId }
  }

  const patch = roomPatchFromVenuePreset(presetId)
  return {
    ...room,
    ...patch,
    id: room.id,
    name: room.name,
    baseline_table_length_ft: room.baseline_table_length_ft,
  }
}

export function isVenuePresetId(id: string | null | undefined): id is VenuePresetId {
  return id === 'blank' || isEdmontonVenueId(id)
}

/** Snap venue dimensions to the active template boundary. */
export function resolveTemplateAnchoredDimensions(
  presetId: VenuePresetId | null | undefined,
  venueWidth: number,
  venueLength: number
): { width: number; length: number; preset: VenuePreset | null; isAnchored: boolean } {
  const preset = presetId && presetId !== 'blank' ? getVenuePresetById(presetId) : null
  if (!preset) {
    return { width: venueWidth, length: venueLength, preset: null, isAnchored: false }
  }
  return {
    width: preset.canvasWidth,
    length: preset.canvasHeight,
    preset,
    isAnchored: true,
  }
}

export interface VenuePresetRoomPatch {
  venue_width: number
  venue_length: number
  booth_width: number
  booth_length: number
  spacing_mode: 'one_foot'
  entrance: VenuePreset['entrance']
  cells: []
  venue_elements: VenueElement[]
  venue_preset_id: VenuePresetId | null
}

/**
 * Hydrate full room state from a hall template — dimensions + painted fixtures in one atomic patch.
 * Clears booth snapshots and writes structural bitmask values into venue_elements.
 */
export function hydrateVenuePreset(presetId: VenuePresetId): Partial<VenuePresetRoomPatch> {
  return roomPatchFromVenuePreset(presetId)
}

export interface ResetRoomBlueprintPatch {
  cells: []
  venue_elements: VenueElement[]
}

/**
 * Absolute flush back to the code-defined preset shell — strips vendors, painted fixtures,
 * corridor aisles, co-generated booth aisles, and user decorations. Blank canvas → empty fixtures.
 * Does not inject booths or run auto-plan.
 */
export function resetRoomToPresetBlueprint(
  presetId: VenuePresetId | null | undefined,
  _cols: number,
  _rows: number
): ResetRoomBlueprintPatch {
  if (!presetId || presetId === 'blank') {
    return { cells: [], venue_elements: [] }
  }

  const preset = getVenuePresetById(presetId)
  if (!preset) {
    return { cells: [], venue_elements: [] }
  }

  return {
    cells: [],
    venue_elements: fullVenueElementsFromPreset(preset),
  }
}

/** Room patch for applying a preset (blank clears fixtures; hall sets 1′ grid + painted assets). */
export function roomPatchFromVenuePreset(presetId: VenuePresetId): Partial<VenuePresetRoomPatch> {
  if (presetId === 'blank') {
    return { cells: [], venue_elements: [], venue_preset_id: null }
  }

  const preset = getVenuePresetById(presetId)
  if (!preset) return { cells: [], venue_elements: [], venue_preset_id: null }

  const venue_elements = fullVenueElementsFromPreset(preset)

  return {
    venue_width: preset.canvasWidth,
    venue_length: preset.canvasHeight,
    booth_width: 1,
    booth_length: 1,
    spacing_mode: 'one_foot',
    entrance: preset.entrance,
    cells: [],
    venue_elements,
    venue_preset_id: presetId,
  }
}

/** @deprecated Use buildPresetSpatialBitmap */
export function markPresetOnSpatialGrid(
  grid: { fillRect: (col: number, row: number, colSpan: number, rowSpan: number, value: number, overwriteEmptyOnly?: boolean) => void },
  preset: VenuePreset,
  wallMarker: number
): void {
  const elements = buildVenueElementsFromPreset(preset)
  for (const el of elements) {
    if (el.type === 'entrance' || el.type === 'exit') continue
    const marker = el.locked && el.type !== 'column' && el.type !== 'aisle' ? CELL_LOCK : wallMarker
    grid.fillRect(el.col, el.row, el.colSpan ?? 1, el.rowSpan ?? 1, marker, false)
  }
}
