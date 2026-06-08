/**
 * Client-side geometric union for room + stage layouts.
 * Uses `polygon-clipping` locally — never calls OpenRouter or any remote API.
 */

import type { Ring } from 'polygon-clipping'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  autoArrangeInRoom,
  type AutoArrangeInRoomResult,
  type AutoArrangeOptions,
} from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import {
  DEFAULT_TOUCH_EPSILON_FT,
  isJoinableObject,
  objectFrameOverlapsOrTouches,
  structureFromPlacedObject,
} from '@/components/coordinator/floor-plan-v2/state/room-joins'
import {
  mergeAdjacentStructuresMany,
  pathsToClosedRings,
  structureFromRect,
  type WallSegment2,
} from '@/lib/floor-plan/merge-adjacent-structures'
import {
  ensurePlacementOuterRings,
  interiorAnchorFromBounds,
} from '@/lib/floor-plan/placement-ring-orientation'
import { placedObjectFootprintRing } from '@/lib/floor-plan/shape-union'
import { openRingVertices } from '@/components/coordinator/floor-plan-v2/geometry/point-in-polygon'

export type LayoutPath = ReadonlyArray<readonly [number, number]>

export interface LayoutUnionResult {
  /** Closed outer ring in global canvas feet (CCW). */
  outerRing: Ring
  outerRings: Ring[]
  perimeterWalls: WallSegment2[]
  aabb: { minX: number; minY: number; maxX: number; maxY: number }
  areaSqFt: number
  participantIds: string[]
}

/** Clockwise rectangle path: TL → TR → BR → BL → close. */
export function rectToClosedRing(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Ring {
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ]
}

export function roomFrameToClosedRing(frame: RoomFrame): Ring {
  return rectToClosedRing(
    frame.originX,
    frame.originY,
    frame.originX + frame.widthFt,
    frame.originY + frame.lengthFt
  )
}

/** Rotation-aware stage / fixture footprint as a closed global ring. */
export function placedObjectToClosedRing(obj: PlacedObject): Ring {
  return placedObjectFootprintRing(obj)
}

function ringsBounds(rings: ReadonlyArray<Ring>): LayoutUnionResult['aabb'] {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Boolean-union room rectangles and joinable fixtures (e.g. stage).
 * Dissolves shared border segments — one continuous outer perimeter.
 */
export function unionLayoutParticipants(
  frames: ReadonlyArray<RoomFrame>,
  objects: ReadonlyArray<PlacedObject> = [],
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): LayoutUnionResult | null {
  const eligibleObjects = objects.filter(isJoinableObject)
  if (frames.length === 0 && eligibleObjects.length === 0) return null

  const structures = [
    ...frames.map((f) =>
      structureFromRect(f.id, f.originX, f.originY, f.widthFt, f.lengthFt)
    ),
    ...eligibleObjects.map((o) => structureFromPlacedObject(o)),
  ]

  const merged = mergeAdjacentStructuresMany(structures, epsilon)
  if (!merged || merged.paths.length === 0) return null

  const rawRings = pathsToClosedRings(merged.paths) as Ring[]
  const anchorPoints = [
    ...frames.map((f) => ({
      x: f.originX + f.widthFt / 2,
      y: f.originY + f.lengthFt / 2,
    })),
    ...eligibleObjects.map((o) => ({
      x: o.x + o.width / 2,
      y: o.y + o.height / 2,
    })),
  ]
  const outerRings = ensurePlacementOuterRings(
    rawRings,
    interiorAnchorFromBounds(anchorPoints)
  )
  if (outerRings.length === 0) return null

  const participantIds = [
    ...frames.map((f) => f.id),
    ...eligibleObjects.map((o) => o.id),
  ]

  return {
    outerRing: outerRings[0]!,
    outerRings,
    perimeterWalls: merged.activeWalls,
    aabb: merged.aabb,
    areaSqFt: merged.areaSqFt,
    participantIds,
  }
}

/** True when the ring is a multi-sided union (not a plain 4-corner rectangle). */
export function isNonRectUnionRing(ring: ReadonlyArray<readonly [number, number]>): boolean {
  return openRingVertices(ring as Array<[number, number]>).length > 4
}

function unionFromStoredRing(ring: Ring, participantIds: string[]): LayoutUnionResult {
  const outerRings = [ring]
  return {
    outerRing: ring,
    outerRings,
    perimeterWalls: [],
    aabb: ringsBounds(outerRings),
    areaSqFt: 0,
    participantIds,
  }
}

/**
 * Union the active room with any touching/overlapping stages assigned to it.
 * Returns null when the room stands alone with no stage contact.
 */
export function computeRoomStageUnion(
  doc: FloorPlanDoc,
  roomId: string,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): LayoutUnionResult | null {
  const frame = doc.rooms?.find((f) => f.id === roomId)
  if (!frame || frame.mergedIntoObjectId) return null

  if (frame.perimeterRing && isNonRectUnionRing(frame.perimeterRing)) {
    return unionFromStoredRing(frame.perimeterRing as Ring, [frame.id])
  }

  const objectRoom = doc.objectRoom ?? {}
  const stages = doc.objects.filter(
    (o) =>
      o.kind === 'stage' &&
      objectRoom[o.id] === roomId &&
      objectFrameOverlapsOrTouches(o, frame, epsilon)
  )

  if (stages.length === 0) return null
  return unionLayoutParticipants([frame], stages, epsilon)
}

/**
 * Primary closed ring for perimeter booth/table marching (global canvas ft).
 */
export function resolvePerimeterUnionRingForRoom(
  doc: FloorPlanDoc,
  roomId: string
): Ring | null {
  const frame = doc.rooms?.find((f) => f.id === roomId)
  if (!frame) return null

  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return frame.perimeterRing as Ring
  }

  const union = computeRoomStageUnion(doc, roomId)
  return union?.outerRing ?? roomFrameToClosedRing(frame)
}

/** Stage object ids whose inner connecting wall is dissolved against a room. */
export function dissolvedStageIdsForDoc(
  doc: FloorPlanDoc,
  epsilon = DEFAULT_TOUCH_EPSILON_FT
): ReadonlySet<string> {
  const ids = new Set<string>()
  const frames = doc.rooms ?? []
  const objectRoom = doc.objectRoom ?? {}

  for (const obj of doc.objects) {
    if (obj.kind !== 'stage') continue
    const roomId = objectRoom[obj.id]
    const frame = roomId ? frames.find((f) => f.id === roomId) : null
    if (frame && objectFrameOverlapsOrTouches(obj, frame, epsilon)) {
      ids.add(obj.id)
      continue
    }
    for (const frame of frames) {
      if (frame.mergedIntoObjectId) continue
      if (objectFrameOverlapsOrTouches(obj, frame, epsilon)) {
        ids.add(obj.id)
        break
      }
    }
  }
  return ids
}

/**
 * Run destructive merge selection through polygon union (rooms + stages).
 */
export function unionMergeSelection(
  doc: FloorPlanDoc,
  selection: { roomIds?: ReadonlyArray<string>; objectIds?: ReadonlyArray<string> }
): { union: LayoutUnionResult | null; reason?: string } {
  const roomIdSet = new Set(selection.roomIds ?? [])
  const objectIdSet = new Set(selection.objectIds ?? [])
  const frames = (doc.rooms ?? []).filter((f) => roomIdSet.has(f.id))
  const objects = doc.objects.filter((o) => objectIdSet.has(o.id))

  if (frames.length + objects.length < 2) {
    return {
      union: null,
      reason: 'Select two or more overlapping rooms or fixtures to merge',
    }
  }

  const union = unionLayoutParticipants(frames, objects)
  if (!union) {
    return {
      union: null,
      reason: 'Could not compute union perimeter — overlap shapes first',
    }
  }
  return { union }
}

export type PerimeterLayoutScope = 'patron' | 'vendor'

/**
 * Perimeter auto-layout for PATRON LAYOUT or VENDOR BOOTHS — booths march
 * continuously along the room ∪ stage union ring (local polygon clipper only).
 */
export function runPerimeterLayoutForRoom(
  doc: FloorPlanDoc,
  roomId: string,
  scope: PerimeterLayoutScope,
  options: Omit<AutoArrangeOptions, 'scope' | 'mode'> = {}
): AutoArrangeInRoomResult | null {
  return autoArrangeInRoom(doc, roomId, {
    ...options,
    scope,
    mode: 'perimeter-only',
  })
}

export function runPatronPerimeterLayout(
  doc: FloorPlanDoc,
  roomId: string,
  options?: Omit<AutoArrangeOptions, 'scope' | 'mode'>
): AutoArrangeInRoomResult | null {
  return runPerimeterLayoutForRoom(doc, roomId, 'patron', options)
}

export function runVendorPerimeterLayout(
  doc: FloorPlanDoc,
  roomId: string,
  options?: Omit<AutoArrangeOptions, 'scope' | 'mode'>
): AutoArrangeInRoomResult | null {
  return runPerimeterLayoutForRoom(doc, roomId, 'vendor', options)
}
