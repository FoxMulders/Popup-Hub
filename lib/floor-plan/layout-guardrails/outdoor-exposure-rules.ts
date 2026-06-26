import { resolvePlacementRoomIdForObject, activeDropZoneRooms } from '@/components/coordinator/floor-plan-v2/geometry/is-point-in-room'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type { BoothObject, FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import { isOutdoorVenueProfile } from '@/lib/floor-plan/venue-profile'

export const OUTDOOR_EXPOSURE_SOURCE_ID = '__outdoor_lot__'

/** True when the floor plan includes at least one outdoor venue room. */
export function docHasOutdoorVenue(doc: FloorPlanDoc): boolean {
  const rooms = activeDropZoneRooms(doc)
  return rooms.some((room) => isOutdoorVenueProfile(room.venueProfile))
}

/** Vendor booth whose footprint center lies outside every room polygon. */
export function isVendorBoothOutsideRooms(doc: FloorPlanDoc, booth: BoothObject): boolean {
  if (!isVendorBoothObject(booth)) return false
  return resolvePlacementRoomIdForObject(doc, booth) === null
}

export interface OutdoorExposureIssue {
  boothId: string
  boothLabel: string
  categoryName: string | null
}

export function findOutdoorExposureIssue(
  doc: FloorPlanDoc,
  booth: BoothObject
): OutdoorExposureIssue | null {
  if (!docHasOutdoorVenue(doc)) return null
  if (!isVendorBoothOutsideRooms(doc, booth)) return null

  return {
    boothId: booth.id,
    boothLabel:
      booth.label?.trim() ||
      `Booth at ${Math.round(booth.x)}′, ${Math.round(booth.y)}′`,
    categoryName: booth.categoryName ?? null,
  }
}

export function listOutdoorExposureIssues(doc: FloorPlanDoc): OutdoorExposureIssue[] {
  if (!docHasOutdoorVenue(doc)) return []

  const issues: OutdoorExposureIssue[] = []
  for (const obj of doc.objects) {
    if (obj.kind !== 'booth') continue
    const issue = findOutdoorExposureIssue(doc, obj as BoothObject)
    if (issue) issues.push(issue)
  }
  return issues
}

export function boothHasOutdoorExposure(
  doc: FloorPlanDoc,
  booth: BoothObject
): boolean {
  return findOutdoorExposureIssue(doc, booth) !== null
}

export function vendorBoothOutdoorExposureByObjectId(
  doc: FloorPlanDoc
): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const issue of listOutdoorExposureIssues(doc)) {
    map.set(issue.boothId, true)
  }
  return map
}
