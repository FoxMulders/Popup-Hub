/** Market-provided tables: equipment core uses uniform 2′ safety buffers on all sides. */

export const TABLE_BOOTH_WIDTH_FT = 4
/** @deprecated Legacy asymmetric depth — table_provided spacing mode only. */
export const TABLE_DEPTH_LEADING_FT = 4
/** @deprecated Legacy asymmetric depth — table_provided spacing mode only. */
export const TABLE_LENGTH_BUFFER_FT = 3

/** Grid cell size when using table-provided spacing (1' rows for precise depth). */
export const TABLE_GRID_CELL_WIDTH_FT = 4
export const TABLE_GRID_CELL_LENGTH_FT = 1

/** @deprecated Use `TABLE_SIZES` from `layout-table-size` — kept for legacy table_provided math. */
export const TABLE_LENGTH_OPTIONS_FT = [5, 6, 7, 8, 9, 10] as const

export type LayoutSpacingMode = 'standard' | 'table_provided' | 'one_foot'

/** Core equipment footprint depth (table + immediate vendor pocket) on the 1′ grid. */
export const BOOTH_EQUIPMENT_DEPTH_FT = 2

/** Co-generated shopper aisle depth paired flush to booth front. */
export const BOOTH_SHOPPER_AISLE_DEPTH_FT = 2

/** Equipment + mandatory front aisle — used for capacity and spacing math. */
export const BOOTH_OPERATIONAL_DEPTH_FT =
  BOOTH_EQUIPMENT_DEPTH_FT + BOOTH_SHOPPER_AISLE_DEPTH_FT

/** Market table unit on 1′ grid: table length × 2′ equipment depth (aisle stays open/co-generated). */
export function marketUnitGridSpans(tableLengthFt: number = 6): {
  colSpan: number
  rowSpan: number
} {
  return {
    colSpan: Math.max(1, Math.round(tableLengthFt)),
    rowSpan: BOOTH_EQUIPMENT_DEPTH_FT,
  }
}

/** Booth depth in feet: 4' + table length + 3'. */
export function tableBoothDepthFeet(tableLengthFt: number): number {
  return TABLE_DEPTH_LEADING_FT + tableLengthFt + TABLE_LENGTH_BUFFER_FT
}

export function tableBoothFootprint(tableLengthFt: number): {
  widthFt: number
  depthFt: number
  label: string
} {
  const depthFt = tableBoothDepthFeet(tableLengthFt)
  return {
    widthFt: TABLE_BOOTH_WIDTH_FT,
    depthFt,
    label: `${tableLengthFt}' table → (${TABLE_DEPTH_LEADING_FT}'+${tableLengthFt}'+${TABLE_LENGTH_BUFFER_FT}')×${TABLE_BOOTH_WIDTH_FT}'`,
  }
}

/** Convert real-world feet into grid spans for the table-provided layout grid. */
export function tableFootprintToGridSpans(tableLengthFt: number): {
  colSpan: number
  rowSpan: number
} {
  const depthFt = tableBoothDepthFeet(tableLengthFt)
  return {
    colSpan: Math.max(1, Math.ceil(TABLE_BOOTH_WIDTH_FT / TABLE_GRID_CELL_WIDTH_FT)),
    rowSpan: Math.max(1, Math.ceil(depthFt / TABLE_GRID_CELL_LENGTH_FT)),
  }
}

export function formatTableFootprint(tableLengthFt: number): string {
  const depthFt = tableBoothDepthFeet(tableLengthFt)
  return `(${TABLE_DEPTH_LEADING_FT}'+${tableLengthFt}'+${TABLE_LENGTH_BUFFER_FT}')×${TABLE_BOOTH_WIDTH_FT}' (${depthFt}'×${TABLE_BOOTH_WIDTH_FT}')`
}
