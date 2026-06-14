import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { VendorApplicationSnapshot } from '@/components/coordinator/dashboard/booth-placement-status'

/** Vendors not bound to any booth on the live canvas (ignores stale `booth_number`). */
export function approvedVendorsNotOnCanvas(
  vendors: VendorApplicationSnapshot[],
  booths: readonly BoothObject[]
): VendorApplicationSnapshot[] {
  const placedKeys = new Set<string>()
  for (const booth of booths) {
    if (!booth.vendorId) continue
    placedKeys.add(booth.vendorId)
  }
  return vendors.filter(
    (v) => !placedKeys.has(v.vendor_id) && !placedKeys.has(v.id)
  )
}

export function resolveApplicationForBooth(
  booth: Pick<BoothObject, 'vendorId'>,
  appByVendorId: ReadonlyMap<string, VendorApplicationSnapshot>,
  appByApplicationId: ReadonlyMap<string, VendorApplicationSnapshot>
): VendorApplicationSnapshot | undefined {
  if (!booth.vendorId) return undefined
  return (
    appByVendorId.get(booth.vendorId) ?? appByApplicationId.get(booth.vendorId)
  )
}

/** Legacy grid cells stored application id in `vendorId` — normalize to vendor_id. */
export function boothVendorIdReconciliationPatches(
  booths: readonly BoothObject[],
  apps: readonly VendorApplicationSnapshot[]
): Array<{
  boothId: string
  vendorId: string
  label: string
  categoryName: string | null
}> {
  const byVendorId = new Map(apps.map((a) => [a.vendor_id, a]))
  const byApplicationId = new Map(apps.map((a) => [a.id, a]))
  const patches: Array<{
    boothId: string
    vendorId: string
    label: string
    categoryName: string | null
  }> = []

  for (const booth of booths) {
    if (!booth.vendorId) continue
    if (byVendorId.has(booth.vendorId)) continue
    const byApp = byApplicationId.get(booth.vendorId)
    if (!byApp) continue
    patches.push({
      boothId: booth.id,
      vendorId: byApp.vendor_id,
      label: byApp.vendorName ?? booth.label ?? 'Vendor',
      categoryName: byApp.categoryName ?? booth.categoryName ?? null,
    })
  }

  return patches
}

export function pickBoothForApplication(
  openBooths: BoothObject[],
  application: VendorApplicationSnapshot
): BoothObject | null {
  if (openBooths.length === 0) return null
  const category = application.categoryName?.trim().toLowerCase()
  if (category) {
    const match = openBooths.find(
      (b) => b.categoryName?.trim().toLowerCase() === category
    )
    if (match) return match
  }
  return openBooths[0] ?? null
}

/** Seat approved vendors onto open booths — honors multi-table `tableCount` per application. */
export function seatApplicationsOnOpenBooths(
  applications: readonly VendorApplicationSnapshot[],
  booths: readonly BoothObject[]
): Array<{
  boothId: string
  vendorId: string
  label: string
  categoryName: string | null
}> {
  const openBooths = booths
    .filter((booth) => !booth.vendorId)
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const patches: Array<{
    boothId: string
    vendorId: string
    label: string
    categoryName: string | null
  }> = []

  for (const application of applications) {
    const slots = Math.max(1, application.tableCount ?? 1)
    for (let slot = 0; slot < slots; slot++) {
      const booth = pickBoothForApplication(openBooths, application)
      if (!booth) break
      patches.push({
        boothId: booth.id,
        vendorId: application.vendor_id,
        label: application.vendorName ?? 'Vendor',
        categoryName: application.categoryName ?? null,
      })
      const index = openBooths.findIndex((candidate) => candidate.id === booth.id)
      if (index >= 0) openBooths.splice(index, 1)
    }
  }

  return patches
}
