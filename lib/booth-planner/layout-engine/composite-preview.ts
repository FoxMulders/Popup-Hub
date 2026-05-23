import {
  calculateCompositeFootprint,
  type CompositeFootprintCell,
} from '@/lib/booth-planner/composite-footprint'

export interface CompositePreviewInput {
  boothRow: number
  boothCol: number
  rowSpan: number
  colSpan: number
  rows: number
  cols: number
  obstructed: Set<string>
  occupied: Set<string>
}

export interface CompositePreviewResult {
  cells: CompositeFootprintCell[]
  valid: boolean
  invalidReason?: string
}

function cellKey(row: number, col: number): string {
  return `${row}-${col}`
}

function boothCoreInBounds(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  return (
    boothRow >= 0 &&
    boothCol >= 0 &&
    boothRow + rowSpan <= rows &&
    boothCol + colSpan <= cols
  )
}

/** Equipment footprint + uniform 2′ side buffers preview with collision validation. */
export function evaluateCompositePlacement(
  input: CompositePreviewInput
): CompositePreviewResult {
  const {
    boothRow,
    boothCol,
    rowSpan,
    colSpan,
    rows,
    cols,
    obstructed,
    occupied,
  } = input

  if (!boothCoreInBounds(boothRow, boothCol, rowSpan, colSpan, rows, cols)) {
    return {
      cells: [],
      valid: false,
      invalidReason: 'Booth extends outside grid',
    }
  }

  const cells = calculateCompositeFootprint(
    boothRow,
    boothCol,
    rowSpan,
    colSpan,
    rows,
    cols
  )

  for (const cell of cells) {
    const key = cellKey(cell.r, cell.c)
    if (obstructed.has(key)) {
      return {
        cells,
        valid: false,
        invalidReason: 'Overlaps wall or locked fixture',
      }
    }
    if (occupied.has(key)) {
      return {
        cells,
        valid: false,
        invalidReason: 'Overlaps existing booth',
      }
    }
  }

  return { cells, valid: true }
}
