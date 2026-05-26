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

  const combinedText = [
    parsed.eventName,
    parsed.description,
    parsed.location,
    parsed.venueName,
    parsed.address,
  ]
    .filter(Boolean)
    .join(' ')
  if (handlers.setListingType && QUARTER_AUCTION_RE.test(combinedText)) {
    handlers.setListingType('garage_yard_sale')
  }

  return filled
}
