import type { FakeVendorInput } from '@/lib/booth-planner/fake-vendors'
import { DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT } from '@/lib/booth-planner/layout-table-size'
import {
  boothDimensionsForTableLength,
  consolidatedTableLengthFt,
} from '@/lib/booth-planner/table-booth-consolidation'

export interface MultiSlotVendorMember {
  id: string
  vendorName: string
  categoryName: string
  categoryId: string | null
  tableLengthFt: number
  requestedBoothType?: FakeVendorInput['requestedBoothType']
  groupId: string
  slotIndex: number
  slotCount: number
}

export interface GroupedTableVendorForPlan {
  id: string
  vendorName: string
  categoryName: string
  categoryId: string | null
  colSpan: number
  rowSpan: number
  tableLengthFt: number
  requestedBoothType?: FakeVendorInput['requestedBoothType']
  vendorUnitType: 'table'
  slotCount: number
}

export interface ApprovedAppForGrouping {
  id: string
  vendor_id?: string
  category_id: string
  applied_at?: string
  requested_booth_type?: FakeVendorInput['requestedBoothType']
  vendor: { full_name: string }
  passport: { business_name: string } | null
  category: { name: string } | null
}

function groupKeyForApp(app: ApprovedAppForGrouping): string {
  return app.vendor_id ?? app.vendor.full_name
}

/** Expand approved applications into linked multi-slot members (same vendor → shared groupId). */
export function buildMultiSlotMembersFromApprovedApps<T extends ApprovedAppForGrouping>(
  apps: T[],
  resolveTableLengthFt: (app: T) => number
): MultiSlotVendorMember[] {
  const groups = new Map<string, T[]>()
  const order: string[] = []

  for (const app of apps) {
    const key = groupKeyForApp(app)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(app)
  }

  const members: MultiSlotVendorMember[] = []
  for (const key of order) {
    const groupApps = groups.get(key)!
    groupApps.sort((a, b) => (a.applied_at ?? '').localeCompare(b.applied_at ?? ''))
    const slotCount = groupApps.length
    groupApps.forEach((app, slotIndex) => {
      members.push({
        id: app.id,
        vendorName: app.passport?.business_name ?? app.vendor.full_name,
        categoryName: app.category?.name ?? 'Uncategorized',
        categoryId: app.category_id,
        tableLengthFt: resolveTableLengthFt(app),
        requestedBoothType: app.requested_booth_type ?? null,
        groupId: key,
        slotIndex,
        slotCount,
      })
    })
  }
  return members
}

/** Merge same-vendor table slots into side-by-side units for auto-plan / layout roster. */
export function groupMultiSlotTableVendorsForPlan(
  members: MultiSlotVendorMember[],
  resolveUnitSpans: (tableLengthFt: number) => { colSpan: number; rowSpan: number }
): GroupedTableVendorForPlan[] {
  const groups = new Map<string, MultiSlotVendorMember[]>()
  const order: string[] = []

  for (const member of members) {
    const key = member.groupId
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(member)
  }

  return order.map((key) => {
    const groupMembers = groups.get(key)!
    groupMembers.sort((a, b) => a.slotIndex - b.slotIndex)
    const lead = groupMembers[0]!
    const slotCount = lead.slotCount ?? groupMembers.length
    const tableLengthFt = lead.tableLengthFt ?? DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
    const megaFt = consolidatedTableLengthFt(tableLengthFt, slotCount)
    const effectiveFt = megaFt ?? tableLengthFt
    const unit = resolveUnitSpans(effectiveFt)
    const dims =
      megaFt != null
        ? boothDimensionsForTableLength(megaFt)
        : { width: unit.colSpan, height: unit.rowSpan }
    return {
      id: lead.id,
      vendorName: lead.vendorName,
      categoryName: lead.categoryName,
      categoryId: lead.categoryId,
      colSpan: megaFt != null ? dims.width : unit.colSpan * slotCount,
      rowSpan: megaFt != null ? dims.height : unit.rowSpan,
      tableLengthFt: effectiveFt,
      requestedBoothType: lead.requestedBoothType,
      vendorUnitType: 'table' as const,
      slotCount,
    }
  })
}

export function fakeVendorsToMultiSlotMembers(vendors: FakeVendorInput[]): MultiSlotVendorMember[] {
  return vendors.map((v) => ({
    id: v.id,
    vendorName: v.vendorName,
    categoryName: v.categoryName,
    categoryId: null,
    tableLengthFt: v.tableLengthFt ?? DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
    requestedBoothType: v.requestedBoothType ?? null,
    groupId: v.seedGroupId ?? v.id,
    slotIndex: v.slotIndex ?? 0,
    slotCount: v.slotCount ?? 1,
  }))
}
