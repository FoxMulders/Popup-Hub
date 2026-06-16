/**

 * Booth bin-packing for merged-zone / room placement surfaces.

 *

 * Delegates to {@link AutoArrangeEngine} traffic-aware path optimization.

 * Keeps doc-level helpers used by pathfinding and UI.

 */



import { type Point } from '../interactions/geometry'

import { orientBoothToNearestWallEdge } from '../interactions/perimeter-booth-orientation'

import { PERIMETER_WALL_THICKNESS_FT } from '../interactions/perimeter-walls'

import { resolveRoomPlacementBounds } from '@/lib/floor-plan/boundary-constraints'

import { pointInAnyRing } from '../geometry/point-in-polygon'

import {

  resolveRoomPlacementSurface,

  type PlacementRing,

  type PlacementSurface,

} from '../state/placement-surface'

import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'

import { resolveObjectRoomId } from '../geometry/is-point-in-room'

import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'

import {

  AISLE_WIDTH_FT,

  applyPlacementsToBooths,

  packBoothsForRoom,

} from './AutoArrangeEngine'

import {
  packBoothsUnifiedForRoom,
  type UnifiedPackResult,
} from './UnifiedLayoutSolver'



/** Minimum edge-to-edge aisle between booth footprints (ft). */

export const PACK_BOOTH_AISLE_FT = AISLE_WIDTH_FT



export interface PackBoothsOptions {

  aisleFt?: number

  wallInsetFt?: number

  snapFt?: number

  /** `unified` runs coupled booth+spine solver; default traffic-aware path pack. */
  layoutSolver?: 'traffic-aware' | 'unified'

  /** Vendor layout engine — defaults to traffic-aware when unset. */
  vendorLayoutMode?: LayoutMode

  /** When true (default for fairness mode), evaluate multiple layout scenarios. */
  fairnessMultiScenario?: boolean

  eventCategoryNames?: ReadonlyArray<string>

}

export interface PackBoothsResult {

  booths: BoothObject[]

  placedCount: number

  droppedCount: number

  /** Present when `layoutSolver: 'unified'` produced overlay meta. */
  unifiedMeta?: UnifiedPackResult['unifiedMeta']

  /** Set when `vendorLayoutMode: fairness_first` ran. */
  fairnessScore?: number

  fairnessRoute?: Array<{ x: number; y: number }>

  /** Ranked fairness scenarios when multi-scenario optimization ran (best first). */
  fairnessCandidates?: LayoutResult[]

}



function boothCorners(obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Point[] {

  const center = {

    x: obj.x + obj.width / 2,

    y: obj.y + obj.height / 2,

  }

  const raw: Point[] = [

    { x: obj.x, y: obj.y },

    { x: obj.x + obj.width, y: obj.y },

    { x: obj.x + obj.width, y: obj.y + obj.height },

    { x: obj.x, y: obj.y + obj.height },

  ]

  if (!obj.rotation) return raw

  const rad = (obj.rotation * Math.PI) / 180

  const cos = Math.cos(rad)

  const sin = Math.sin(rad)

  return raw.map((c) => {

    const dx = c.x - center.x

    const dy = c.y - center.y

    return {

      x: center.x + dx * cos - dy * sin,

      y: center.y + dx * sin + dy * cos,

    }

  })

}



function orientBoothToNearestWall(

  booth: BoothObject,

  doc: FloorPlanDoc,

  roomId: string,

  surface: PlacementSurface

): BoothObject {

  const roomFrame = doc.rooms?.find((r) => r.id === roomId)

  const bounds = resolveRoomPlacementBounds(doc, roomId)

  if (!roomFrame || !bounds) return booth



  const snapFrame = {

    ...roomFrame,

    originX: bounds.minX,

    originY: bounds.minY,

    widthFt: bounds.maxX - bounds.minX,

    lengthFt: bounds.maxY - bounds.minY,

  }



  const oriented = orientBoothToNearestWallEdge(booth, snapFrame)

  const next = { ...booth, ...oriented }

  if (boothInsideMergedZone(next, surface.outerRings)) {

    return next

  }



  const rotationOnly = { ...booth, rotation: oriented.rotation }

  if (boothInsideMergedZone(rotationOnly, surface.outerRings)) {

    return rotationOnly

  }



  return booth

}



/**

 * Pack vendor booths inside the active room's placement surface

 * (merged_zone union or rectangular frame) using traffic-aware path

 * optimization with {@link PACK_BOOTH_AISLE_FT} clearance buffers.

 */

export function PackBooths(

  doc: FloorPlanDoc,

  roomId: string,

  booths: BoothObject[],

  options: PackBoothsOptions = {}

): PackBoothsResult {

  const aisleFt = options.aisleFt ?? PACK_BOOTH_AISLE_FT

  const wallInsetFt = options.wallInsetFt ?? PERIMETER_WALL_THICKNESS_FT + 0.5

  const snapFt = options.snapFt ?? doc.snapFt ?? 1



  const surface = resolveRoomPlacementSurface(doc, roomId)

  if (!surface || booths.length === 0) {

    return { booths, placedCount: 0, droppedCount: booths.length }

  }



  const packInput = booths.map((b) => ({ id: b.id, width: b.width, height: b.height }))

  const packOpts = {
    aisleWidth: aisleFt,
    wallInsetFt,
    stepFt: snapFt,
    eventCategoryNames: options.eventCategoryNames,
  }

  const vendorLayoutMode =
    options.vendorLayoutMode ??
    parseLayoutMode(doc.vendorLayoutMode ?? null)

  let fairnessScore: number | undefined
  let fairnessRoute: LayoutResult['route'] | undefined
  let fairnessCandidates: LayoutResult[] | undefined
  let fairResult: LayoutResult | null = null
  let packResult:
    | Awaited<ReturnType<typeof packBoothsForRoom>>
    | UnifiedPackResult

  if (
    vendorLayoutMode === LayoutMode.FAIRNESS_FIRST &&
    options.layoutSolver !== 'unified'
  ) {
    const request = layoutRequestFromDocRoom(doc, roomId, packInput, {
      vendorLayoutMode,
      eventCategoryNames: options.eventCategoryNames,
      aisleFt,
      stepFt: snapFt,
    })
    if (request) {
      const useMultiScenario = options.fairnessMultiScenario ?? true
      if (useMultiScenario) {
        fairnessCandidates = generateFairLayoutCandidates(request)
        fairResult = fairnessCandidates[0] ?? null
      } else {
        fairResult = generateFairLayout(request)
      }
      if (fairResult) {
        fairnessScore = fairResult.fairnessScore
        fairnessRoute = fairResult.route
        packResult = {
          placed: fairResult.placements.map((p) => ({
            id: p.boothId,
            x: p.x + surface.minX,
            y: p.y + surface.minY,
            rotation: p.rotation,
          })),
          unplaced: fairResult.unplacedBoothIds ?? [],
        }
      } else {
        packResult = packBoothsForRoom(doc, roomId, packInput, packOpts)
      }
    } else {
      packResult = packBoothsForRoom(doc, roomId, packInput, packOpts)
    }
  } else {
    packResult =
      options.layoutSolver === 'unified'
        ? packBoothsUnifiedForRoom(doc, roomId, packInput, packOpts)
        : packBoothsForRoom(doc, roomId, packInput, packOpts)
  }

  const packed = (
    fairResult
      ? applyLayoutResultToBooths(booths, fairResult, {
          originX: surface.minX,
          originY: surface.minY,
        })
      : applyPlacementsToBooths(booths, packResult)
  ).map((b) => {
    if (b.x < -900) return b
    if (fairResult) return b
    return orientBoothToNearestWall(b, doc, roomId, surface)
  })



  const placedCount = packResult.placed.length

  return {

    booths: packed,

    placedCount,

    droppedCount: packResult.unplaced.length,

    unifiedMeta:
      options.layoutSolver === 'unified'
        ? (packResult as UnifiedPackResult).unifiedMeta
        : undefined,

    fairnessScore,
    fairnessRoute,
    fairnessCandidates,

  }

}



/**

 * Async variant of {@link PackBooths} — yields between fairness scenarios

 * so the canvas UI can paint loading state and stay interactive.

 */

export async function PackBoothsAsync(

  doc: FloorPlanDoc,

  roomId: string,

  booths: BoothObject[],

  options: PackBoothsOptions = {}

): Promise<PackBoothsResult> {

  const { nextAnimationFrame } = await import('@/lib/booth-planner/placement-guard')

  await nextAnimationFrame()

  const aisleFt = options.aisleFt ?? PACK_BOOTH_AISLE_FT

  const wallInsetFt = options.wallInsetFt ?? PERIMETER_WALL_THICKNESS_FT + 0.5

  const snapFt = options.snapFt ?? doc.snapFt ?? 1



  const surface = resolveRoomPlacementSurface(doc, roomId)

  if (!surface || booths.length === 0) {

    return { booths, placedCount: 0, droppedCount: booths.length }

  }



  const packInput = booths.map((b) => ({ id: b.id, width: b.width, height: b.height }))

  const packOpts = {

    aisleWidth: aisleFt,

    wallInsetFt,

    stepFt: snapFt,

    eventCategoryNames: options.eventCategoryNames,

  }



  const vendorLayoutMode =

    options.vendorLayoutMode ??

    parseLayoutMode(doc.vendorLayoutMode ?? null)



  let fairnessScore: number | undefined

  let fairnessRoute: LayoutResult['route'] | undefined

  let fairnessCandidates: LayoutResult[] | undefined

  let fairResult: LayoutResult | null = null

  let packResult:

    | Awaited<ReturnType<typeof packBoothsForRoom>>

    | UnifiedPackResult



  if (

    vendorLayoutMode === LayoutMode.FAIRNESS_FIRST &&

    options.layoutSolver !== 'unified'

  ) {

    const request = layoutRequestFromDocRoom(doc, roomId, packInput, {

      vendorLayoutMode,

      eventCategoryNames: options.eventCategoryNames,

      aisleFt,

      stepFt: snapFt,

    })

    if (request) {

      const useMultiScenario = options.fairnessMultiScenario ?? true

      const { generateFairLayoutCandidatesAsync } = await import('@/lib/layout-strategies')

      if (useMultiScenario) {

        fairnessCandidates = await generateFairLayoutCandidatesAsync(request)

        fairResult = fairnessCandidates[0] ?? null

      } else {

        fairResult = generateFairLayout(request)

      }

      if (fairResult) {

        fairnessScore = fairResult.fairnessScore

        fairnessRoute = fairResult.route

        packResult = {

          placed: fairResult.placements.map((p) => ({

            id: p.boothId,

            x: p.x + surface.minX,

            y: p.y + surface.minY,

            rotation: p.rotation,

          })),

          unplaced: fairResult.unplacedBoothIds ?? [],

        }

      } else {

        packResult = packBoothsForRoom(doc, roomId, packInput, packOpts)

      }

    } else {

      packResult = packBoothsForRoom(doc, roomId, packInput, packOpts)

    }

  } else {

    packResult =

      options.layoutSolver === 'unified'

        ? packBoothsUnifiedForRoom(doc, roomId, packInput, packOpts)

        : packBoothsForRoom(doc, roomId, packInput, packOpts)

  }



  const packed = (

    fairResult

      ? applyLayoutResultToBooths(booths, fairResult, {

          originX: surface.minX,

          originY: surface.minY,

        })

      : applyPlacementsToBooths(booths, packResult)

  ).map((b) => {

    if (b.x < -900) return b

    if (fairResult) return b

    return orientBoothToNearestWall(b, doc, roomId, surface)

  })



  const placedCount = packResult.placed.length



  return {

    booths: packed,

    placedCount,

    droppedCount: packResult.unplaced.length,

    unifiedMeta:

      options.layoutSolver === 'unified'

        ? (packResult as UnifiedPackResult).unifiedMeta

        : undefined,

    fairnessScore,

    fairnessRoute,

    fairnessCandidates,

  }

}



/** Vendor booths tagged to a room — excludes guest/patron tables. */

export function vendorBoothsInRoom(

  doc: FloorPlanDoc,

  roomId: string

): BoothObject[] {

  return doc.objects.filter(

    (o): o is BoothObject =>

      o.kind === 'booth' &&

      !isGuestTableBooth(o) &&

      resolveObjectRoomId(doc, o, roomId) === roomId

  )

}

/** Patron / guest seating tables in a room. */

export function patronTablesInRoom(

  doc: FloorPlanDoc,

  roomId: string

): BoothObject[] {

  return doc.objects.filter(

    (o): o is BoothObject =>

      o.kind === 'booth' &&

      isGuestTableBooth(o) &&

      resolveObjectRoomId(doc, o, roomId) === roomId

  )

}



/**

 * Clear booth coordinates (off-canvas sentinel) then pack inside

 * merged_zone / room surfaces. Returns updated `doc.objects`.

 */

export function applyPackedBoothsToDoc(

  doc: FloorPlanDoc,

  roomId: string,

  packed: BoothObject[]

): FloorPlanDoc {

  const packedById = new Map(packed.map((b) => [b.id, b]))

  const objectRoom = doc.objectRoom ?? {}

  const objects = doc.objects.map((o) => {

    if (o.kind !== 'booth' || objectRoom[o.id] !== roomId) return o

    if (isGuestTableBooth(o)) return o

    const next = packedById.get(o.id)

    if (!next) {

      return { ...o, x: -999, y: -999, rotation: 0 }

    }

    return { ...o, ...next }

  })

  return { ...doc, objects }

}



/** Collect merged_zone outer rings for the active room (when present). */

export function mergedZoneRingsForRoom(

  doc: FloorPlanDoc,

  roomId: string

): PlacementRing[] {

  const surface = resolveRoomPlacementSurface(doc, roomId)

  return surface ? [...surface.outerRings] : []

}



/** True when every corner of the booth lies inside a merged/placement ring. */

export function boothInsideMergedZone(

  booth: BoothObject,

  rings: ReadonlyArray<PlacementRing>

): boolean {

  return boothCorners(booth).every((c) => pointInAnyRing(c, rings))

}



export { packBooths, packBoothsForRoom } from './AutoArrangeEngine'

export type {

  BoothPackInput,

  BoothPlacement,

  PackBoothsResult as TurfPackBoothsResult,

} from './AutoArrangeEngine'

import type { AutoArrangeInRoomResult, AutoArrangeOptions } from './auto-arrange'
import {
  LayoutMode,
  generateFairLayout,
  generateFairLayoutCandidates,
  layoutRequestFromDocRoom,
  applyLayoutResultToBooths,
  parseLayoutMode,
  type LayoutResult,
} from '@/lib/layout-strategies'

/**
 * Auto-arrange vendor booths via the unified booth+spine solver.
 * Patron tables are left untouched. Falls back to traffic-aware pack
 * when unified places zero booths.
 */
export function autoArrangeVendorUnifiedInRoom(
  doc: FloorPlanDoc,
  roomId: string,
  options: AutoArrangeOptions = {}
): AutoArrangeInRoomResult | null {
  const booths = vendorBoothsInRoom(doc, roomId)
  if (booths.length === 0) return null

  const cleared = booths.map((b) => ({ ...b, x: 0, y: 0, rotation: 0 }))
  let packResult = PackBooths(doc, roomId, cleared, {
    layoutSolver: 'unified',
    eventCategoryNames: options.eventCategoryNames,
    snapFt: doc.snapFt ?? 1,
  })

  if (packResult.placedCount === 0) {
    packResult = PackBooths(doc, roomId, cleared, {
      layoutSolver: 'traffic-aware',
      eventCategoryNames: options.eventCategoryNames,
      snapFt: doc.snapFt ?? 1,
    })
  }

  const packedDoc = applyPackedBoothsToDoc(doc, roomId, packResult.booths)
  return {
    doc: packedDoc,
    placedCount: packResult.placedCount,
    droppedCount: packResult.droppedCount,
    unsatisfiedCategoryCount: 0,
    overflowCount: 0,
    removedOverlapCount: 0,
    roomId,
    unifiedMeta: packResult.unifiedMeta,
    unifiedSolverUsed: Boolean(packResult.unifiedMeta),
  }
}


