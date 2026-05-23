import type { BoothCell } from '@/types/database'
import type { LayoutSpacingMode } from '@/types/database'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  gridSpansForTableLength,
} from '@/lib/booth-planner/layout-table-size'
import { isTentVendor, resolveVendorGridSpans } from '@/lib/booth-planner/vendor-unit-types'

export interface VenueTableFootprintInput {
  spacingMode: LayoutSpacingMode
  baselineTableLengthFt?: number
  vendorUnitType?: BoothCell['vendorUnitType']
  tableOrientation?: BoothCell['tableOrientation']
}

/** One table size per venue — equipment footprint for every table vendor in the hall. */
export function resolveVenueTableFootprint(input: VenueTableFootprintInput): {
  colSpan: number
  rowSpan: number
  tableLengthFt: number | null
} {
  if (isTentVendor(input.vendorUnitType)) {
    return resolveVendorGridSpans({
      unitType: 'tent',
      spacingMode: input.spacingMode,
    })
  }

  const tableLengthFt =
    input.baselineTableLengthFt ?? DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  const spans = gridSpansForTableLength(
    tableLengthFt,
    input.spacingMode,
    input.tableOrientation
  )

  return {
    colSpan: spans.colSpan,
    rowSpan: spans.rowSpan,
    tableLengthFt,
  }
}

/** True when a placed booth's spans disagree with the venue baseline table length. */
export function venueFootprintMismatch(
  cell: Pick<
    BoothCell,
    'vendorUnitType' | 'tableOrientation' | 'colSpan' | 'rowSpan'
  >,
  spacingMode: LayoutSpacingMode,
  baselineTableLengthFt: number
): boolean {
  if (isTentVendor(cell.vendorUnitType)) return false
  const expected = resolveVenueTableFootprint({
    spacingMode,
    baselineTableLengthFt,
    vendorUnitType: cell.vendorUnitType,
    tableOrientation: cell.tableOrientation,
  })
  return cell.colSpan !== expected.colSpan || cell.rowSpan !== expected.rowSpan
}
