import type { BoothCell, LayoutSpacingMode } from '@/types/database'
import { isTentVendor } from '@/lib/booth-planner/vendor-unit-types'
import { gridSpansForTableOrientation, type TableOrientation } from '@/lib/booth-planner/table-orientation'
import { resolveVendorPersonaFootprint } from '@/lib/booth-planner/vendor-footprint'

export interface VendorCellSource {
  id: string
  vendorName: string
  categoryName: string
  categoryColor: string
  colSpan: number
  rowSpan: number
  vendorUnitType?: 'table' | 'tent'
  tableLengthFt?: number | null
  tableOrientation?: TableOrientation | null
}

/** Ensure every visible vendor has a cell entry (unplaced if not on grid yet). */
export function syncCellsWithVendors(
  vendors: VendorCellSource[],
  cells: BoothCell[],
  options?: { hiddenIds?: Set<string>; spacingMode?: LayoutSpacingMode }
): BoothCell[] {
  const hidden = options?.hiddenIds ?? new Set<string>()
  const spacingMode = options?.spacingMode ?? 'one_foot'
  const visibleVendors = vendors.filter((v) => !hidden.has(v.id))
  const visibleCells = cells.filter((c) => !hidden.has(c.id))
  const byId = new Map(visibleCells.map((c) => [c.id, c]))
  const maxBooth = visibleCells.reduce((m, c) => Math.max(m, c.boothNumber), 0)
  let nextNumber = maxBooth + 1

  return visibleVendors.map((v) => {
    const existing = byId.get(v.id)
    const placed = existing != null && existing.col >= 0
    const vendorUnitType = v.vendorUnitType ?? existing?.vendorUnitType ?? 'table'
    const tableLengthFt = isTentVendor(vendorUnitType)
      ? null
      : (v.tableLengthFt ?? existing?.tableLengthFt ?? null)
    const tableOrientation = placed
      ? (v.tableOrientation ?? existing?.tableOrientation ?? null)
      : null

    let colSpan = v.colSpan
    let rowSpan = v.rowSpan

    if (!placed && !isTentVendor(vendorUnitType)) {
      const locked = resolveVendorPersonaFootprint(
        {
          vendorUnitType,
          tableLengthFt,
          tableOrientation: null,
          colSpan,
          rowSpan,
        },
        spacingMode
      )
      if (v.colSpan <= locked.colSpan) {
        colSpan = locked.colSpan
        rowSpan = locked.rowSpan
      }
    } else if (existing && existing.col >= 0) {
      if (tableOrientation && tableLengthFt != null && !isTentVendor(vendorUnitType)) {
        const unit = resolveVendorPersonaFootprint(
          {
            vendorUnitType,
            tableLengthFt,
            tableOrientation,
            colSpan: existing.colSpan,
            rowSpan: existing.rowSpan,
          },
          spacingMode
        )
        const slotCount = Math.max(1, Math.round(existing.colSpan / unit.colSpan))
        const oriented = gridSpansForTableOrientation(tableLengthFt, spacingMode, tableOrientation)
        colSpan = oriented.colSpan * slotCount
        rowSpan = oriented.rowSpan
      } else if (!tableOrientation) {
        colSpan = existing.colSpan
        rowSpan = existing.rowSpan
      }
    }

    if (existing) {
      return {
        ...existing,
        vendorName: v.vendorName,
        categoryName: v.categoryName,
        categoryColor: v.categoryColor,
        colSpan,
        rowSpan,
        vendorUnitType,
        tableLengthFt,
        tableOrientation: placed ? tableOrientation : null,
        facingTarget: placed ? existing.facingTarget ?? null : null,
      }
    }
    return {
      id: v.id,
      col: -1,
      row: -1,
      colSpan,
      rowSpan,
      vendorName: v.vendorName,
      categoryName: v.categoryName,
      categoryColor: v.categoryColor,
      boothNumber: nextNumber++,
      vendorUnitType,
      tableLengthFt,
      tableOrientation: null,
      facingTarget: null,
    }
  })
}

export function nextBoothNumber(cells: BoothCell[]): number {
  const placed = cells.filter((c) => c.col >= 0 && c.boothNumber > 0)
  if (placed.length === 0) return 1
  return Math.max(...placed.map((c) => c.boothNumber)) + 1
}
