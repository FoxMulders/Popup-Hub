/**
 * Client orchestration: Gemini auto-arrange with deterministic fallback.
 */

import { nextAnimationFrame } from '@/lib/booth-planner/placement-guard'
import {
  autoArrangeInRoomAsync,
  type AutoArrangeInRoomResult,
  type AutoArrangeMode,
  type AutoArrangeOptions,
} from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
} from '@/components/coordinator/floor-plan-v2/state/types'
import { resolveRoomPlacementSurface } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import { objectFootprintAabb } from '@/components/coordinator/floor-plan-v2/state/table-cluster-layout'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  applyAiPlacementsToBooths,
  type AiAutoArrangeFixture,
  type AiAutoArrangeRequest,
  type AiAutoArrangeResponse,
  type AiTrafficFlowLoop,
} from '@/lib/floor-plan/ai-auto-arrange'
import {
  evaluateTrafficFlowPrerequisites,
  type TrafficFlowDoorSnapshot,
} from '@/components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import {
  runPatronPerimeterLayout,
  runVendorPerimeterLayout,
} from '@/src/utils/layoutMergeEngine'
import {
  autoArrangeVendorUnifiedInRoom,
  applyPackedBoothsToDoc,
  PackBoothsAsync,
  vendorBoothsInRoom,
} from '@/components/coordinator/floor-plan-v2/engine/BoothArrangementEngine'
import {
  applyClearanceAutoCorrection,
} from '@/lib/floor-plan/clearance-auto-correction'
import { optimizeTessellatedLayoutAsync } from '@/lib/floor-plan/layout-tessellation-optimizer'
import { requestSpatialLayoutStream } from '@/lib/floor-plan/request-spatial-layout-stream'
import { LayoutMode, parseLayoutMode } from '@/lib/layout-strategies'

export interface RunAutoArrangeWithAiResult extends AutoArrangeInRoomResult {
  /** True when Gemini returned placements (deterministic engine skipped). */
  aiOptimized?: boolean
  aiRationale?: string
  aiModel?: string
  /** True when placements arrived via geometry-tier SSE stream. */
  streamed?: boolean
  /** True when multi-pattern tessellation optimizer selected the layout. */
  tessellationOptimized?: boolean
  winningPattern?: import('@/lib/floor-plan/layout-tessellation-optimizer').TessellationPatternId
}

export interface RunAutoArrangeWithAiOptions extends AutoArrangeOptions {
  /** Progressive canvas updates while the geometry worker streams placements. */
  onPartialLayout?: (doc: FloorPlanDoc, placedSoFar: number) => void
}

function buildSpatialStreamInstructions(payload: AiAutoArrangeRequest): string {
  const vendors = payload.items.filter((i) => !i.isPatron).length
  const patrons = payload.items.filter((i) => i.isPatron).length
  const obstacleNote =
    payload.obstacles.length > 0
      ? `${payload.obstacles.length} fixed obstacles — maintain clearance, no overlaps.`
      : 'No fixed obstacles.'
  const trafficNote = payload.trafficFlow
    ? 'Route patrons Entry → vendor aisles → Exit; orient every vendor storefront toward the primary flow line.'
    : 'Route high-traffic flow through entry/exit fixtures; avoid dead-ends.'

  return [
    `Place ${payload.items.length} objects (${vendors} vendor, ${patrons} patron).`,
    `Scope: ${payload.scope}. Mode: ${payload.mode}.`,
    `Room ${payload.roomWidthFt}'×${payload.roomLengthFt}' with ${payload.aisleWidthFt}' aisles.`,
    obstacleNote,
    trafficNote,
    'Return exactly one placement per item id in feet (top-left origin).',
  ].join(' ')
}

function boothsForScope(
  objects: PlacedObject[],
  scope: AutoArrangeOptions['scope']
): BoothObject[] {
  const booths = objects.filter((o): o is BoothObject => o.kind === 'booth')
  if (scope === 'patron') return booths.filter((b) => isGuestTableBooth(b))
  if (scope === 'vendor') return booths.filter((b) => !isGuestTableBooth(b))
  return booths
}

function buildAiPayload(
  doc: FloorPlanDoc,
  roomId: string,
  localW: number,
  localL: number,
  localObjects: PlacedObject[],
  options: AutoArrangeOptions
): AiAutoArrangeRequest | null {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) return null

  const scope = options.scope ?? 'vendor'
  const rawMode = options.mode ?? 'grid'
  const mode: AutoArrangeMode =
    rawMode === 'center-out' ? 'grid' : (rawMode as AutoArrangeMode)
  const items = boothsForScope(localObjects, scope).map((b) => ({
    id: b.id,
    width: b.width,
    height: b.height,
    category: b.categoryName ?? undefined,
    isPatron: isGuestTableBooth(b),
  }))
  if (items.length === 0) return null

  const obstacles = localObjects
    .filter((o) => o.kind !== 'booth' && o.kind !== 'door' && o.kind !== 'emergency_exit')
    .map((o) => {
      const aabb = objectFootprintAabb(o)
      return {
        x: aabb.x,
        y: aabb.y,
        width: aabb.width,
        height: aabb.height,
        kind: o.kind,
      }
    })

  const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)
  const localEntryIds = new Set(traffic.entryDoors.map((d) => d.id))
  const localExitIds = new Set(traffic.exitDoors.map((d) => d.id))

  const toFixture = (snap: TrafficFlowDoorSnapshot): AiAutoArrangeFixture => ({
    id: snap.id,
    role: snap.role,
    x: snap.x,
    y: snap.y,
    width: snap.width,
    height: snap.height,
    rotation: snap.rotation,
    centerX: snap.centerX,
    centerY: snap.centerY,
    wallEdge: snap.wallEdge,
    kind: snap.kind,
    ...(snap.kind === 'door'
      ? { doorType: snap.role === 'entry' ? 'entrance' : 'exit' }
      : {}),
  })

  const fixtures: AiAutoArrangeFixture[] = [
    ...traffic.entryDoors.map(toFixture),
    ...traffic.exitDoors.map(toFixture),
  ]

  const otherFixtures = localObjects
    .filter(
      (o) =>
        (o.kind === 'door' || o.kind === 'emergency_exit') &&
        !localEntryIds.has(o.id) &&
        !localExitIds.has(o.id)
    )
    .map((o) => {
      const aabb = objectFootprintAabb(o)
      return {
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation ?? 0,
        centerX: aabb.x + aabb.width / 2,
        centerY: aabb.y + aabb.height / 2,
        kind: o.kind as 'door' | 'emergency_exit',
        ...(o.kind === 'door' ? { doorType: o.doorType } : {}),
      } satisfies AiAutoArrangeFixture
    })

  fixtures.push(...otherFixtures)

  let trafficFlow: AiTrafficFlowLoop | undefined
  if (traffic.satisfied) {
    trafficFlow = {
      entryPoints: traffic.entryDoors.map((d) => ({
        x: d.centerX,
        y: d.centerY,
        wallEdge: d.wallEdge,
      })),
      exitPoints: traffic.exitDoors.map((d) => ({
        x: d.centerX,
        y: d.centerY,
        wallEdge: d.wallEdge,
      })),
      primaryPathHint:
        'Continuous loop: patrons enter at Entry fixture(s), circulate through vendor aisles facing booth fronts, then exit at Exit fixture(s) without crossing patron seating clusters.',
    }
  }

  return {
    roomName: frame.name ?? 'Main Hall',
    roomWidthFt: localW,
    roomLengthFt: localL,
    mode,
    scope,
    aisleWidthFt: options.aisleWidthFt ?? 8,
    items,
    obstacles,
    fixtures,
    trafficFlow,
  }
}

function mergeAiBoothsIntoDoc(
  doc: FloorPlanDoc,
  roomId: string,
  localObjects: PlacedObject[],
  aiBooths: BoothObject[],
  scope: AutoArrangeOptions['scope'],
  originX: number,
  originY: number
): FloorPlanDoc {
  const aiIds = new Set(aiBooths.map((b) => b.id))
  const objectRoom = doc.objectRoom ?? {}
  const inRoomOthers = doc.objects.filter(
    (o) => objectRoom[o.id] === roomId && o.kind !== 'booth'
  )
  const outOfRoom = doc.objects.filter((o) => objectRoom[o.id] !== roomId)

  const untouchedBooths = localObjects.filter(
    (o): o is BoothObject =>
      o.kind === 'booth' &&
      !aiIds.has(o.id) &&
      ((scope === 'patron' && isGuestTableBooth(o as BoothObject)) ||
        (scope === 'vendor' && !isGuestTableBooth(o as BoothObject)) ||
        scope === 'all')
  )

  const reglobal = [...aiBooths, ...untouchedBooths].map(
    (o) =>
      ({
        ...o,
        x: o.x + originX,
        y: o.y + originY,
      }) as PlacedObject
  )

  return {
    ...doc,
    objects: [...outOfRoom, ...inRoomOthers, ...reglobal],
  }
}

async function deterministicFallback(
  doc: FloorPlanDoc,
  roomId: string,
  options: AutoArrangeOptions
): Promise<AutoArrangeInRoomResult | null> {
  const mode = options.mode ?? 'grid'
  const scope = options.scope ?? 'vendor'
  const vendorLayoutMode = parseLayoutMode(doc.vendorLayoutMode ?? null)

  if (
    vendorLayoutMode === LayoutMode.FAIRNESS_FIRST &&
    scope !== 'patron'
  ) {
    const booths = vendorBoothsInRoom(doc, roomId)
    if (booths.length === 0 && scope === 'vendor') return null
    const cleared = booths.map((b) => ({ ...b, x: 0, y: 0, rotation: 0 }))
    await nextAnimationFrame()
    const packResult = await PackBoothsAsync(doc, roomId, cleared, {
      vendorLayoutMode: LayoutMode.FAIRNESS_FIRST,
      eventCategoryNames: options.eventCategoryNames,
      snapFt: doc.snapFt ?? 1,
    })
    const packedDoc = applyPackedBoothsToDoc(doc, roomId, packResult.booths)
    return {
      doc: {
        ...packedDoc,
        vendorLayoutMode: LayoutMode.FAIRNESS_FIRST,
        lastFairnessScore: packResult.fairnessScore,
      },
      placedCount: packResult.placedCount,
      droppedCount: packResult.droppedCount,
      unsatisfiedCategoryCount: 0,
      overflowCount: 0,
      removedOverlapCount: 0,
      roomId,
    }
  }

  if (scope !== 'patron') {
    await nextAnimationFrame()
    const tessellated = await optimizeTessellatedLayoutAsync(doc, roomId, {
      ...options,
      scope: scope === 'all' ? 'all' : 'vendor',
      dropUnplacedBooths: options.dropUnplacedBooths ?? true,
    })
    if (tessellated && tessellated.placedCount > 0) {
      return tessellated
    }
  }

  const useUnified =
    options.layoutSolver === 'unified' ||
    (mode !== 'grid' && scope !== 'patron')

  if (useUnified) {
    const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)
    if (traffic.satisfied || options.layoutSolver === 'unified') {
      await nextAnimationFrame()
      const unified = autoArrangeVendorUnifiedInRoom(doc, roomId, {
        ...options,
        layoutSolver: 'unified',
      })
      if (unified && unified.placedCount > 0) {
        if (scope === 'all') {
          const patronPass = await autoArrangeInRoomAsync(unified.doc, roomId, {
            ...options,
            scope: 'patron',
            layoutSolver: 'traffic-aware',
          })
          if (patronPass) {
            return {
              ...patronPass,
              placedCount: unified.placedCount + patronPass.placedCount,
              unifiedMeta: unified.unifiedMeta,
              unifiedSolverUsed: unified.unifiedSolverUsed,
            }
          }
        }
        return unified
      }
    }
  }

  if (mode === 'perimeter-only' && scope !== 'all') {
    return scope === 'patron'
      ? runPatronPerimeterLayout(doc, roomId, options)
      : runVendorPerimeterLayout(doc, roomId, options)
  }
  return autoArrangeInRoomAsync(doc, roomId, options)
}

/**
 * Route auto-arrange through Gemini 2.5 Pro; fall back to the local
 * deterministic engine when the API is unavailable or returns invalid data.
 */
export async function runAutoArrangeWithAi(
  doc: FloorPlanDoc,
  roomId: string,
  options: RunAutoArrangeWithAiOptions = {}
): Promise<RunAutoArrangeWithAiResult | null> {
  const frame = (doc.rooms ?? []).find((f) => f.id === roomId)
  if (!frame) return null

  const surface = resolveRoomPlacementSurface(doc, roomId)
  const originX = surface?.minX ?? frame.originX
  const originY = surface?.minY ?? frame.originY
  const localW = surface ? Math.max(1, surface.maxX - surface.minX) : frame.widthFt
  const localL = surface ? Math.max(1, surface.maxY - surface.minY) : frame.lengthFt

  const objectRoom = doc.objectRoom ?? {}
  const inRoom = doc.objects.filter((o) => objectRoom[o.id] === roomId)
  const localObjects = inRoom
    .filter((o) => o.kind !== 'merged_zone')
    .map(
      (o) =>
        ({
          ...o,
          x: o.x - originX,
          y: o.y - originY,
        }) as PlacedObject
    )

  const payload = buildAiPayload(doc, roomId, localW, localL, localObjects, options)
  if (!payload) {
    await nextAnimationFrame()
    const fallback = await deterministicFallback(doc, roomId, options)
    return fallback ? { ...fallback, aiOptimized: false } : null
  }

  let aiResult: AiAutoArrangeResponse | null = null
  let streamed = false

  const scope = options.scope ?? 'vendor'
  const applyPartialToDoc = (placements: AiAutoArrangeResponse['placements']) => {
    const sourceBooths = boothsForScope(localObjects, scope)
    const { booths: placed } = applyAiPlacementsToBooths(
      sourceBooths,
      placements,
      localW,
      localL
    )
    return mergeAiBoothsIntoDoc(
      doc,
      roomId,
      localObjects,
      placed,
      scope,
      originX,
      originY
    )
  }

  try {
    const streamedLayout = await requestSpatialLayoutStream({
      roomName: payload.roomName,
      roomWidthFt: localW,
      roomLengthFt: localL,
      roomId,
      doc,
      mode: payload.mode,
      instructions: buildSpatialStreamInstructions(payload),
      onPartial: (partialPlacements) => {
        if (!options.onPartialLayout || partialPlacements.length === 0) return
        const merged = applyPartialToDoc(partialPlacements)
        options.onPartialLayout(merged, partialPlacements.length)
      },
    })
    if (streamedLayout.placements.length > 0) {
      aiResult = {
        placements: streamedLayout.placements,
        rationale: streamedLayout.rationale,
        model: 'mistralai/mistral-7b-instruct:floor (stream)',
      }
      streamed = true
    }
  } catch {
    aiResult = null
  }

  if (!aiResult?.placements?.length) {
    try {
      const res = await fetch('/api/coordinator/auto-arrange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        aiResult = (await res.json()) as AiAutoArrangeResponse
      }
    } catch {
      aiResult = null
    }
  }

  if (!aiResult?.placements?.length) {
    await nextAnimationFrame()
    const fallback = await deterministicFallback(doc, roomId, options)
    if (!fallback) return null
    return {
      ...fallback,
      aiOptimized: false,
      tessellationOptimized:
        'tessellationOptimized' in fallback && fallback.tessellationOptimized === true,
      winningPattern:
        'winningPattern' in fallback
          ? (fallback as { winningPattern?: RunAutoArrangeWithAiResult['winningPattern'] })
              .winningPattern
          : undefined,
    }
  }

  const sourceBooths = boothsForScope(localObjects, scope)
  const { booths: placed } = applyAiPlacementsToBooths(
    sourceBooths,
    aiResult.placements,
    localW,
    localL
  )

  const mergedDoc = mergeAiBoothsIntoDoc(
    doc,
    roomId,
    localObjects,
    placed,
    scope,
    originX,
    originY
  )

  const corrected = applyClearanceAutoCorrection(mergedDoc, { roomId })
  const prunedCount = corrected.prunedIds.length

  return {
    doc: corrected.doc,
    placedCount: Math.max(0, placed.length - prunedCount),
    droppedCount:
      Math.max(0, sourceBooths.length - placed.length) + prunedCount,
    unsatisfiedCategoryCount: 0,
    overflowCount: 0,
    removedOverlapCount: prunedCount,
    roomId,
    aiOptimized: true,
    streamed,
    aiRationale: aiResult.rationale,
    aiModel: aiResult.model,
    layoutExplanation:
      prunedCount > 0
        ? `${aiResult.rationale ?? 'AI layout'} · pruned ${prunedCount} booth${prunedCount === 1 ? '' : 's'} for ≥4′ clearance`
        : aiResult.rationale,
  }
}
