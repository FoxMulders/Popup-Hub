/**
 * Destructive boolean Merge: replace selected shapes with one `merged_zone`.
 */

import {
  ringsToLocalSpace,
  unionPlacedObjectFootprints,
} from '@/lib/floor-plan/shape-union'
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

  const union = unionPlacedObjectFootprints(eligible)
  if (!union || union.rings.length === 0) {
    return { doc, mergedId: null, reason: 'Could not compute a union path' }
  }

  const { minX, minY, maxX, maxY } = union.aabb
  const width = Math.max(doc.snapFt || 1, maxX - minX)
  const height = Math.max(doc.snapFt || 1, maxY - minY)
  const primary = eligible[0]!
  const localRings = ringsToLocalSpace(union.rings, minX, minY)

  const mergedId = `obj-${crypto.randomUUID()}`
  const merged: MergedZoneObject = {
    id: mergedId,
    kind: 'merged_zone',
    x: minX,
    y: minY,
    width,
    height,
    rotation: 0,
    label: primary.label,
    rings: localRings,
    fill: accentForPrimary(primary),
    stroke: '#1c1917',
    mergedFromIds: eligible.map((o) => o.id),
  }

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
