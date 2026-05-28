/**
 * Legacy bridge — translate between the v2 FloorPlanDoc and the legacy
 * `LayoutRoom` shape that `booth_layouts` rows still use.
 *
 * The v2 model is fluid (floats, arbitrary positions). When we save, we
 * project objects onto the legacy integer-cell format so that downstream
 * readers (check-in, vendor passes, public preview, archived markets)
 * keep working without a database migration.
 *
 * Translation rules:
 * - Booths → `BoothCell` records with col/row computed from
 *   `floor(x / 1ft)`, span derived from `ceil(width / 1ft)`.
 * - Walls / aisles / stages / labels → `VenueElement` records.
 * - Doors → `VenueElement` of type `entrance` or `exit`.
 *
 * Note: this projection is lossy (floats truncate to ft cells). On the
 * read path we re-hydrate as best we can. The v2 canvas itself never
 * round-trips through this projection at runtime — it only happens at
 * save time.
 */

import type {
  BoothCell,
  LayoutRoom,
  VenueElement,
  VenueElementType,
} from '@/types/database'
import type {
  BoothObject,
  DoorObject,
  FloorPlanDoc,
  PlacedObject,
} from './types'
import { makeEmptyDoc } from './types'

const FT = 1
const FAKE_VENDOR_ID_PREFIX = 'placeholder-'

function ftToCell(value: number): number {
  return Math.max(0, Math.round(value / FT))
}

function spanCells(value: number): number {
  return Math.max(1, Math.round(value / FT))
}

function venueElementTypeForObject(
  obj: PlacedObject
): VenueElementType | null {
  switch (obj.kind) {
    case 'wall':
      // The legacy schema doesn't have a dedicated wall type; the
      // closest analog is `column`, which the legacy booth-planner
      // already used to paint walls via the column tool.
      return 'column'
    case 'aisle':
      return 'aisle'
    case 'stage':
      return 'stage'
    case 'label':
      return 'custom_label'
    case 'door':
      return (obj as DoorObject).doorType
    case 'emergency_exit':
      // The legacy schema only knows `entrance` / `exit`, so emergency
      // egress markers project to `exit`. The fact that the source was
      // explicitly an emergency exit is preserved in the label string
      // (see `legacyRoomFromDoc` below).
      return 'exit'
    case 'booth':
      return null
    default:
      return null
  }
}

/**
 * Sentinel label used to round-trip `emergency_exit` through the legacy
 * `exit` venue element. When we re-hydrate, any `exit` whose label
 * starts with this prefix becomes an `emergency_exit` again.
 */
const EMERGENCY_EXIT_LABEL_PREFIX = 'EMERGENCY:'

export function legacyRoomFromDoc(
  base: LayoutRoom,
  doc: FloorPlanDoc
): LayoutRoom {
  const cells: BoothCell[] = []
  const venueElements: VenueElement[] = []
  let boothNumber = 1

  for (const obj of doc.objects) {
    if (obj.kind === 'booth') {
      const booth = obj as BoothObject
      cells.push({
        id: booth.id,
        col: ftToCell(booth.x),
        row: ftToCell(booth.y),
        colSpan: spanCells(booth.width),
        rowSpan: spanCells(booth.height),
        vendorName: booth.label ?? booth.vendorId ?? `Booth ${boothNumber}`,
        categoryName: booth.categoryName ?? '',
        categoryColor: booth.accentColor ?? '#94a3b8',
        boothNumber: boothNumber++,
        boothType: 'inside',
        vendorUnitType: 'table',
        tableLengthFt: null,
        tableOrientation: null,
        facingTarget: null,
      })
      continue
    }

    const elementType = venueElementTypeForObject(obj)
    if (!elementType) continue

    let projectedLabel: string | undefined
    if (obj.kind === 'label') {
      projectedLabel = obj.text
    } else if (obj.kind === 'emergency_exit') {
      // Tag the emergency-exit so the read path can recover the
      // distinct kind. Preserve any user label after the sentinel.
      projectedLabel = `${EMERGENCY_EXIT_LABEL_PREFIX}${obj.label ?? ''}`
    } else {
      projectedLabel = obj.label
    }

    venueElements.push({
      id: obj.id,
      type: elementType,
      col: ftToCell(obj.x),
      row: ftToCell(obj.y),
      colSpan: spanCells(obj.width),
      rowSpan: spanCells(obj.height),
      label: projectedLabel,
      locked: obj.locked,
    })
  }

  return {
    ...base,
    venue_width: doc.canvasWidthFt,
    venue_length: doc.canvasLengthFt,
    booth_width: 1,
    booth_length: 1,
    spacing_mode: 'one_foot',
    cells,
    venue_elements: venueElements,
  }
}

function objectFromBoothCell(cell: BoothCell): BoothObject {
  return {
    id: cell.id,
    kind: 'booth',
    x: cell.col,
    y: cell.row,
    width: Math.max(1, cell.colSpan),
    height: Math.max(1, cell.rowSpan),
    rotation: 0,
    label: cell.vendorName || undefined,
    vendorId: cell.id.startsWith(FAKE_VENDOR_ID_PREFIX) ? null : cell.id,
    categoryName: cell.categoryName || null,
    accentColor: cell.categoryColor || null,
  }
}

function objectFromVenueElement(el: VenueElement): PlacedObject | null {
  const rawLabel = el.label
  const isEmergencyTagged =
    typeof rawLabel === 'string' &&
    rawLabel.startsWith(EMERGENCY_EXIT_LABEL_PREFIX)
  const cleanedLabel = isEmergencyTagged
    ? rawLabel.slice(EMERGENCY_EXIT_LABEL_PREFIX.length) || undefined
    : rawLabel

  const base = {
    id: el.id,
    x: el.col,
    y: el.row,
    width: Math.max(1, el.colSpan ?? 1),
    height: Math.max(1, el.rowSpan ?? 1),
    rotation: 0,
    label: cleanedLabel,
    locked: el.locked,
  }
  switch (el.type) {
    case 'column':
      return { ...base, kind: 'wall' }
    case 'aisle':
      return { ...base, kind: 'aisle' }
    case 'stage':
      return { ...base, kind: 'stage' }
    case 'custom_label':
      return { ...base, kind: 'label', text: el.label ?? '' }
    case 'entrance':
      return { ...base, kind: 'door', doorType: 'entrance' }
    case 'exit':
      // Emergency-exit fidelity: if the saved label still carries the
      // sentinel prefix, re-hydrate as the dedicated kind. Otherwise
      // fall back to the standard door+exit fixture.
      if (isEmergencyTagged) {
        return { ...base, kind: 'emergency_exit' }
      }
      return { ...base, kind: 'door', doorType: 'exit' }
    case 'door':
      return { ...base, kind: 'door', doorType: 'entrance' }
    default:
      return null
  }
}

export function docFromLegacyRoom(room: LayoutRoom | null): FloorPlanDoc {
  if (!room) return makeEmptyDoc(50, 50)

  const objects: PlacedObject[] = []
  for (const cell of room.cells ?? []) {
    if (cell.col < 0 || cell.row < 0) continue
    objects.push(objectFromBoothCell(cell))
  }
  for (const el of room.venue_elements ?? []) {
    const obj = objectFromVenueElement(el)
    if (obj) objects.push(obj)
  }

  return {
    canvasWidthFt: room.venue_width || 50,
    canvasLengthFt: room.venue_length || 50,
    gridSpacingFt: 1,
    snapFt: 1,
    objects,
  }
}
