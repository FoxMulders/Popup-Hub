/**
 * Destructive boolean Merge: replace selected shapes with one `merged_zone` (simple AABB).
 */

import {
  clockwiseRectRing,
  sanitizeMergedZone,
  unionParticipantBounds,
} from './geometry-sanitize'
import type { FloorPlanDoc, MergedZoneObject, PlacedObject } from './types'

/** Kinds eligible for geometric union (not booths — use room Join). */
export const MERGE_UNION_KINDS = new Set<PlacedObject['kind']>([
  'wall',
  'open_wall',
  'stage',
  'door',
  'emergency_exit',
  'label',
])

export function isMergeUnionEligible(obj: PlacedObject): boolean {
  return MERGE_UNION_KINDS.has(obj.kind) && !obj.locked
}

export function mergeUnionSelectionInDoc(
  doc: FloorPlanDoc,
  objectIds: ReadonlyArray<string>
): { doc: FloorPlanDoc; mergedId: string | null; reason?: string } {
  const idSet = new Set(objectIds)
  const targets = doc.objects.filter((o) => idSet.has(o.id))
  const eligible = targets.filter(isMergeUnionEligible)

  if (eligible.length < 2) {
    return {
      doc,
      mergedId: null,
      reason:
        eligible.length === 0
          ? 'Select two or more walls, stages, doors, or labels to merge'
          : 'Need at least two unlocked shapes to merge',
    }
  }

  const union = unionParticipantBounds([], eligible)
  if (!union) {
    return { doc, mergedId: null, reason: 'Could not compute a union path' }
  }

  const minX = union.minX
  const minY = union.minY
  const width = Math.max(doc.snapFt || 1, union.maxX - union.minX)
  const height = Math.max(doc.snapFt || 1, union.maxY - union.minY)
  const primary = eligible[0]!
  const localRing = clockwiseRectRing(0, 0, width, height).map(([x, y]) => [x, y])

  const mergedId = `obj-${crypto.randomUUID()}`
  const merged: MergedZoneObject = sanitizeMergedZone({
    id: mergedId,
    kind: 'merged_zone',
    x: minX,
    y: minY,
    width,
    height,
    rotation: 0,
    label: primary.label,
    rings: [localRing],
    fill: accentForPrimary(primary),
    stroke: '#1c1917',
    mergedFromIds: eligible.map((o) => o.id),
  })

  const removeIds = new Set(eligible.map((o) => o.id))
  const objectRoom = { ...(doc.objectRoom ?? {}) }
  for (const id of removeIds) {
    delete objectRoom[id]
  }
  const ownerRoom = doc.objectRoom?.[primary.id]
  if (ownerRoom) objectRoom[mergedId] = ownerRoom

  const nextObjects = [
    ...doc.objects.filter((o) => !removeIds.has(o.id)),
    merged,
  ]

  return {
    doc: { ...doc, objects: nextObjects, objectRoom },
    mergedId,
  }
}

function accentForPrimary(obj: PlacedObject): string {
  if (obj.kind === 'stage') return '#0f766e'
  if (obj.kind === 'door' || obj.kind === 'emergency_exit') return '#b45309'
  if (obj.kind === 'open_wall') return '#78716c'
  if (obj.kind === 'label') return '#1c1917'
  return '#57534e'
}
