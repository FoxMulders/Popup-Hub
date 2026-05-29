import type { ParsedFlyerResponse } from '@/lib/flyer/types'

/** True when the vision/heuristic parse returned at least one usable field. */
export function flyerHasExtractedSignal(data: ParsedFlyerResponse): boolean {
  return Boolean(
    data.eventName?.trim() ||
      data.venueName?.trim() ||
      data.address?.trim() ||
      data.location?.trim() ||
      data.date?.trim() ||
      data.startTime?.trim() ||
      data.endTime?.trim() ||
      data.description?.trim() ||
      data.ticketPrice?.trim()
  )
}
