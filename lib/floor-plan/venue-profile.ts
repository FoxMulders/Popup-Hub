import type { VenueProfile } from '@/types/database'
import type { FloorPlanDoc, RoomFrame } from '@/components/coordinator/floor-plan-v2/state/types'

export const DEFAULT_VENUE_PROFILE: VenueProfile = 'indoor'

export function normalizeVenueProfile(
  value: VenueProfile | null | undefined
): VenueProfile {
  return value === 'outdoor' ? 'outdoor' : 'indoor'
}

export function isOutdoorVenueProfile(
  value: VenueProfile | null | undefined
): boolean {
  return normalizeVenueProfile(value) === 'outdoor'
}

/** Active room profile from doc frames (defaults indoor). */
export function venueProfileForRoom(
  doc: Pick<FloorPlanDoc, 'rooms'>,
  roomId: string | null | undefined
): VenueProfile {
  if (!roomId) return DEFAULT_VENUE_PROFILE
  const frame = doc.rooms?.find((r) => r.id === roomId)
  return normalizeVenueProfile(frame?.venueProfile)
}

export function patchRoomVenueProfile(
  frames: ReadonlyArray<RoomFrame>,
  roomId: string,
  profile: VenueProfile
): RoomFrame[] {
  return frames.map((f) =>
    f.id === roomId ? { ...f, venueProfile: profile } : f
  )
}

/** Whether wizard room frames match doc frames for layout sync (geometry + profile). */
export function roomFrameWizardFieldsMatch(
  docFrame: Pick<
    RoomFrame,
    'name' | 'widthFt' | 'lengthFt' | 'originX' | 'originY' | 'venueProfile'
  >,
  mergedFrame: Pick<
    RoomFrame,
    'name' | 'widthFt' | 'lengthFt' | 'originX' | 'originY' | 'venueProfile'
  >
): boolean {
  return (
    docFrame.name === mergedFrame.name &&
    docFrame.widthFt === mergedFrame.widthFt &&
    docFrame.lengthFt === mergedFrame.lengthFt &&
    docFrame.originX === mergedFrame.originX &&
    docFrame.originY === mergedFrame.originY &&
    normalizeVenueProfile(docFrame.venueProfile) ===
      normalizeVenueProfile(mergedFrame.venueProfile)
  )
}
