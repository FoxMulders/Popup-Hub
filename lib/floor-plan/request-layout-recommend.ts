/**
 * Client orchestration for AI layout safety recommendations (active room).
 */

import { evaluateTrafficFlowPrerequisites } from '@/components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import type { TrafficFlowDoorSnapshot } from '@/components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import { resolveRoomPlacementSurface } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import { objectFootprintAabb } from '@/components/coordinator/floor-plan-v2/state/table-cluster-layout'
import type {
  BoothObject,
  DoorObject,
  FloorPlanDoc,
  PlacedObject,
} from '@/components/coordinator/floor-plan-v2/state/types'
import type {
  AiAutoArrangeFixture,
  AiTrafficFlowLoop,
} from '@/lib/floor-plan/ai-auto-arrange'
import type {
  LayoutRecommendObjectSnapshot,
  LayoutRecommendRequest,
  LayoutRecommendResponse,
} from '@/lib/floor-plan/ai-layout-recommend'

const RECOMMENDABLE_KINDS = new Set<PlacedObject['kind']>([
  'booth',
  'wall',
  'open_wall',
  'label',
  'door',
  'emergency_exit',
  'stage',
  'food_truck',
])

function toSnapshot(obj: PlacedObject): LayoutRecommendObjectSnapshot {
  const base = {
    id: obj.id,
    kind: obj.kind,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation ?? 0,
    label: obj.label,
  }
  if (obj.kind === 'booth') {
    const booth = obj as BoothObject
    return { ...base, categoryName: booth.categoryName ?? null }
  }
  return base
}

function toFixture(snap: TrafficFlowDoorSnapshot): AiAutoArrangeFixture {
  return {
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
  }
}

export function buildLayoutRecommendPayload(
  doc: FloorPlanDoc,
  roomId: string
): LayoutRecommendRequest | null {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) return null

  const surface = resolveRoomPlacementSurface(doc, roomId)
  const originX = surface?.minX ?? frame.originX
  const originY = surface?.minY ?? frame.originY
  const localW = surface ? Math.max(1, surface.maxX - surface.minX) : frame.widthFt
  const localL = surface ? Math.max(1, surface.maxY - surface.minY) : frame.lengthFt

  const objectRoom = doc.objectRoom ?? {}
  const inRoom = doc.objects.filter((o) => objectRoom[o.id] === roomId)
  const localObjects = inRoom
    .filter((o) => o.kind !== 'merged_zone' && RECOMMENDABLE_KINDS.has(o.kind))
    .map(
      (o) =>
        ({
          ...o,
          x: o.x - originX,
          y: o.y - originY,
        }) as PlacedObject
    )

  if (localObjects.length === 0) return null

  const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)
  const localEntryIds = new Set(traffic.entryDoors.map((d) => d.id))
  const localExitIds = new Set(traffic.exitDoors.map((d) => d.id))

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
        ...(o.kind === 'door'
          ? { doorType: (o as DoorObject).doorType }
          : {}),
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
    aisleWidthFt: 8,
    objects: localObjects.map(toSnapshot),
    fixtures,
    trafficFlow,
  }
}

export interface LayoutRecommendRoomContext {
  originX: number
  originY: number
  roomId: string
}

export function getLayoutRecommendRoomContext(
  doc: FloorPlanDoc,
  roomId: string
): LayoutRecommendRoomContext | null {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) return null
  const surface = resolveRoomPlacementSurface(doc, roomId)
  return {
    roomId,
    originX: surface?.minX ?? frame.originX,
    originY: surface?.minY ?? frame.originY,
  }
}

export async function requestLayoutRecommend(
  doc: FloorPlanDoc,
  roomId: string
): Promise<LayoutRecommendResponse> {
  const payload = buildLayoutRecommendPayload(doc, roomId)
  if (!payload) {
    throw new Error('No placeable objects in the active room')
  }

  const res = await fetch('/api/layout/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const json = (await res.json()) as LayoutRecommendResponse & {
    error?: string
    code?: string
  }

  if (!res.ok) {
    if (json.code === 'AI_UNAVAILABLE') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[layout/recommend] OpenRouter is not configured — set OPENROUTER_API_KEY in .env.local'
        )
      }
      throw new Error('AI is not configured — contact your administrator.')
    }
    throw new Error(json.error ?? 'Layout recommendation request failed')
  }

  return json
}

/** Apply recommended room-local coordinates back onto the full FloorPlanDoc. */
export function mergeRecommendedIntoDoc(
  doc: FloorPlanDoc,
  roomId: string,
  recommendedObjects: LayoutRecommendObjectSnapshot[]
): FloorPlanDoc {
  const ctx = getLayoutRecommendRoomContext(doc, roomId)
  if (!ctx) return doc

  const byId = new Map(recommendedObjects.map((o) => [o.id, o]))
  const objectRoom = doc.objectRoom ?? {}

  const objects = doc.objects.map((obj) => {
    if (objectRoom[obj.id] !== roomId) return obj
    const rec = byId.get(obj.id)
    if (!rec) return obj
    return {
      ...obj,
      x: rec.x + ctx.originX,
      y: rec.y + ctx.originY,
      rotation: rec.rotation ?? obj.rotation,
    } as PlacedObject
  })

  return { ...doc, objects }
}
