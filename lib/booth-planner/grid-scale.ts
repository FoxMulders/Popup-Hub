/** Real-world size labels for the layout planner grid. */

export interface GridScaleInfo {
  cellWidthFt: number
  cellLengthFt: number
  cols: number
  rows: number
  gridWidthFt: number
  gridLengthFt: number
  venueWidthFt: number
  venueLengthFt: number
  widthRemainderFt: number
  lengthRemainderFt: number
}

export function computeGridScale(
  venueWidthFt: number,
  venueLengthFt: number,
  boothWidthFt: number,
  boothLengthFt: number
): GridScaleInfo {
  const cols = Math.max(1, Math.floor(venueWidthFt / boothWidthFt))
  const rows = Math.max(1, Math.floor(venueLengthFt / boothLengthFt))
  const gridWidthFt = cols * boothWidthFt
  const gridLengthFt = rows * boothLengthFt
  return {
    cellWidthFt: boothWidthFt,
    cellLengthFt: boothLengthFt,
    cols,
    rows,
    gridWidthFt,
    gridLengthFt,
    venueWidthFt,
    venueLengthFt,
    widthRemainderFt: Math.max(0, venueWidthFt - gridWidthFt),
    lengthRemainderFt: Math.max(0, venueLengthFt - gridLengthFt),
  }
}

export function formatCellSize(cellWidthFt: number, cellLengthFt: number): string {
  if (cellWidthFt === cellLengthFt) {
    return `${cellWidthFt}′ × ${cellLengthFt}′`
  }
  return `${cellWidthFt}′ wide × ${cellLengthFt}′ deep`
}

export function formatBoothFootprint(
  colSpan: number,
  rowSpan: number,
  cellWidthFt: number,
  cellLengthFt: number
): string {
  const w = colSpan * cellWidthFt
  const d = rowSpan * cellLengthFt
  return `${w}′ × ${d}′`
}

export function describeGridScale(scale: GridScaleInfo): string {
  const cell = formatCellSize(scale.cellWidthFt, scale.cellLengthFt)
  const grid = `${scale.gridWidthFt}′ × ${scale.gridLengthFt}′`
  const cells = `${scale.cols} × ${scale.rows} cells`
  let text = `Each grid cell = ${cell}. Layout area on grid = ${grid} (${cells}).`
  const parts: string[] = []
  if (scale.widthRemainderFt > 0) {
    parts.push(`${scale.widthRemainderFt}′ unused along width`)
  }
  if (scale.lengthRemainderFt > 0) {
    parts.push(`${scale.lengthRemainderFt}′ unused along length`)
  }
  if (parts.length > 0) {
    text += ` Venue is ${scale.venueWidthFt}′ × ${scale.venueLengthFt}′ — ${parts.join('; ')}.`
  }
  return text
}
