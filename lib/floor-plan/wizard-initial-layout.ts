import { autoArrangeInRoom } from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import type { AutoArrangeInRoomResult } from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import {
  boothDimensionsForTableSpec,
  boothPatchForTableSize,
} from '@/lib/booth-planner/table-booth-consolidation'
import { vendorTableSpec } from '@/lib/booth-planner/table-shape'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { syncBoothCompoundBounds } from '@/components/coordinator/floor-plan-v2/state/table-cluster-layout'
import type { BoothObject, FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import type { LayoutRoom } from '@/types/database'

export interface WizardCategorySlot {
  categoryId: string
  categoryName: string
  maxSlots: number
}

export interface WizardInitialLayoutInput {
  doc: FloorPlanDoc
  roomId: string
  categorySlots: ReadonlyArray<WizardCategorySlot>
  baselineTableLengthFt?: LayoutBaselineTableLengthFt
  layoutCapacity?: number
  eventCategoryNames?: ReadonlyArray<string>
}

export interface WizardInitialLayoutResult {
  doc: FloorPlanDoc
  placedCount: number
  requestedCount: number
  arrange: AutoArrangeInRoomResult | null
}

/** True when the wizard should run the one-time auto seed + grid pack. */
export function shouldRunWizardInitialLayout(
  layoutRooms: ReadonlyArray<LayoutRoom>,
  doc: FloorPlanDoc,
  categorySlots: ReadonlyArray<WizardCategorySlot>
): boolean {
  if (categorySlots.length === 0) return false
  const totalConfigured = categorySlots.reduce(
    (sum, slot) => sum + Math.max(0, slot.maxSlots),
    0
  )
  if (totalConfigured <= 0) return false
  if (layoutRooms.some((room) => (room.cells?.length ?? 0) > 0)) return false

  const objectRoom = doc.objectRoom ?? {}
  const hasPlacedVendorBooth = doc.objects.some(
    (o) =>
      o.kind === 'booth' &&
      (o as BoothObject).tablePurpose !== 'guest' &&
      o.x >= 0 &&
      o.y >= 0 &&
      objectRoom[o.id] != null
  )
  return !hasPlacedVendorBooth
}

function roundRobinPlaceholderCount(
  slots: ReadonlyArray<WizardCategorySlot>,
  layoutCapacity: number | undefined
): number {
  const totalConfigured = slots.reduce(
    (sum, slot) => sum + Math.max(0, slot.maxSlots),
    0
  )
  if (totalConfigured <= 0) return 0
  const ceiling =
    typeof layoutCapacity === 'number' && layoutCapacity > 0
      ? layoutCapacity
      : totalConfigured
  return Math.min(totalConfigured, ceiling)
}

/** Build generic vendor booth placeholders — one per configured cap (round-robin). */
export function buildWizardGenericVendorBooths(
  categorySlots: ReadonlyArray<WizardCategorySlot>,
  options: {
    baselineTableLengthFt?: LayoutBaselineTableLengthFt
    layoutCapacity?: number
  } = {}
): BoothObject[] {
  const baselineFt =
    options.baselineTableLengthFt != null &&
    isLayoutBaselineTableLengthFt(options.baselineTableLengthFt)
      ? options.baselineTableLengthFt
      : DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT

  const targetCount = roundRobinPlaceholderCount(
    categorySlots,
    options.layoutCapacity
  )
  if (targetCount <= 0) return []

  const buckets = categorySlots
    .filter((slot) => slot.maxSlots > 0)
    .map((slot) => ({
      categoryName: slot.categoryName,
      remaining: slot.maxSlots,
    }))

  const spec = vendorTableSpec(baselineFt)
  const dims = boothDimensionsForTableSpec(spec)
  const patch = boothPatchForTableSize(
    { width: dims.width, height: dims.height },
    spec
  )

  const booths: BoothObject[] = []
  let categoryCursor = 0
  let safety = 0

  while (booths.length < targetCount && buckets.some((b) => b.remaining > 0)) {
    if (safety++ > targetCount * 4) break
    const bucket = buckets[categoryCursor % buckets.length]!
    categoryCursor += 1
    if (bucket.remaining <= 0) continue
    bucket.remaining -= 1

    const booth: BoothObject = syncBoothCompoundBounds({
      id: `obj-wizard-seed-${booths.length}-${crypto.randomUUID()}`,
      kind: 'booth',
      x: -999,
      y: -999,
      rotation: 0,
      accentColor: null,
      categoryName: bucket.categoryName,
      label: 'Generic Vendor Booth',
      ...patch,
    })
    booths.push(booth)
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
  const nonBoothObjects = doc.objects.filter((o) => o.kind !== 'booth')
  return {
    ...doc,
    objects: [...nonBoothObjects, ...booths],
    objectRoom,
  }
}

/**
 * Seed generic vendor booths from Step 2 caps and grid-pack them inside the
 * active room (Main Hall) starting from the top-left via `autoArrangeInRoom`.
 */
export function runWizardInitialLayout(
  input: WizardInitialLayoutInput
): WizardInitialLayoutResult {
  const {
    doc,
    roomId,
    categorySlots,
    baselineTableLengthFt,
    layoutCapacity,
    eventCategoryNames,
  } = input

  const booths = buildWizardGenericVendorBooths(categorySlots, {
    baselineTableLengthFt,
    layoutCapacity,
  })

  if (booths.length === 0) {
    return { doc, placedCount: 0, requestedCount: 0, arrange: null }
  }

  const seededDoc = attachBoothsToRoom(doc, roomId, booths)
  const baselineFt =
    baselineTableLengthFt != null &&
    isLayoutBaselineTableLengthFt(baselineTableLengthFt)
      ? baselineTableLengthFt
      : DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT

  const arrange = autoArrangeInRoom(seededDoc, roomId, {
    scope: 'vendor',
    mode: 'grid',
    eventCategoryNames,
    baselineTableLengthFt: baselineFt,
    ...(typeof layoutCapacity === 'number' && layoutCapacity > 0
      ? { maxBooths: layoutCapacity }
      : {}),
  })

  if (!arrange) {
    return {
      doc: seededDoc,
      placedCount: 0,
      requestedCount: booths.length,
      arrange: null,
    }
  }

  return {
    doc: arrange.doc,
    placedCount: arrange.placedCount,
    requestedCount: booths.length,
    arrange,
  }
}

