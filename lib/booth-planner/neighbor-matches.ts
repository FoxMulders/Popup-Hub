export interface NeighborMatchVendor {
  id: string
  neighbor_preference: string | null
  vendor: { full_name: string }
  passport: { business_name: string } | null
}

/** Pair keys `idA|idB` (sorted) when stand-beside preferences match another vendor name. */
export function findNeighborPairKeys(vendors: NeighborMatchVendor[]): Set<string> {
  const pairs = new Set<string>()
  for (const app of vendors) {
    if (!app.neighbor_preference?.trim()) continue
    const pref = app.neighbor_preference.toLowerCase()
    for (const other of vendors) {
      if (other.id === app.id) continue
      const otherName = (other.passport?.business_name ?? other.vendor.full_name).toLowerCase()
      if (pref.includes(otherName) || otherName.includes(pref)) {
        pairs.add([app.id, other.id].sort().join('|'))
      }
    }
  }
  return pairs
}

export function isNeighborPair(pairKeys: Set<string>, id1: string, id2: string): boolean {
  return pairKeys.has([id1, id2].sort().join('|'))
}

/** Empty grid cells orthogonally adjacent to a placed booth (for highlight overlay). */
export function adjacentEmptyCellsForBooth(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number,
  occupied: Set<string>
): Set<string> {
  const highlights = new Set<string>()
  const tryCell = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return
    const key = `${r}-${c}`
    if (!occupied.has(key)) highlights.add(key)
  }

  for (let c = boothCol; c < boothCol + colSpan; c++) {
    tryCell(boothRow - 1, c)
    tryCell(boothRow + rowSpan, c)
  }
  for (let r = boothRow; r < boothRow + rowSpan; r++) {
    tryCell(r, boothCol - 1)
    tryCell(r, boothCol + colSpan)
  }
  return highlights
}

/** Highlight cells where matched neighbor pairs could snap together. */
export function neighborPlacementHighlights(
  vendors: NeighborMatchVendor[],
  cells: { id: string; row: number; col: number; colSpan: number; rowSpan: number }[],
  rows: number,
  cols: number
): Set<string> {
  const pairKeys = findNeighborPairKeys(vendors)
  if (pairKeys.size === 0) return new Set()

  const placed = cells.filter((c) => c.col >= 0 && c.row >= 0)
  const occupied = new Set<string>()
  for (const c of placed) {
    for (let dr = 0; dr < c.rowSpan; dr++) {
      for (let dc = 0; dc < c.colSpan; dc++) {
        occupied.add(`${c.row + dr}-${c.col + dc}`)
      }
    }
  }

  const highlights = new Set<string>()
  const placedIds = new Set(placed.map((c) => c.id))

  for (const key of pairKeys) {
    const [idA, idB] = key.split('|')
    const boothA = placed.find((c) => c.id === idA)
    const boothB = placed.find((c) => c.id === idB)

    if (boothA && !placedIds.has(idB)) {
      for (const cell of adjacentEmptyCellsForBooth(
        boothA.row,
        boothA.col,
        boothA.rowSpan,
        boothA.colSpan,
        rows,
        cols,
        occupied
      )) {
        highlights.add(cell)
      }
    }
    if (boothB && !placedIds.has(idA)) {
      for (const cell of adjacentEmptyCellsForBooth(
        boothB.row,
        boothB.col,
        boothB.rowSpan,
        boothB.colSpan,
        rows,
        cols,
        occupied
      )) {
        highlights.add(cell)
      }
    }
  }

  return highlights
}
