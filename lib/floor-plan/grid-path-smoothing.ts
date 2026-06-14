/**
 * Grid path smoothing — Bresenham line-of-sight and string-pull for
 * cardinal A* paths on walkability grids.
 */

export interface GridCell {
  col: number
  row: number
}

/** All cells on the Bresenham line from a to b must be walkable. */
export function hasGridLineOfSight(
  walkable: boolean[][],
  a: GridCell,
  b: GridCell,
  cols: number,
  rows: number
): boolean {
  let x0 = a.col
  let y0 = a.row
  const x1 = b.col
  const y1 = b.row
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    if (x0 < 0 || y0 < 0 || x0 >= cols || y0 >= rows) return false
    if (!walkable[y0]![x0]) return false
    if (x0 === x1 && y0 === y1) break
    const e2 = err * 2
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }
  return true
}

/** Remove intermediate grid cells when a direct LOS shortcut exists. */
export function stringPullGridPath(
  path: GridCell[],
  walkable: boolean[][],
  cols: number,
  rows: number
): GridCell[] {
  if (path.length <= 2) return path

  const out: GridCell[] = [path[0]!]
  let anchor = 0

  for (let i = 2; i < path.length; i++) {
    if (!hasGridLineOfSight(walkable, path[anchor]!, path[i]!, cols, rows)) {
      out.push(path[i - 1]!)
      anchor = i - 1
    }
  }
  out.push(path[path.length - 1]!)
  return out
}

/** True when every cell on the path is walkable. */
export function gridPathIsWalkable(
  path: GridCell[],
  walkable: boolean[][],
  rows: number,
  cols: number
): boolean {
  return path.every(
    (c) =>
      c.row >= 0 &&
      c.col >= 0 &&
      c.row < rows &&
      c.col < cols &&
      walkable[c.row]![c.col]
  )
}
