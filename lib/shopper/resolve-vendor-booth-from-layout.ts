import { getLayoutRooms } from '@/lib/shopper/layout'
import { filterVendorBoothCells } from '@/lib/shopper/public-floorplan-modes'
import type { BoothLayout } from '@/types/database'

export function vendorDisplayNamesForLayoutMatch(
  passport: { business_name?: string | null } | null | undefined,
  profile: { full_name?: string | null } | null | undefined
): string[] {
  const names: string[] = []
  const business = passport?.business_name?.trim()
  const fullName = profile?.full_name?.trim()
  if (business) names.push(business)
  if (fullName && fullName !== business) names.push(fullName)
  return names
}

/**
 * Resolve the booth number a vendor should see on public/setup maps.
 * Prefers live layout truth (assigned vendor id, then vendor name) over
 * stale `booth_applications.booth_number` after HubGrid saves renumber cells.
 */
export function resolveVendorBoothHighlightFromLayout(
  layout: BoothLayout,
  options: {
    vendorUserId: string
    applicationBoothNumber?: number | null
    vendorDisplayNames?: string[]
  }
): number | null {
  const rooms = getLayoutRooms(layout)
  const cells = rooms.flatMap((room) => filterVendorBoothCells(room.cells ?? []))
  if (cells.length === 0) return null

  const byVendorId = cells.find((cell) => cell.assignedVendorId === options.vendorUserId)
  if (byVendorId) return byVendorId.boothNumber

  const normalizedNames = (options.vendorDisplayNames ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0)

  if (normalizedNames.length > 0) {
    for (const cell of cells) {
      const cellName = cell.vendorName?.trim().toLowerCase()
      if (cellName && normalizedNames.includes(cellName)) {
        return cell.boothNumber
      }
    }
  }

  const fallback = options.applicationBoothNumber
  if (fallback != null && cells.some((cell) => cell.boothNumber === fallback)) {
    return fallback
  }

  return null
}
