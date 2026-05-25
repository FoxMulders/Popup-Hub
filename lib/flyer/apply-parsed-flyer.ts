import type { FlyerFieldKey, FlyerFormHandlers, ParsedFlyerResponse } from '@/lib/flyer/types'
import { normalizeFlyerDate, normalizeFlyerTime, splitFlyerLocation } from '@/lib/flyer/normalize'

const QUARTER_AUCTION_RE =
  /\b(quarter\s*auction|quarter\s*sale|garage\s*sale|yard\s*sale)\b/i

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

  const date = normalizeFlyerDate(parsed.date ?? null)
  if (date) {
    if (handlers.setStartDate) {
      handlers.setStartDate(date)
      filled.add('startDate')
    }
    if (handlers.setEndDate) {
      handlers.setEndDate(date)
      filled.add('endDate')
    }
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

  const { locationName, address } = splitFlyerLocation(parsed.location ?? null)
  if (locationName && handlers.setLocationName) {
    handlers.setLocationName(locationName)
    filled.add('locationName')
  }
  if (address && handlers.setAddress) {
    handlers.setAddress(address)
    filled.add('address')
  }

  if (parsed.ticketPrice?.trim() && handlers.setRaffleDonationRequirement) {
    handlers.setRaffleDonationRequirement(
      `Admission / ticket price: ${parsed.ticketPrice.trim()}`
    )
    filled.add('raffleDonationRequirement')
  }

  const combinedText = [parsed.eventName, parsed.description, parsed.location]
    .filter(Boolean)
    .join(' ')
  if (handlers.setListingType && QUARTER_AUCTION_RE.test(combinedText)) {
    handlers.setListingType('garage_yard_sale')
  }

  return filled
}
