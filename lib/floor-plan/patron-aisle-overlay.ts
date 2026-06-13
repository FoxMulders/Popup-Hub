/**
 * Patron aisle corridor geometry for floor-plan canvas overlays.
 * Mirrors the grid auto-arrange back-to-back block pattern with 6′ aisles.
 */

import {
  MIN_CLEARANCE_FT,
  BOOTH_PAIR_MIN_EDGE_GAP_FT,
  PATRON_AISLE_MIN_FT,
} from '@/lib/booth-planner/layout-clearance-constants'
import type { FloorPlanDoc, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { objectFootprintAabb } from '@/components/coordinator/floor-plan-v2/state/table-cluster-layout'
import { resolveRoomPlacementSurface } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import { TABLE_EDGE_GAP_FT } from '@/lib/floor-plan/deterministic-market-layout'
import {
  estimateGridCapacity,
  planCrossAisleZones,
  shouldInjectCrossAisle,
} from '@/lib/floor-plan/layout-density'

export interface PatronAisleRect {
  x: number
  y: number
  width: number
  height: number
}

const BACK_TO_BACK_ROW_GAP_FT = BOOTH_PAIR_MIN_EDGE_GAP_FT

function medianBoothDimension(values: number[], fallback: number): number {
  if (values.length === 0) return fallback
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? fallback
}

/**
 * Theoretical horizontal + vertical patron aisles for a grid layout in room-local ft.
 */
export function computeGridPatronAisleCorridors(input: {
  roomWidthFt: number
  roomLengthFt: number
  boothWidthFt: number
  boothHeightFt: number
  boothCount?: number
  aisleWidthFt?: number
  wallInsetFt?: number
  tableEdgeGapFt?: number
}): PatronAisleRect[] {
  const {
    roomWidthFt: cw,
    roomLengthFt: ch,
    boothWidthFt: tw,
    boothHeightFt: th,
    boothCount = 0,
    aisleWidthFt = PATRON_AISLE_MIN_FT,
    wallInsetFt = PATRON_AISLE_MIN_FT,
    tableEdgeGapFt = TABLE_EDGE_GAP_FT,
  } = input

  const corridors: PatronAisleRect[] = []
  const inset = wallInsetFt

  corridors.push({
    x: 0,
    y: 0,
    width: cw,
    height: inset,
  })
  corridors.push({
    x: 0,
    y: ch - inset,
    width: cw,
    height: inset,
  })
  corridors.push({
    x: 0,
    y: inset,
    width: inset,
    height: Math.max(0, ch - inset * 2),
  })
  corridors.push({
    x: cw - inset,
    y: inset,
    width: inset,
    height: Math.max(0, ch - inset * 2),
  })

  const blockHeight = th * 2 + BACK_TO_BACK_ROW_GAP_FT
  const blockStep = blockHeight + aisleWidthFt
  const colStep = tw + tableEdgeGapFt
  let blockY = inset

  while (blockY + blockHeight <= ch - inset + 1e-6) {
    const aisleY = blockY + blockHeight
    if (aisleY + aisleWidthFt <= ch - inset + 1e-6) {
      corridors.push({
        x: inset,
        y: aisleY,
        width: Math.max(0, cw - inset * 2),
        height: aisleWidthFt,
      })
    }
    blockY += blockStep
  }

  let colX = inset
  while (colX + tw <= cw - inset + 1e-6) {
    const gapX = colX + tw
    if (gapX + tableEdgeGapFt <= cw - inset + 1e-6 && tableEdgeGapFt >= 2) {
      corridors.push({
        x: gapX,
        y: inset,
        width: tableEdgeGapFt,
        height: Math.max(0, ch - inset * 2),
      })
    }
    colX += colStep
  }

  const { columnCount, slotCount } = estimateGridCapacity({
    roomWidthFt: cw,
    roomLengthFt: ch,
    boothWidthFt: tw,
    boothHeightFt: th,
    wallInsetFt: inset,
    tableEdgeGapFt,
    aisleWidthFt,
  })
  if (
    shouldInjectCrossAisle({
      columnCount,
      boothCount: boothCount > 0 ? boothCount : slotCount,
      roomWidthFt: cw,
      roomLengthFt: ch,
      maxSlotsWithoutCrossAisle: slotCount,
    })
  ) {
    for (const zone of planCrossAisleZones({
      roomWidthFt: cw,
      roomLengthFt: ch,
      wallInsetFt: inset,
      columnCount,
    })) {
      corridors.push({
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
      })
    }
  }

  return corridors
}

function doorCenter(obj: PlacedObject): { x: number; y: number } | null {
  if (obj.kind !== 'door' && obj.kind !== 'emergency_exit') return null
  const aabb = objectFootprintAabb(obj)
  return { x: aabb.x + aabb.width / 2, y: aabb.y + aabb.height / 2 }
}

/** Connect entry doors to the nearest perimeter aisle band. */
function doorConnectorCorridors(
  doors: PlacedObject[],
  cw: number,
  ch: number,
  inset: number,
  aisleWidthFt: number
): PatronAisleRect[] {
  const connectors: PatronAisleRect[] = []
  for (const door of doors) {
    const center = doorCenter(door)
    if (!center) continue
    const onTop = center.y <= ch / 2
    const onLeft = center.x <= cw / 2
    if (onTop) {
      connectors.push({
        x: Math.max(0, center.x - aisleWidthFt / 2),
        y: inset,
        width: aisleWidthFt,
        height: Math.max(aisleWidthFt, center.y),
      })
    } else {
      connectors.push({
        x: Math.max(0, center.x - aisleWidthFt / 2),
        y: center.y,
        width: aisleWidthFt,
        height: Math.max(aisleWidthFt, ch - inset - center.y),
      })
    }
    if (onLeft) {
      connectors.push({
        x: inset,
        y: Math.max(0, center.y - aisleWidthFt / 2),
        width: Math.max(aisleWidthFt, center.x),
        height: aisleWidthFt,
      })
    } else {
      connectors.push({
        x: center.x,
        y: Math.max(0, center.y - aisleWidthFt / 2),
        width: Math.max(aisleWidthFt, cw - inset - center.x),
        height: aisleWidthFt,
      })
    }
  }
  return connectors
}

/** Room-local patron aisle rects for canvas overlay (global coords). */
export function computePatronAisleOverlayForRoom(
  doc: FloorPlanDoc,
  roomId: string
): PatronAisleRect[] | null {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) return null

  const surface = resolveRoomPlacementSurface(doc, roomId)
  const originX = surface?.minX ?? frame.originX
  const originY = surface?.minY ?? frame.originY
  const localW = surface ? Math.max(1, surface.maxX - surface.minX) : frame.widthFt
  const localL = surface ? Math.max(1, surface.maxY - surface.minY) : frame.lengthFt

  const objectRoom = doc.objectRoom ?? {}
  const inRoom = doc.objects.filter((o) => objectRoom[o.id] === roomId)
  const booths = inRoom.filter((o) => o.kind === 'booth')
  const boothW = medianBoothDimension(booths.map((b) => b.width), 10)
  const boothH = medianBoothDimension(booths.map((b) => b.height), 10)

  const localDoors = inRoom
    .filter((o) => o.kind === 'door' || o.kind === 'emergency_exit')
    .map((o) => ({
      ...o,
      x: o.x - originX,
      y: o.y - originY,
    }))

  const gridCorridors = computeGridPatronAisleCorridors({
    roomWidthFt: localW,
    roomLengthFt: localL,
    boothWidthFt: boothW,
    boothHeightFt: boothH,
    boothCount: booths.length,
  })

  const doorConnectors = doorConnectorCorridors(
    localDoors,
    localW,
    localL,
    PATRON_AISLE_MIN_FT,
    PATRON_AISLE_MIN_FT
  )

  return [...gridCorridors, ...doorConnectors].map((r) => ({
    x: r.x + originX,
    y: r.y + originY,
    width: r.width,
    height: r.height,
  }))
}
