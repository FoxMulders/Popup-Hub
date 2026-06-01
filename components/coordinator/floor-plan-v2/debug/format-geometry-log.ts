import type { FloorPlanDoc, RoomFrame } from '../state/types'

export function serializeRoomFrame(frame: RoomFrame) {
  return {
    id: frame.id,
    name: frame.name,
    originFt: [frame.originX, frame.originY],
    sizeFt: [frame.widthFt, frame.lengthFt],
    mergedIntoObjectId: frame.mergedIntoObjectId ?? null,
    vertexCount: frame.perimeterRing?.length ?? 4,
    perimeterRing: frame.perimeterRing ?? null,
  }
}

export function serializeRooms(doc: FloorPlanDoc): string {
  const rooms = (doc.rooms ?? []).filter((r) => !r.mergedIntoObjectId)
  return JSON.stringify(rooms.map(serializeRoomFrame), null, 0)
}

export function formatPlacementProbe(p: {
  x: number
  y: number
  width?: number
  height?: number
}): string {
  if (p.width != null && p.height != null) {
    return `center=(${p.x + p.width / 2},${p.y + p.height / 2}) aabb=(${p.x},${p.y},${p.width},${p.height})`
  }
  return `point=(${p.x},${p.y})`
}

export function formatViewportMatrix(matrix: {
  zoom: number
  panX: number
  panY: number
}): string {
  return `zoom=${matrix.zoom.toFixed(3)} pan=(${matrix.panX.toFixed(2)},${matrix.panY.toFixed(2)})`
}
