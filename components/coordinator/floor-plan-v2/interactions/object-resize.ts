import { BOOTH_EQUIPMENT_DEPTH_FT } from '@/lib/booth-planner/table-space'
import {
  GUEST_RECTANGULAR_TABLE_DEPTH_FT,
  resolveTablePurpose,
  type TableShape,
} from '@/lib/booth-planner/table-shape'
import { boothHasTableCluster } from '../state/table-cluster-layout'
import type { BoothObject, PlacedObject } from '../state/types'
import { objectCenter, rotatePointAround, snapToGrid, type Point } from './geometry'

export type ObjectResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

const MIN_OBJECT_DIMENSION_FT = 0.5

export const OBJECT_RESIZE_HANDLES: Array<{
  id: ObjectResizeHandle
  cx: number
  cy: number
  cursor: string
}> = [
  { id: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { id: 'n', cx: 0.5, cy: 0, cursor: 'ns-resize' },
  { id: 'ne', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { id: 'e', cx: 1, cy: 0.5, cursor: 'ew-resize' },
  { id: 'se', cx: 1, cy: 1, cursor: 'nwse-resize' },
  { id: 's', cx: 0.5, cy: 1, cursor: 'ns-resize' },
  { id: 'sw', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { id: 'w', cx: 0, cy: 0.5, cursor: 'ew-resize' },
]

/** True when the object can show canvas resize handles. */
export function objectSupportsCanvasResize(obj: PlacedObject): boolean {
  if (obj.locked) return false
  if (obj.kind === 'merged_zone' || obj.kind === 'label' || obj.kind === 'door') {
    return false
  }
  if (obj.kind === 'booth' && boothHasTableCluster(obj)) return false
  return true
}

/** Map a world-space pointer to the object's unrotated local frame. */
export function pointerInObjectSpace(obj: PlacedObject, worldPt: Point): Point {
  const center = objectCenter(obj)
  return rotatePointAround(worldPt, center, -(obj.rotation || 0))
}

/** Corner / edge handle position in world (ft) space. */
export function objectHandleWorldPosition(
  obj: PlacedObject,
  handle: ObjectResizeHandle
): Point {
  const def = OBJECT_RESIZE_HANDLES.find((h) => h.id === handle)
  if (!def) return objectCenter(obj)
  const local: Point = {
    x: obj.x + obj.width * def.cx,
    y: obj.y + obj.height * def.cy,
  }
  return rotatePointAround(local, objectCenter(obj), obj.rotation || 0)
}

export interface ObjectGeometryPatch {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Apply a resize handle drag from an initial object snapshot.
 * Pointer is interpreted in the object's unrotated local frame.
 */
export function objectResizeFromHandle(
  initial: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  handle: ObjectResizeHandle,
  pointerLocal: Point,
  snapFt: number
): ObjectGeometryPatch {
  const snap = (v: number) => (snapFt > 0 ? snapToGrid(v, snapFt) : v)
  const x0 = initial.x
  const y0 = initial.y
  const w0 = initial.width
  const h0 = initial.height
  const right0 = x0 + w0
  const bottom0 = y0 + h0
  const px = pointerLocal.x
  const py = pointerLocal.y

  let x = x0
  let y = y0
  let width = w0
  let height = h0

  switch (handle) {
    case 'se':
      width = px - x0
      height = py - y0
      break
    case 'e':
      width = px - x0
      break
    case 's':
      height = py - y0
      break
    case 'nw':
      x = px
      y = py
      width = right0 - px
      height = bottom0 - py
      break
    case 'n':
      y = py
      height = bottom0 - py
      break
    case 'ne':
      y = py
      width = px - x0
      height = bottom0 - py
      break
    case 'sw':
      x = px
      width = right0 - px
      height = py - y0
      break
    case 'w':
      x = px
      width = right0 - px
      break
    default:
      break
  }

  width = Math.max(MIN_OBJECT_DIMENSION_FT, snap(width))
  height = Math.max(MIN_OBJECT_DIMENSION_FT, snap(height))
  x = snap(x)
  y = snap(y)

  if (handle.includes('w')) {
    x = right0 - width
  }
  if (handle.includes('n')) {
    y = bottom0 - height
  }

  return { x, y, width, height }
}

function formatDimFt(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Human-readable W×H (or diameter) label for selection chrome. */
export function formatObjectDimensions(obj: PlacedObject): string {
  if (obj.kind === 'booth') {
    const booth = obj as BoothObject
    const purpose = resolveTablePurpose(booth)
    const shape: TableShape = booth.tableShape ?? 'rectangular'
    if (purpose === 'guest' && shape === 'round') {
      return `${formatDimFt(booth.width)}′ Ø`
    }
    if (purpose === 'guest' && shape === 'rectangular') {
      const length = Math.max(booth.width, booth.height)
      const depth = Math.min(booth.width, booth.height)
      return `${formatDimFt(length)}′ × ${formatDimFt(depth)}′`
    }
  }
  return `${formatDimFt(obj.width)}′ × ${formatDimFt(obj.height)}′`
}

/** Merge raw geometry with booth table metadata after a resize gesture. */
export function boothPatchFromResizeGeometry(
  booth: BoothObject,
  geom: ObjectGeometryPatch
): Partial<BoothObject> {
  const purpose = resolveTablePurpose(booth)
  const shape: TableShape = booth.tableShape ?? 'rectangular'

  if (purpose === 'guest' && shape === 'round') {
    const diameter = Math.max(geom.width, geom.height, MIN_OBJECT_DIMENSION_FT)
    const cx = geom.x + geom.width / 2
    const cy = geom.y + geom.height / 2
    return {
      x: cx - diameter / 2,
      y: cy - diameter / 2,
      width: diameter,
      height: diameter,
      tableLengthFt: Math.max(1, Math.round(diameter)),
      tableShape: 'round',
      tablePurpose: 'guest',
    }
  }

  if (purpose === 'guest' && shape === 'rectangular') {
    const length = Math.max(geom.width, geom.height, MIN_OBJECT_DIMENSION_FT)
    const depth = GUEST_RECTANGULAR_TABLE_DEPTH_FT
    if (geom.width >= geom.height) {
      return {
        x: geom.x,
        y: geom.y,
        width: length,
        height: depth,
        tableLengthFt: Math.max(1, Math.round(length)),
        tableShape: 'rectangular',
        tablePurpose: 'guest',
      }
    }
    return {
      x: geom.x,
      y: geom.y,
      width: depth,
      height: length,
      tableLengthFt: Math.max(1, Math.round(length)),
      tableShape: 'rectangular',
      tablePurpose: 'guest',
    }
  }

  const tableLength = Math.max(geom.width, geom.height, MIN_OBJECT_DIMENSION_FT)
  const depth = Math.max(
    Math.min(geom.width, geom.height),
    BOOTH_EQUIPMENT_DEPTH_FT
  )
  if (geom.width >= geom.height) {
    return {
      x: geom.x,
      y: geom.y,
      width: tableLength,
      height: depth,
      tableLengthFt: Math.max(1, Math.round(tableLength)),
      tableShape: 'rectangular',
      tablePurpose: 'vendor',
    }
  }
  return {
    x: geom.x,
    y: geom.y,
    width: depth,
    height: tableLength,
    tableLengthFt: Math.max(1, Math.round(tableLength)),
    tableShape: 'rectangular',
    tablePurpose: 'vendor',
  }
}

/** Final patch for a resized object — booths get table metadata synced. */
export function patchForObjectResize(
  obj: PlacedObject,
  geom: ObjectGeometryPatch
): Partial<PlacedObject> {
  if (obj.kind === 'booth') {
    return boothPatchFromResizeGeometry(obj as BoothObject, geom)
  }
  return geom
}
