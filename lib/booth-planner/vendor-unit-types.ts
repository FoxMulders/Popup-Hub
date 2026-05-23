import type { LayoutSpacingMode } from '@/types/database'
import type { LayoutPreset } from '@/lib/booth-planner/layout-presets'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  gridSpansForTableLength,
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import type { TableOrientation } from '@/lib/booth-planner/table-orientation'

/** Table vendors use market-provided tables; tent vendors use a fixed outdoor footprint. */
export type VendorUnitType = 'table' | 'tent'

export const TENT_VENDOR_FOOTPRINT_FT = 10

export function isOutdoorLayoutPreset(preset: LayoutPreset): boolean {
  return preset === 'outdoor'
}

export function isTentVendor(unitType?: VendorUnitType | null): boolean {
  return unitType === 'tent'
}

/** 10×10 ft tent on the 1′ high-res grid. */
export function tentVendorGridSpans(): { colSpan: number; rowSpan: number } {
  return {
    colSpan: TENT_VENDOR_FOOTPRINT_FT,
    rowSpan: TENT_VENDOR_FOOTPRINT_FT,
  }
}

export function tentVendorsAllowed(
  preset: LayoutPreset,
  spacingMode: LayoutSpacingMode,
  isIndoorVenue = false
): boolean {
  if (isIndoorVenue) return false
  return isOutdoorLayoutPreset(preset) && spacingMode === 'one_foot'
}

export interface VendorGridSpanInput {
  unitType?: VendorUnitType | null
  tableLengthFt?: number | null
  spacingMode: LayoutSpacingMode
  tableOrientation?: TableOrientation | null
}

export function resolveVendorGridSpans(input: VendorGridSpanInput): {
  colSpan: number
  rowSpan: number
  tableLengthFt: number | null
  vendorUnitType: VendorUnitType
} {
  if (isTentVendor(input.unitType)) {
    const { colSpan, rowSpan } = tentVendorGridSpans()
    return { colSpan, rowSpan, tableLengthFt: null, vendorUnitType: 'tent' }
  }

  const ftRaw = input.tableLengthFt ?? DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  const ft: LayoutBaselineTableLengthFt = isLayoutBaselineTableLengthFt(ftRaw)
    ? ftRaw
    : DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  const { colSpan, rowSpan } = gridSpansForTableLength(ft, input.spacingMode, input.tableOrientation)

  return {
    colSpan,
    rowSpan,
    tableLengthFt: input.spacingMode === 'standard' ? null : ft,
    vendorUnitType: 'table',
  }
}

export function vendorUnitLabel(
  unitType?: VendorUnitType | null,
  tableLengthFt?: number | null,
  tableOrientation?: TableOrientation | null
): string {
  if (isTentVendor(unitType)) return 'Tent 10×10'
  if (tableLengthFt != null) {
    if (tableOrientation) {
      const axis = tableOrientation === 'horizontal' ? 'E-W' : 'N-S'
      return `${tableLengthFt}′ table ${axis}`
    }
    return `${tableLengthFt}′ table`
  }
  return 'Table'
}
