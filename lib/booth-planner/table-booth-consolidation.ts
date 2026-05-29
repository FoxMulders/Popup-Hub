import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { BOOTH_EQUIPMENT_DEPTH_FT } from '@/lib/booth-planner/table-space'

export interface VendorTableMeta {
  vendorKey: string
  tableCount: number
  tableLengthFt?: LayoutBaselineTableLengthFt
}

/**
 * Product of baseline table length × requested table count when that
 * length is a supported venue table size (includes 12′, 15′, 18′).
 */
export function consolidatedTableLengthFt(
  baselineFt: number,
  tableCount: number
): LayoutBaselineTableLengthFt | null {
  const tables = Math.max(1, Math.floor(tableCount))
  const total = baselineFt * tables
  return isLayoutBaselineTableLengthFt(total) ? total : null
}

export function boothDimensionsForTableLength(tableLengthFt: number): {
  width: number
  height: number
} {
  return {
    width: tableLengthFt,
    height: BOOTH_EQUIPMENT_DEPTH_FT,
  }
}

function vendorKeyForBooth(booth: BoothObject): string {
  return booth.vendorId ?? booth.label ?? booth.id
}

/**
 * Before auto-arrange, collapse multi-table vendors into one booth
 * whose width matches the consolidated table length (e.g. 3×5′ → 15′).
 */
export function consolidateBoothsForAutoArrange(
  booths: BoothObject[],
  baselineTableLengthFt: LayoutBaselineTableLengthFt,
  vendorMetaByKey?: Map<string, VendorTableMeta>
): BoothObject[] {
  const groups = new Map<string, BoothObject[]>()
  const order: string[] = []

  for (const booth of booths) {
    const key = vendorKeyForBooth(booth)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(booth)
  }

  const consolidated: BoothObject[] = []

  for (const key of order) {
    const members = groups.get(key)!
    const meta = vendorMetaByKey?.get(key)
    const tableCount = Math.max(
      1,
      meta?.tableCount ??
        (members.length > 1
          ? members.length
          : members[0]?.tableCount ?? 1)
    )
    const baseFt =
      meta?.tableLengthFt ??
      members[0]?.tableLengthFt ??
      baselineTableLengthFt
    const megaFt = consolidatedTableLengthFt(baseFt, tableCount)

    if (megaFt != null && tableCount > 1) {
      const lead = members[0]!
      const dims = boothDimensionsForTableLength(megaFt)
      consolidated.push({
        ...lead,
        width: dims.width,
        height: dims.height,
        tableLengthFt: megaFt,
        tableCount,
        label:
          lead.label ??
          `${megaFt}′ table (${tableCount}×${baseFt}′)`,
      })
      continue
    }

    for (const member of members) {
      const count = member.tableCount ?? meta?.tableCount ?? 1
      const ft =
        member.tableLengthFt ??
        consolidatedTableLengthFt(baseFt, count) ??
        baseFt
      const dims = boothDimensionsForTableLength(ft)
      consolidated.push({
        ...member,
        width: dims.width,
        height: dims.height,
        tableLengthFt: ft,
        tableCount: count,
      })
    }
  }

  return consolidated
}

function isApprovedForLayout(status?: string): boolean {
  return !status || status === 'approved' || status === 'pending_insurance'
}

/** Table slots for a vendor: explicit `table_count` wins; else # of approved apps. */
export function tableCountForVendorApplications(
  apps: ReadonlyArray<{ table_count?: number }>
): number {
  const explicit = apps.map((a) => a.table_count ?? 0).filter((n) => n > 1)
  if (explicit.length > 0) {
    return Math.max(...explicit)
  }
  return Math.max(1, apps.length)
}

/** Build vendor-key → table metadata from approved applications. */
export function vendorTableMetaFromApplications(
  applications: ReadonlyArray<{
    id: string
    vendor_id?: string
    table_count?: number
    status?: string
  }>,
  baselineTableLengthFt: LayoutBaselineTableLengthFt
): Map<string, VendorTableMeta> {
  const map = new Map<string, VendorTableMeta>()
  const byVendor = new Map<string, Array<(typeof applications)[number]>>()

  for (const app of applications) {
    if (!isApprovedForLayout(app.status)) continue
    const vendorKey = app.vendor_id ?? app.id
    if (!byVendor.has(vendorKey)) byVendor.set(vendorKey, [])
    byVendor.get(vendorKey)!.push(app)
  }

  for (const [vendorKey, apps] of byVendor) {
    const tableCount = tableCountForVendorApplications(apps)
    const meta: VendorTableMeta = {
      vendorKey,
      tableCount,
      tableLengthFt: baselineTableLengthFt,
    }
    map.set(vendorKey, meta)
    for (const app of apps) {
      map.set(app.id, { ...meta, vendorKey: app.id })
    }
  }

  return map
}
