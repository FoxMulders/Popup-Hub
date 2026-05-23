import type { BoothCell } from '@/types/database'
import type { LayoutSpacingMode } from '@/types/database'
import { TABLE_LENGTH_OPTIONS_FT } from '@/lib/booth-planner/table-space'
import { isTentVendor, resolveVendorGridSpans } from '@/lib/booth-planner/vendor-unit-types'
import { DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT } from '@/lib/booth-planner/layout-table-size'

export const VENDOR_TABLE_LENGTH_MIN_FT = TABLE_LENGTH_OPTIONS_FT[0]
export const VENDOR_TABLE_LENGTH_MAX_FT = TABLE_LENGTH_OPTIONS_FT[TABLE_LENGTH_OPTIONS_FT.length - 1]

/** Clamp vendor table length to supported 5′–10′ market tables. */
export function clampVendorTableLengthFt(
  ft: number | null | undefined,
  fallback: number = DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
): number {
  const raw = ft ?? fallback
  const rounded = Math.round(raw)
  return Math.min(VENDOR_TABLE_LENGTH_MAX_FT, Math.max(VENDOR_TABLE_LENGTH_MIN_FT, rounded))
}

export function isSupportedVendorTableLengthFt(ft: number): boolean {
  return (TABLE_LENGTH_OPTIONS_FT as readonly number[]).includes(ft)
}

/** Locked equipment footprint for a vendor — never borrow the market baseline when tableLengthFt is set. */
export function resolveVendorPersonaFootprint(
  cell: Pick<
    BoothCell,
    'vendorUnitType' | 'tableLengthFt' | 'tableOrientation' | 'colSpan' | 'rowSpan'
  >,
  spacingMode: LayoutSpacingMode,
  options?: { baselineTableLengthFt?: number }
): {
  colSpan: number
  rowSpan: number
  tableLengthFt: number | null
} {
  if (isTentVendor(cell.vendorUnitType)) {
    return resolveVendorGridSpans({
      unitType: 'tent',
      spacingMode,
    })
  }

  const tableLengthFt = clampVendorTableLengthFt(
    cell.tableLengthFt,
    options?.baselineTableLengthFt ?? DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  )

  const spans = resolveVendorGridSpans({
    unitType: 'table',
    tableLengthFt,
    spacingMode,
    tableOrientation: cell.tableOrientation,
  })

  return {
    colSpan: spans.colSpan,
    rowSpan: spans.rowSpan,
    tableLengthFt: spans.tableLengthFt,
  }
}

/** True when stored spans disagree with the vendor's assigned table length. */
export function vendorFootprintMismatch(
  cell: Pick<
    BoothCell,
    'vendorUnitType' | 'tableLengthFt' | 'tableOrientation' | 'colSpan' | 'rowSpan'
  >,
  spacingMode: LayoutSpacingMode,
  options?: { baselineTableLengthFt?: number }
): boolean {
  if (isTentVendor(cell.vendorUnitType)) return false
  const expected = resolveVendorPersonaFootprint(cell, spacingMode, options)
  return cell.colSpan !== expected.colSpan || cell.rowSpan !== expected.rowSpan
}
