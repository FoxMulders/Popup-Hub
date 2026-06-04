import { boothPatchForTableSize } from '@/lib/booth-planner/table-booth-consolidation'
import type { TableSizeSpec } from '@/lib/booth-planner/table-shape'
import type { BoothObject, PlacedObject } from './types'

export interface TableSizeChangeInput {
  objects: ReadonlyArray<PlacedObject>
  selectedIds: ReadonlySet<string>
  selection: TableSizeSpec
}

export interface TableSizeChangeResult {
  /** Patches to apply when at least one booth is selected. */
  objectPatches: Array<{ id: string; patch: Partial<PlacedObject> }>
  /** Set when no booth is selected — updates the placement template only. */
  nextDefaultPlacement: TableSizeSpec | null
}

/**
 * Pure table-size handler: selected booths get individual patches;
 * otherwise only the default placement spec changes (no global rescale).
 */
export function planTableSizeChange({
  objects,
  selectedIds,
  selection,
}: TableSizeChangeInput): TableSizeChangeResult {
  const selectedBoothIds = [...selectedIds].filter((id) => {
    const obj = objects.find((o) => o.id === id)
    return obj?.kind === 'booth' && obj.locked !== true
  })

  if (selectedBoothIds.length > 0) {
    return {
      objectPatches: selectedBoothIds.map((id) => {
        const booth = objects.find((o) => o.id === id) as BoothObject
        return { id, patch: boothPatchForTableSize(booth, selection) }
      }),
      nextDefaultPlacement: null,
    }
  }

  return { objectPatches: [], nextDefaultPlacement: selection }
}

/** Immutable apply — mirrors `use-floor-plan-doc` `updateObjects`. */
export function applyObjectPatches(
  objects: ReadonlyArray<PlacedObject>,
  patches: Array<{ id: string; patch: Partial<PlacedObject> }>
): PlacedObject[] {
  if (patches.length === 0) return [...objects]
  const patchById = new Map(patches.map((p) => [p.id, p.patch]))
  return objects.map((o) => {
    const patch = patchById.get(o.id)
    if (!patch) return o
    return { ...o, ...patch } as PlacedObject
  })
}
