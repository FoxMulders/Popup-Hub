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
 *
 * Multi-room model:
 * Each `LayoutRoom` carries an optional `(canvas_origin_x,
 * canvas_origin_y)` offset. The unified `FloorPlanDoc` stores objects
 * in *global* canvas coordinates so the canvas pointer / drag /
 * marquee / rotate code can treat them as a flat list. The sidecar
 * `objectRoom` map remembers which room each object belongs to so
 * that on save we can subtract the parent room's origin and write
 * the object back as a room-local cell / venue element.
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
  RoomFrame,
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

/** Padding (ft) added around the room union when sizing the unified canvas. */
const UNIFIED_CANVAS_PAD_FT = 0

/**
 * Compute the unified canvas extents from a list of room frames.
 * The canvas always starts at `(0, 0)` and stretches to the far
 * corner of the rightmost/bottommost room. Room origins should be
 * non-negative; if any are negative they're effectively clamped via
 * `Math.max` so the canvas still anchors at zero.
 */
export function unifiedCanvasExtents(frames: ReadonlyArray<RoomFrame>): {
  width: number
  length: number
} {
  if (frames.length === 0) return { width: 50, length: 50 }
  let maxX = 0
  let maxY = 0
  for (const f of frames) {
    const right = Math.max(0, f.originX) + f.widthFt
    const bottom = Math.max(0, f.originY) + f.lengthFt
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }
  return {
    width: maxX + UNIFIED_CANVAS_PAD_FT,
    length: maxY + UNIFIED_CANVAS_PAD_FT,
  }
}

/**
 * Build a `RoomFrame[]` from the wizard's `LayoutRoom[]`. Each frame
 * carries its origin in global coords plus its local extent so the
 * canvas can render perimeters and run wall-merge geometry without
 * having to peek back at the source list.
 */
export function frameListFromRooms(
  rooms: ReadonlyArray<LayoutRoom>
): RoomFrame[] {
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    originX: Math.max(0, r.canvas_origin_x ?? 0),
    originY: Math.max(0, r.canvas_origin_y ?? 0),
    widthFt: r.venue_width || 50,
    lengthFt: r.venue_length || 50,
  }))
}

/**
 * Project every `LayoutRoom`'s booths and venue elements onto a single
 * unified `FloorPlanDoc` whose objects sit in *global* canvas coords.
 * The sidecar `objectRoom` map remembers which room each object came
 * from so `legacyRoomsFromDoc` can route edits back to the right
 * source row.
 */
export function docFromLegacyRooms(
  rooms: ReadonlyArray<LayoutRoom>
): FloorPlanDoc {
  if (rooms.length === 0) return { ...makeEmptyDoc(50, 50), rooms: [], objectRoom: {} }

  const frames = frameListFromRooms(rooms)
  const objects: PlacedObject[] = []
  const objectRoom: Record<string, string> = {}

  for (const room of rooms) {
    const ox = Math.max(0, room.canvas_origin_x ?? 0)
    const oy = Math.max(0, room.canvas_origin_y ?? 0)
    for (const cell of room.cells ?? []) {
      if (cell.col < 0 || cell.row < 0) continue
      const obj = objectFromBoothCell(cell)
      // Translate from room-local → unified global coords.
      obj.x += ox
      obj.y += oy
      objects.push(obj)
      objectRoom[obj.id] = room.id
    }
    for (const el of room.venue_elements ?? []) {
      const obj = objectFromVenueElement(el)
      if (!obj) continue
      obj.x += ox
      obj.y += oy
      objects.push(obj)
      objectRoom[obj.id] = room.id
    }
  }

  const extents = unifiedCanvasExtents(frames)
  return {
    canvasWidthFt: extents.width,
    canvasLengthFt: extents.length,
    gridSpacingFt: 1,
    snapFt: 1,
    objects,
    rooms: frames,
    objectRoom,
  }
}

/**
 * Inverse of `docFromLegacyRooms`. Splits the unified doc back into
 * one `LayoutRoom` per source row by:
 *   1. Bucketing objects via `doc.objectRoom` (defaulting to the
 *      first room when an entry is missing — e.g., an object created
 *      by a draw gesture before its room association was wired up).
 *   2. Subtracting the parent room's `canvas_origin_*` so coords
 *      land back in room-local space before passing through
 *      `legacyRoomFromDoc`.
 *   3. Writing the room's new origin from `doc.rooms` so undo of a
 *      room-drag round-trips correctly through save.
 */
export function legacyRoomsFromDoc(
  baseRooms: ReadonlyArray<LayoutRoom>,
  doc: FloorPlanDoc
): LayoutRoom[] {
  if (baseRooms.length === 0) return []

  const frames = doc.rooms ?? []
  const frameById = new Map(frames.map((f) => [f.id, f]))
  const objectRoom = doc.objectRoom ?? {}
  const fallbackRoomId = baseRooms[0]!.id

  // Bucket objects by destination room id.
  const bucketed = new Map<string, PlacedObject[]>()
  for (const room of baseRooms) bucketed.set(room.id, [])
  for (const obj of doc.objects) {
    const roomId = objectRoom[obj.id] ?? fallbackRoomId
    if (!bucketed.has(roomId)) bucketed.set(fallbackRoomId, bucketed.get(fallbackRoomId) ?? [])
    bucketed.get(bucketed.has(roomId) ? roomId : fallbackRoomId)!.push(obj)
  }

  return baseRooms.map((room) => {
    const frame = frameById.get(room.id)
    const ox = frame ? frame.originX : Math.max(0, room.canvas_origin_x ?? 0)
    const oy = frame ? frame.originY : Math.max(0, room.canvas_origin_y ?? 0)
    const widthFt = frame ? frame.widthFt : room.venue_width || 50
    const lengthFt = frame ? frame.lengthFt : room.venue_length || 50

    // Translate this room's objects back into local coords, then
    // re-use the single-room legacy projection to land cells +
    // venue_elements correctly.
    const localObjects: PlacedObject[] = (bucketed.get(room.id) ?? []).map(
      (obj) => ({ ...obj, x: obj.x - ox, y: obj.y - oy }) as PlacedObject
    )
    const localDoc: FloorPlanDoc = {
      canvasWidthFt: widthFt,
      canvasLengthFt: lengthFt,
      gridSpacingFt: doc.gridSpacingFt,
      snapFt: doc.snapFt,
      objects: localObjects,
    }
    const projected = legacyRoomFromDoc(room, localDoc)
    return {
      ...projected,
      canvas_origin_x: ox,
      canvas_origin_y: oy,
    }
  })
}
