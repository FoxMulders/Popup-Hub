import {
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { BOOTH_EQUIPMENT_DEPTH_FT } from '@/lib/booth-planner/table-space'
import {
  isTentVendor,
  TENT_VENDOR_FOOTPRINT_FT,
} from '@/lib/booth-planner/vendor-unit-types'

/** Vendor folding tables vs guest seating (round or banquet rect). */
export type TablePurpose = 'vendor' | 'guest'

/** Market table footprint — folding tables, tent canopy, or banquet rounds. */
export type TableShape = 'rectangular' | 'round' | 'tent'

export const DEFAULT_TABLE_SHAPE: TableShape = 'rectangular'
export const DEFAULT_TABLE_PURPOSE: TablePurpose = 'vendor'

/** Guest seating tables (round or rectangular) — not vendor booth units. */
export const GUEST_TABLE_LENGTHS_FT = [5, 6, 8] as const

/** @deprecated Use {@link GUEST_TABLE_LENGTHS_FT}. */
export const ROUND_TABLE_DIAMETERS_FT = GUEST_TABLE_LENGTHS_FT

export type GuestTableLengthFt = (typeof GUEST_TABLE_LENGTHS_FT)[number]

/** @deprecated Use {@link GuestTableLengthFt}. */
export type RoundTableDiameterFt = GuestTableLengthFt

/** Standard banquet rectangular table depth (30″). */
export const GUEST_RECTANGULAR_TABLE_DEPTH_FT = 2.5

export interface TableSizeSpec {
  purpose: TablePurpose
  shape: TableShape
  /** Table length (rectangular) or diameter (round), in feet. */
  ft: number
}

export function vendorTableSpec(ft: LayoutBaselineTableLengthFt): TableSizeSpec {
  return { purpose: 'vendor', shape: 'rectangular', ft }
}

export function guestRoundTableSpec(ft: GuestTableLengthFt): TableSizeSpec {
  return { purpose: 'guest', shape: 'round', ft }
}

export function guestRectTableSpec(ft: GuestTableLengthFt): TableSizeSpec {
  return { purpose: 'guest', shape: 'rectangular', ft }
}

export function tentVendorSpec(): TableSizeSpec {
  return { purpose: 'vendor', shape: 'tent', ft: TENT_VENDOR_FOOTPRINT_FT }
}

export function isTentTableSpec(spec: TableSizeSpec): boolean {
  return spec.purpose === 'vendor' && spec.shape === 'tent'
}

export function isGuestTableLengthFt(ft: number): ft is GuestTableLengthFt {
  return (GUEST_TABLE_LENGTHS_FT as readonly number[]).includes(ft)
}

/** @deprecated Use {@link isGuestTableLengthFt}. */
export function isRoundTableDiameterFt(ft: number): ft is GuestTableLengthFt {
  return isGuestTableLengthFt(ft)
}

export function tableSizeSpecsEqual(a: TableSizeSpec, b: TableSizeSpec): boolean {
  return a.purpose === b.purpose && a.shape === b.shape && a.ft === b.ft
}

export function isTentBooth(input: {
  vendorUnitType?: 'table' | 'tent' | null
  tableShape?: TableShape | null
  width?: number
  height?: number
}): boolean {
  if (isTentVendor(input.vendorUnitType)) return true
  if (input.tableShape === 'tent') return true
  const w = input.width ?? 0
  const h = input.height ?? 0
  return (
    Math.abs(w - TENT_VENDOR_FOOTPRINT_FT) < 0.05 &&
    Math.abs(h - TENT_VENDOR_FOOTPRINT_FT) < 0.05
  )
}

export function resolveTablePurpose(input: {
  tablePurpose?: TablePurpose | null
  tableShape?: TableShape | null
}): TablePurpose {
  if (input.tablePurpose === 'guest' || input.tablePurpose === 'vendor') {
    return input.tablePurpose
  }
  if (input.tableShape === 'round') return 'guest'
  return DEFAULT_TABLE_PURPOSE
}

/** Guest / patron seating tables — excluded from vendor consolidation and grid layout. */
export function isGuestTableBooth(input: {
  tablePurpose?: TablePurpose | null
  tableShape?: TableShape | null
}): boolean {
  return resolveTablePurpose(input) === 'guest'
}

export function boothDimensionsForTable(input: {
  tableLengthFt: number
  tableShape?: TableShape | null
  tablePurpose?: TablePurpose | null
}): { width: number; height: number } {
  const purpose = resolveTablePurpose(input)
  const shape = input.tableShape ?? DEFAULT_TABLE_SHAPE

  if (purpose === 'vendor' && shape === 'tent') {
    return { width: TENT_VENDOR_FOOTPRINT_FT, height: TENT_VENDOR_FOOTPRINT_FT }
  }

  const ft = Math.max(1, Math.round(input.tableLengthFt))

  if (purpose === 'guest' && shape === 'round') {
    return { width: ft, height: ft }
  }
  if (purpose === 'guest' && shape === 'rectangular') {
    return { width: ft, height: GUEST_RECTANGULAR_TABLE_DEPTH_FT }
  }
  return { width: ft, height: BOOTH_EQUIPMENT_DEPTH_FT }
}

export function formatTableSizeLabel(spec: TableSizeSpec): string {
  if (isTentTableSpec(spec)) return 'Tent 10×10'
  if (spec.purpose === 'guest' && spec.shape === 'round') {
    return `${spec.ft}′ round`
  }
  if (spec.purpose === 'guest' && spec.shape === 'rectangular') {
    return `${spec.ft}′ rect`
  }
  return `${spec.ft}′ booth`
}

function dimensionsMatch(a: number, b: number, tolerance = 0.05): boolean {
  return Math.abs(a - b) <= tolerance
}

export function tableSizeSpecFromBooth(input: {
  vendorUnitType?: 'table' | 'tent' | null
  tableLengthFt?: number | null
  tableShape?: TableShape | null
  tablePurpose?: TablePurpose | null
  width: number
  height: number
}): TableSizeSpec | null {
  if (isTentBooth(input)) return tentVendorSpec()

  const purpose = resolveTablePurpose(input)
  const shape = input.tableShape ?? (purpose === 'guest' ? 'round' : 'rectangular')

  if (
    purpose === 'guest' &&
    shape === 'round' &&
    input.tableLengthFt != null &&
    isGuestTableLengthFt(input.tableLengthFt)
  ) {
    return guestRoundTableSpec(input.tableLengthFt)
  }

  if (
    purpose === 'guest' &&
    shape === 'rectangular' &&
    input.tableLengthFt != null &&
    isGuestTableLengthFt(input.tableLengthFt)
  ) {
    return guestRectTableSpec(input.tableLengthFt)
  }

  if (
    Math.abs(input.width - input.height) < 0.01 &&
    isGuestTableLengthFt(input.width)
  ) {
    return guestRoundTableSpec(input.width)
  }

  const longEdge = Math.max(input.width, input.height)
  const shortEdge = Math.min(input.width, input.height)

  if (
    isGuestTableLengthFt(longEdge) &&
    dimensionsMatch(shortEdge, GUEST_RECTANGULAR_TABLE_DEPTH_FT)
  ) {
    return guestRectTableSpec(longEdge)
  }

  if (
    input.tableLengthFt != null &&
    isLayoutBaselineTableLengthFt(input.tableLengthFt) &&
    purpose !== 'guest'
  ) {
    return vendorTableSpec(input.tableLengthFt)
  }

  if (isLayoutBaselineTableLengthFt(longEdge) && dimensionsMatch(shortEdge, BOOTH_EQUIPMENT_DEPTH_FT)) {
    return vendorTableSpec(longEdge)
  }

  return null
}

export function normalizeTableSizeSpec(
  spec: TableSizeSpec,
  fallbackFt: LayoutBaselineTableLengthFt
): TableSizeSpec {
  if (isTentTableSpec(spec)) return tentVendorSpec()

  if (spec.purpose === 'guest') {
    if (spec.shape === 'round' && isGuestTableLengthFt(spec.ft)) {
      return guestRoundTableSpec(spec.ft)
    }
    if (spec.shape === 'rectangular' && isGuestTableLengthFt(spec.ft)) {
      return guestRectTableSpec(spec.ft)
    }
    return guestRoundTableSpec(6)
  }

  if (isLayoutBaselineTableLengthFt(spec.ft)) {
    return vendorTableSpec(spec.ft)
  }
  return vendorTableSpec(fallbackFt)
}
