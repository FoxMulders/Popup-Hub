import type { VenueElement } from '@/types/database'

export type OffFloorWall = 'north' | 'south' | 'east' | 'west'

export type OffFloorZoneKind = 'stage' | 'stairs' | 'service'

/** Rooms adjacent to the hall — drawn outside the perimeter wall, not on the vendor grid. */
export type OffFloorZone = {
  wall: OffFloorWall
  /** Offset along the wall from west (north/south walls) or from south (east/west walls). */
  col: number
  colSpan: number
  depthFt: number
  label: string
  /** Render width in feet when colSpan is grid-rounded (e.g. 3.5′ stairs). */
  widthFt?: number
  kind?: OffFloorZoneKind
}

export function annexElementsFromOffFloorZones(
  zones: OffFloorZone[],
  hallRows: number,
  _hallCols: number
): VenueElement[] {
  const elements: VenueElement[] = []
  for (const zone of zones) {
    if (zone.wall !== 'north') continue
    const isStage = zone.kind === 'stage'
    elements.push({
      id: crypto.randomUUID(),
      type: isStage ? 'stage' : 'custom_label',
      row: hallRows,
      col: zone.col,
      colSpan: zone.colSpan,
      rowSpan: zone.depthFt,
      label: zone.label,
      locked: true,
    })
  }
  return elements
}

export function maxOffFloorAnnexFt(zones: OffFloorZone[], wall: OffFloorWall): number {
  let max = 0
  for (const zone of zones) {
    if (zone.wall === wall) max = Math.max(max, zone.depthFt)
  }
  return max
}

export function canvasRowsWithAnnex(hallRows: number, zones: OffFloorZone[]): number {
  return hallRows + maxOffFloorAnnexFt(zones, 'north')
}

export function offFloorAnnexPadding(zones: OffFloorZone[]): {
  north: number
  south: number
  east: number
  west: number
} {
  return {
    north: maxOffFloorAnnexFt(zones, 'north'),
    south: maxOffFloorAnnexFt(zones, 'south'),
    east: maxOffFloorAnnexFt(zones, 'east'),
    west: maxOffFloorAnnexFt(zones, 'west'),
  }
}

/** True for cells in the north annex band (row >= hallRows). */
export function isAnnexGridRow(row: number, hallRows: number): boolean {
  return row >= hallRows
}
