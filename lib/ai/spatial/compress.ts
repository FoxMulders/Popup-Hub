/**
 * DOM & geometry minimization — strip non-essential layout wrappers before
 * sending floor-plan data to spatial AI. Canonical units: feet (ft).
 */

import type {
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '@/components/coordinator/floor-plan-v2/state/types'

/** Minimal rect: [x, y, w, h] in feet, top-left origin. */
export type CompressedRect = [number, number, number, number]

export interface CompressedObject {
  /** Short id or index — preserved when source id is needed for round-trip. */
  i: string
  /** Object kind shorthand. */
  k: string
  /** [x, y, w, h] feet. */
  b: CompressedRect
  /** Rotation degrees when non-zero. */
  r?: number
  /** Category or label when relevant to spatial reasoning. */
  c?: string
}

export interface CompressedRoom {
  i: string
  n: string
  b: CompressedRect
}

export interface CompressedLayout {
  /** Canvas extents [w, h] ft. */
  canvas: [number, number]
  gridFt: number
  rooms: CompressedRoom[]
  objects: CompressedObject[]
}

const KIND_SHORT: Record<string, string> = {
  booth: 'b',
  wall: 'w',
  open_wall: 'ow',
  label: 'l',
  door: 'd',
  emergency_exit: 'x',
  stage: 's',
  food_truck: 'ft',
  merged_zone: 'mz',
}

function roundFt(n: number): number {
  return Math.round(n * 100) / 100
}

function toRect(obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height'>): CompressedRect {
  return [roundFt(obj.x), roundFt(obj.y), roundFt(obj.width), roundFt(obj.height)]
}

function compressObject(obj: PlacedObject): CompressedObject {
  const entry: CompressedObject = {
    i: obj.id,
    k: KIND_SHORT[obj.kind] ?? obj.kind,
    b: toRect(obj),
  }
  const rot = obj.rotation ?? 0
  if (rot !== 0) entry.r = roundFt(rot)
  if (obj.kind === 'booth' && obj.categoryName) {
    entry.c = obj.categoryName
  } else if (obj.label?.trim()) {
    entry.c = obj.label.trim()
  }
  return entry
}

function compressRoom(room: RoomFrame): CompressedRoom {
  return {
    i: room.id,
    n: room.name ?? 'Room',
    b: [roundFt(room.originX), roundFt(room.originY), roundFt(room.widthFt), roundFt(room.lengthFt)],
  }
}

/** Compress a full FloorPlanDoc to a minimal coordinate tree. */
export function compressFloorPlanDoc(doc: FloorPlanDoc): CompressedLayout {
  return {
    canvas: [roundFt(doc.canvasWidthFt), roundFt(doc.canvasLengthFt)],
    gridFt: roundFt(doc.gridSpacingFt),
    rooms: (doc.rooms ?? []).map(compressRoom),
    objects: doc.objects.map(compressObject),
  }
}

/** Room-scoped compression — only objects mapped to `roomId`. */
export function compressRoomLayout(
  doc: FloorPlanDoc,
  roomId: string
): CompressedLayout & { roomId: string } {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  const objectRoom = doc.objectRoom ?? {}
  const inRoom = doc.objects.filter((o) => objectRoom[o.id] === roomId)

  const originX = frame?.originX ?? 0
  const originY = frame?.originY ?? 0
  const localW = frame?.widthFt ?? doc.canvasWidthFt
  const localL = frame?.lengthFt ?? doc.canvasLengthFt

  const localObjects = inRoom.map((o) => ({
    ...o,
    x: o.x - originX,
    y: o.y - originY,
  }))

  return {
    roomId,
    canvas: [roundFt(localW), roundFt(localL)],
    gridFt: roundFt(doc.gridSpacingFt),
    rooms: frame ? [compressRoom({ ...frame, originX: 0, originY: 0 })] : [],
    objects: localObjects.map(compressObject),
  }
}

/** Lightweight SVG string for vision models — rects only, no styling wrappers. */
export function compressedLayoutToSvg(layout: CompressedLayout): string {
  const [cw, ch] = layout.canvas
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cw} ${ch}" width="${cw}" height="${ch}">`,
  ]
  for (const room of layout.rooms) {
    const [x, y, w, h] = room.b
    parts.push(`<rect data-room="${room.i}" x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>`)
  }
  for (const obj of layout.objects) {
    const [x, y, w, h] = obj.b
    const rot = obj.r ? ` transform="rotate(${obj.r} ${x + w / 2} ${y + h / 2})"` : ''
    parts.push(
      `<rect data-id="${obj.i}" data-k="${obj.k}" x="${x}" y="${y}" width="${w}" height="${h}"${rot}/>`
    )
  }
  parts.push('</svg>')
  return parts.join('')
}

/** JSON string — minimal whitespace for token efficiency. */
export function compressedLayoutToJson(layout: CompressedLayout): string {
  return JSON.stringify(layout)
}
