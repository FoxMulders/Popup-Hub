import { FAKE_VENDOR_ID_PREFIX, type FakeVendorInput } from '@/lib/booth-planner/fake-vendors'
import {
  fakeVendorsToMultiSlotMembers,
  groupMultiSlotTableVendorsForPlan,
} from '@/lib/booth-planner/approved-application-groups'
import { DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT } from '@/lib/booth-planner/layout-table-size'

/** Hard ceilings for diverse seed suites (tables at 6′×2′). */
export const SEED_TABLE_CEILINGS = {
  main_hall: 85,
  kilkenny: 35,
} as const

export type SeedVenueProfile = keyof typeof SEED_TABLE_CEILINGS | 'default'

export interface SeedVendorTemplate {
  businessName: string
  categoryName: string
  /** Booth slots for this vendor (side-by-side when > 1). */
  quantity: number
  powerRequired?: boolean
}

/** Curated artisan mix — cycles to fill venue capacity. */
export const DIVERSE_SEED_TEMPLATES: SeedVendorTemplate[] = [
  { businessName: 'Ink & Paper Press', categoryName: 'Art & Prints', quantity: 1 },
  { businessName: 'Woven Willow Studio', categoryName: 'Fiber Arts & Yarn', quantity: 2 },
  { businessName: 'Layered Dreams 3D', categoryName: '3D Printing', quantity: 1, powerRequired: true },
  { businessName: 'Wildwood Botanicals', categoryName: 'Herbal & Apothecary', quantity: 1 },
  { businessName: 'Glow Cosmetics', categoryName: 'Color Street', quantity: 1 },
]

export interface SeededApplicationSlot {
  id: string
  vendorName: string
  categoryName: string
  tableLengthFt: 6
  requestedBoothType: 'inside' | 'power'
  seedGroupId: string
  slotIndex: number
  slotCount: number
}

export function resolveSeedVenueProfile(input: {
  venuePresetId?: string | null
  roomName?: string | null
}): SeedVenueProfile {
  const id = (input.venuePresetId ?? '').toLowerCase()
  const name = (input.roomName ?? '').toLowerCase()
  if (id.includes('kilkenny') || name.includes('kilkenny')) return 'kilkenny'
  if (name.includes('main hall') || id.includes('main')) return 'main_hall'
  return 'default'
}

export function resolveSeedTargetTableCount(input: {
  maxBoothCapacity: number
  layoutCapacity?: number
  venuePresetId?: string | null
  roomName?: string | null
}): number {
  const profile = resolveSeedVenueProfile(input)
  const ceiling =
    profile === 'kilkenny'
      ? SEED_TABLE_CEILINGS.kilkenny
      : profile === 'main_hall'
        ? SEED_TABLE_CEILINGS.main_hall
        : input.maxBoothCapacity
  const headroom = Math.max(0, Math.min(input.maxBoothCapacity, ceiling))
  if (input.layoutCapacity != null && input.layoutCapacity > 0) {
    return Math.min(headroom, input.layoutCapacity)
  }
  return headroom
}

/** Expand templates into linked application slots (strict 6′ tables). */
export function buildDiverseSeedApplicationSlots(targetTableCount: number): SeededApplicationSlot[] {
  if (targetTableCount <= 0) return []

  const slots: SeededApplicationSlot[] = []
  let templateIndex = 0
  let vendorSerial = 0

  while (slots.length < targetTableCount) {
    const template = DIVERSE_SEED_TEMPLATES[templateIndex % DIVERSE_SEED_TEMPLATES.length]!
    templateIndex += 1
    vendorSerial += 1

    const seedGroupId = `seed-group-${vendorSerial}`
    const slotCount = Math.min(template.quantity, targetTableCount - slots.length)
    const requestedBoothType = template.powerRequired ? 'power' : 'inside'

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
      slots.push({
        id: `${FAKE_VENDOR_ID_PREFIX}seed-${crypto.randomUUID()}`,
        vendorName: template.businessName,
        categoryName: template.categoryName,
        tableLengthFt: DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
        requestedBoothType,
        seedGroupId,
        slotIndex,
        slotCount,
      })
    }
  }

  return slots
}

/** Hydrate the booth-planner fake-vendor queue from seeded application slots. */
export function seedSlotsToFakeVendors(slots: SeededApplicationSlot[]): FakeVendorInput[] {
  return slots.map((slot) => ({
    id: slot.id,
    vendorName: slot.vendorName,
    categoryName: slot.categoryName,
    vendorUnitType: 'table' as const,
    tableLengthFt: slot.tableLengthFt,
    requestedBoothType: slot.requestedBoothType,
    seedGroupId: slot.seedGroupId,
    slotIndex: slot.slotIndex,
    slotCount: slot.slotCount,
  }))
}

export function generateDiverseSeedFakeVendors(input: {
  maxBoothCapacity: number
  layoutCapacity?: number
  venuePresetId?: string | null
  roomName?: string | null
}): { vendors: FakeVendorInput[]; targetTableCount: number; slotCount: number } {
  const targetTableCount = resolveSeedTargetTableCount(input)
  const slots = buildDiverseSeedApplicationSlots(targetTableCount)
  return {
    vendors: seedSlotsToFakeVendors(slots),
    targetTableCount,
    slotCount: slots.length,
  }
}

/** Merge same-vendor seed slots into side-by-side table units for auto-plan (6′ grid). */
export function groupSeedFakeVendorsForAutoPlan(
  vendors: FakeVendorInput[],
  tableLengthFt: number = DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
) {
  return groupMultiSlotTableVendorsForPlan(fakeVendorsToMultiSlotMembers(vendors), (ft) => ({
    colSpan: ft,
    rowSpan: 2,
  }))
}
