import type { FlyerFieldKey, FlyerFormHandlers, ParsedFlyerResponse } from '@/lib/flyer/types'
import { buildDayRowsForDateRange } from '@/lib/events/event-day-rows'
import { resolveFlyerListingType } from '@/lib/flyer/listing-type'
import { normalizeFlyerTime, splitFlyerLocation } from '@/lib/flyer/normalize'

function mapScheduleType(scheduleType: ParsedFlyerResponse['scheduleType']): 'single' | 'multi' | null {
  if (scheduleType === 'multi_day') return 'multi'
  if (scheduleType === 'single_day') return 'single'
  return null
}

/** Map API flyer fields onto wizard / event form state. Returns keys that were auto-filled. */
export function applyParsedFlyer(
  parsed: ParsedFlyerResponse,
  handlers: FlyerFormHandlers
): Set<FlyerFieldKey> {
  const filled = new Set<FlyerFieldKey>()

  if (parsed.eventName?.trim() && handlers.setEventName) {
    handlers.setEventName(parsed.eventName.trim())
    filled.add('name')
  }

  if (parsed.description?.trim() && handlers.setDescription) {
    handlers.setDescription(parsed.description.trim())
    filled.add('description')
  }

  const combinedText = [
    parsed.eventName,
    parsed.description,
    parsed.location,
    parsed.venueName,
    parsed.address,
  ]
    .filter(Boolean)
    .join(' ')

  const resolvedListingType = resolveFlyerListingType({
    listingType: parsed.listingType,
    combinedText,
  })
  const isQuarterAuction = resolvedListingType === 'garage_yard_sale'

  if (resolvedListingType && handlers.setListingType) {
    handlers.setListingType(resolvedListingType)
    filled.add('listingType')
  }

  const startTime = normalizeFlyerTime(parsed.startTime ?? null)
  if (startTime && handlers.setStartTime) {
    handlers.setStartTime(startTime)
    filled.add('startTime')
  }

  const endTime = normalizeFlyerTime(parsed.endTime ?? null)
  if (endTime && handlers.setEndTime) {
    handlers.setEndTime(endTime)
    filled.add('endTime')
  }

  const startDate = parsed.startDate?.trim() || parsed.date?.trim() || null
  const endDate = parsed.endDate?.trim() || startDate
  const mappedSchedule = mapScheduleType(parsed.scheduleType)

  if (!isQuarterAuction && mappedSchedule === 'multi' && startDate && endDate) {
    handlers.setScheduleType?.('multi')
    const dayStartTime = startTime ?? '08:00'
    const dayEndTime = endTime ?? '15:00'
    if (handlers.setDayRows) {
      handlers.setDayRows(
        buildDayRowsForDateRange(startDate, endDate, dayStartTime, dayEndTime)
      )
    }
    handlers.setStartDate?.(startDate)
    handlers.setEndDate?.(endDate)
    filled.add('startDate')
    filled.add('endDate')
  } else if (startDate) {
    if (mappedSchedule === 'single' || isQuarterAuction) {
      handlers.setScheduleType?.('single')
    }
    handlers.setStartDate?.(startDate)
    filled.add('startDate')
    handlers.setEndDate?.(isQuarterAuction ? startDate : (endDate ?? startDate))
    filled.add('endDate')
  }

  // Prefer the dedicated `venueName` + `address` keys returned by the
  // strengthened vision prompt. Fall back to the legacy combined `location`
  // string (parsed by `splitFlyerLocation`) so older API responses still
  // populate the form correctly.
  const directVenue = parsed.venueName?.trim() || null
  const directAddress = parsed.address?.trim() || null

  let resolvedVenue = directVenue
  let resolvedAddress = directAddress
  if (!resolvedVenue || !resolvedAddress) {
    const split = splitFlyerLocation(parsed.location ?? null)
    resolvedVenue = resolvedVenue || split.locationName
    resolvedAddress = resolvedAddress || split.address
  }

  if (resolvedVenue && handlers.setLocationName) {
    handlers.setLocationName(resolvedVenue)
    filled.add('locationName')
  }
  if (resolvedAddress && handlers.setAddress) {
    handlers.setAddress(resolvedAddress)
    filled.add('address')
  }

  if (parsed.ticketPrice?.trim() && handlers.setRaffleDonationRequirement) {
    handlers.setRaffleDonationRequirement(
      `Admission / ticket price: ${parsed.ticketPrice.trim()}`
    )
    filled.add('raffleDonationRequirement')
  }

  return filled
}
