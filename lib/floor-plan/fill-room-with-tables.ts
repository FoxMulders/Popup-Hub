import {
  autoArrangeInRoom,
  GRID_WALL_INSET_FT,
  type AutoArrangeInRoomResult,
  type AutoArrangeMode,
} from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import { nextCategoryName } from '@/components/coordinator/floor-plan-v2/canvas/category-palette'
import { resolveRoomPlacementSurface } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import { syncBoothCompoundBounds } from '@/components/coordinator/floor-plan-v2/state/table-cluster-layout'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
} from '@/components/coordinator/floor-plan-v2/state/types'
import {
  boothDimensionsForTableSpec,
  boothPatchForTableSize,
} from '@/lib/booth-planner/table-booth-consolidation'
import {
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { MIN_CLEARANCE_FT } from '@/lib/booth-planner/layout-clearance-constants'
import {
  isGuestTableBooth,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'
import {
  autoArrangeModeToMarketLayout,
  DEFAULT_AISLE_WIDTH_FT,
  maxDeterministicGridSlotCount,
} from '@/lib/floor-plan/deterministic-market-layout'

export type FillRoomTableScope = 'vendor' | 'patron'

export interface FillRoomWithTablesInput {
  doc: FloorPlanDoc
  roomId: string
  count: number
  tableSpec: TableSizeSpec
  scope: FillRoomTableScope
  eventCategoryNames?: ReadonlyArray<string>
  layoutCapacity?: number
  autoArrangeMode?: AutoArrangeMode
}

export interface FillRoomWithTablesResult {
  doc: FloorPlanDoc
  placedCount: number
  requestedCount: number
  maxCapacity: number
  arrange: AutoArrangeInRoomResult | null
}

function boothMatchesScope(
  booth: PlacedObject,
  scope: FillRoomTableScope
): booth is BoothObject {
  if (booth.kind !== 'booth') return false
  const isGuest = isGuestTableBooth(booth)
  return scope === 'patron' ? isGuest : !isGuest
}

function removeRoomBoothsByScope(
  doc: FloorPlanDoc,
  roomId: string,
  scope: FillRoomTableScope
): FloorPlanDoc {
  const objectRoom = doc.objectRoom ?? {}
  const removeIds = new Set(
    doc.objects
      .filter(
        (o) => objectRoom[o.id] === roomId && boothMatchesScope(o, scope)
      )
      .map((o) => o.id)
  )
  if (removeIds.size === 0) return doc

  const nextObjectRoom = { ...objectRoom }
  for (const id of removeIds) delete nextObjectRoom[id]

  return {
    ...doc,
    objects: doc.objects.filter((o) => !removeIds.has(o.id)),
    objectRoom: nextObjectRoom,
  }
}

function buildFillBooths(
  count: number,
  tableSpec: TableSizeSpec,
  eventCategoryNames?: ReadonlyArray<string>
): BoothObject[] {
  const dims = boothDimensionsForTableSpec(tableSpec)
  const patch = boothPatchForTableSize(
    { width: dims.width, height: dims.height },
    tableSpec
  )

  const booths: BoothObject[] = []
  let categoryCursor: string | null = null

  for (let i = 0; i < count; i++) {
    if (tableSpec.purpose === 'vendor' && eventCategoryNames?.length) {
      categoryCursor = nextCategoryName(categoryCursor, eventCategoryNames)
    }

    booths.push(
      syncBoothCompoundBounds({
        id: `obj-fill-${i}-${crypto.randomUUID()}`,
        kind: 'booth',
        x: -999,
        y: -999,
        rotation: 0,
        accentColor: null,
        label: tableSpec.purpose === 'guest' ? 'Patron' : 'Generic Vendor Booth',
        categoryName: categoryCursor,
        ...patch,
      })
    )
  }

  return booths
}

function attachBoothsToRoom(
  doc: FloorPlanDoc,
  roomId: string,
  booths: BoothObject[]
): FloorPlanDoc {
  if (booths.length === 0) return doc
  const objectRoom = { ...(doc.objectRoom ?? {}) }
  for (const booth of booths) {
    objectRoom[booth.id] = roomId
  }
  return {
    ...doc,
    objects: [...doc.objects, ...booths],
    objectRoom,
  }
}

/** Maximum tables of the given spec that fit in the active room under grid rules. */
export function estimateRoomFillCapacity(
  doc: FloorPlanDoc,
  roomId: string,
  tableSpec: TableSizeSpec,
  options: {
    autoArrangeMode?: AutoArrangeMode
    layoutCapacity?: number
  } = {}
): number {
  const frame = (doc.rooms ?? []).find((f) => f.id === roomId)
  if (!frame) return 0

  const surface = resolveRoomPlacementSurface(doc, roomId)
  const localW = surface
    ? Math.max(1, surface.maxX - surface.minX)
    : frame.widthFt
  const localL = surface
    ? Math.max(1, surface.maxY - surface.minY)
    : frame.lengthFt

  const dims = boothDimensionsForTableSpec(tableSpec)
  const layoutMode = autoArrangeModeToMarketLayout(options.autoArrangeMode)
  const gridProbeMode = layoutMode === 'perimeter' ? 'grid' : layoutMode

  const physicalMax = maxDeterministicGridSlotCount({
    marketWidthFt: localW,
    marketHeightFt: localL,
    tableWidthFt: dims.width,
    tableHeightFt: dims.height,
    layoutMode: gridProbeMode,
    aisleWidthFt: DEFAULT_AISLE_WIDTH_FT,
    wallInsetFt: GRID_WALL_INSET_FT,
    tableEdgeGapFt: MIN_CLEARANCE_FT * 2,
  })

  if (
    tableSpec.purpose === 'vendor' &&
    typeof options.layoutCapacity === 'number' &&
    options.layoutCapacity > 0
  ) {
    return Math.min(physicalMax, options.layoutCapacity)
  }

  return physicalMax
}

/**
 * Replace vendor or patron tables in a room with `count` new tables of the
 * given size, then grid-pack them via `autoArrangeInRoom`.
 */
export function fillRoomWithTables(
  input: FillRoomWithTablesInput
): FillRoomWithTablesResult {
  const {
    doc,
    roomId,
    tableSpec,
    scope,
    eventCategoryNames,
    layoutCapacity,
    autoArrangeMode = 'grid',
  } = input

  const frame = (doc.rooms ?? []).find((f) => f.id === roomId)
  if (!frame) {
    return {
      doc,
      placedCount: 0,
      requestedCount: 0,
      maxCapacity: 0,
      arrange: null,
    }
  }

  const maxCapacity = estimateRoomFillCapacity(doc, roomId, tableSpec, {
    autoArrangeMode,
    layoutCapacity,
  })

  const requestedCount = Math.max(0, Math.floor(input.count))
  if (requestedCount <= 0 || maxCapacity <= 0) {
    return {
      doc,
      placedCount: 0,
      requestedCount,
      maxCapacity,
      arrange: null,
    }
  }

  const targetCount = Math.min(requestedCount, maxCapacity)
  const clearedDoc = removeRoomBoothsByScope(doc, roomId, scope)
  const booths = buildFillBooths(targetCount, tableSpec, eventCategoryNames)
  const seededDoc = attachBoothsToRoom(clearedDoc, roomId, booths)

  const baselineTableLengthFt: LayoutBaselineTableLengthFt | undefined =
    tableSpec.purpose === 'vendor' && isLayoutBaselineTableLengthFt(tableSpec.ft)
      ? tableSpec.ft
      : undefined

  const arrange = autoArrangeInRoom(seededDoc, roomId, {
    scope,
    mode: autoArrangeMode,
    eventCategoryNames,
    baselineTableLengthFt,
    dropUnplacedBooths: true,
    ...(typeof layoutCapacity === 'number' && layoutCapacity > 0 && scope === 'vendor'
      ? { maxBooths: layoutCapacity }
      : {}),
  })

  if (!arrange) {
    return {
      doc: seededDoc,
      placedCount: 0,
      requestedCount: targetCount,
      maxCapacity,
      arrange: null,
    }
  }

  return {
    doc: arrange.doc,
    placedCount: arrange.placedCount,
    requestedCount: targetCount,
    maxCapacity,
    arrange,
  }
}
