import { boothPatchForTableSize } from '@/lib/booth-planner/table-booth-consolidation'
import { tableSizeSpecFromBooth, type TableSizeSpec } from '@/lib/booth-planner/table-shape'
import type { BoothObject, PlacedObject } from './types'

export interface TableSizeChangeInput {
  objects: ReadonlyArray<PlacedObject>
  selectedIds: ReadonlySet<string>
  selection: TableSizeSpec
  /**
   * Draw-toolbar mode switches (Patron round / Booth / etc.) — only update
   * the next-placement template, never reshape the current selection.
   */
  templateOnly?: boolean
}

function boothMatchesTableSizeCategory(
  booth: BoothObject,
  selection: TableSizeSpec
): boolean {
  const current = tableSizeSpecFromBooth(booth)
  if (!current) return false
  return (
    current.purpose === selection.purpose && current.shape === selection.shape
  )
}

export interface TableSizeChangeResult {
  /** Patches to apply when at least one booth is selected. */
  objectPatches: Array<{ id: string; patch: Partial<PlacedObject> }>
  /** Set when no booth is selected — updates the placement template only. */
  nextDefaultPlacement: TableSizeSpec | null
}

/**
 * Pure table-size handler: selected booths are patched only when the new
 * spec matches their purpose + shape (e.g. 6′ → 8′ round). Switching
 * guest ↔ vendor or round ↔ rect updates the next-draw template only.
 * `templateOnly` skips patches entirely (draw-toolbar mode buttons).
 */
export function planTableSizeChange({
  objects,
  selectedIds,
  selection,
  templateOnly = false,
}: TableSizeChangeInput): TableSizeChangeResult {
  if (templateOnly) {
    return { objectPatches: [], nextDefaultPlacement: selection }
  }

  const selectedBoothIds = [...selectedIds].filter((id) => {
    const obj = objects.find((o) => o.id === id)
    if (obj?.kind !== 'booth' || obj.locked === true) return false
    return boothMatchesTableSizeCategory(obj as BoothObject, selection)
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
