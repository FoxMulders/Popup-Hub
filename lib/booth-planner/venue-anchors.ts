import type { VenueElement } from '@/types/database'

const ANCHOR_TYPES = new Set<VenueElement['type']>([
  'stage',
  'food_court',
  'restroom',
  'seating',
])

export interface VenueAnchor {
  id: string
  type: VenueElement['type']
  label: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
  /** Centroid for depth scoring. */
  centerRow: number
  centerCol: number
}

export function findVenueAnchors(elements: VenueElement[]): VenueAnchor[] {
  const anchors: VenueAnchor[] = []
  for (const el of elements) {
    if (!ANCHOR_TYPES.has(el.type) && el.type !== 'custom_label') continue
    if (el.type === 'custom_label' && !/food|stage|restroom|concession/i.test(el.label ?? '')) {
      continue
    }
    const rowSpan = el.rowSpan ?? 1
    const colSpan = el.colSpan ?? 1
    anchors.push({
      id: el.id,
      type: el.type,
      label: el.label ?? el.type,
      row: el.row,
      col: el.col,
      rowSpan,
      colSpan,
      centerRow: el.row + rowSpan / 2,
      centerCol: el.col + colSpan / 2,
    })
  }
  return anchors
}

/** Higher when booth sits between entrance and rear anchors (forces deep transit). */
export function scoreAnchorDepth(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  anchors: VenueAnchor[],
  entrance: 'north' | 'south' | 'east' | 'west',
  rows: number,
  cols: number
): number {
  if (anchors.length === 0) return 0

  const boothCenterRow = row + rowSpan / 2
  const boothCenterCol = col + colSpan / 2

  let score = 0
  for (const anchor of anchors) {
    const depth = depthBetweenEntranceAndAnchor(
      boothCenterRow,
      boothCenterCol,
      anchor.centerRow,
      anchor.centerCol,
      entrance,
      rows,
      cols
    )
    score += depth
  }
  return score
}

function depthBetweenEntranceAndAnchor(
  boothRow: number,
  boothCol: number,
  anchorRow: number,
  anchorCol: number,
  entrance: 'north' | 'south' | 'east' | 'west',
  rows: number,
  cols: number
): number {
  switch (entrance) {
    case 'south': {
      const entranceRow = 0
      const maxDepth = rows - 1
      const anchorDepth = anchorRow - entranceRow
      const boothDepth = boothRow - entranceRow
      if (boothDepth <= 0 || boothDepth > anchorDepth) return 0
      return Math.min(boothDepth / Math.max(anchorDepth, 1), 1) * 500
    }
    case 'north': {
      const entranceRow = rows - 1
      const anchorDepth = entranceRow - anchorRow
      const boothDepth = entranceRow - boothRow
      if (boothDepth <= 0 || boothDepth > anchorDepth) return 0
      return Math.min(boothDepth / Math.max(anchorDepth, 1), 1) * 500
    }
    case 'west': {
      const entranceCol = 0
      const anchorDepth = anchorCol - entranceCol
      const boothDepth = boothCol - entranceCol
      if (boothDepth <= 0 || boothDepth > anchorDepth) return 0
      return Math.min(boothDepth / Math.max(anchorDepth, 1), 1) * 500
    }
    case 'east': {
      const entranceCol = cols - 1
      const anchorDepth = entranceCol - anchorCol
      const boothDepth = entranceCol - boothCol
      if (boothDepth <= 0 || boothDepth > anchorDepth) return 0
      return Math.min(boothDepth / Math.max(anchorDepth, 1), 1) * 500
    }
  }
}
