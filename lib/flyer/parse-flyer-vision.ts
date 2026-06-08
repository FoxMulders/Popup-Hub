import { generateJsonFromVision } from '@/lib/ai/generate-json-vision'
import { isOpenRouterConfigured } from '@/lib/ai/env'
import { parsedFlyerSchema, type ParsedFlyerResponse } from '@/lib/flyer/types'
import { parsedFlyerListingTypeSchema, resolveFlyerListingType } from '@/lib/flyer/listing-type'
import {
  normalizeFlyerDate,
  normalizeFlyerTime,
  parseMultiDayDateSpan,
} from '@/lib/flyer/normalize'

export type FlyerVisionSource = 'openrouter' | 'heuristic'

const FLYER_VISION_SYSTEM_PROMPT =
  'You extract event-listing data from market posters. Output strict JSON only — never prose, never markdown, never wrap in code fences.'

function buildFlyerParsePrompt(): string {
  const year = new Date().getFullYear()
  const nextYear = year + 1

  return `You are an OCR + extraction model that reads market and quarter-auction event posters.
Carefully READ the visible printed text on the flyer image. Do NOT guess from filenames or context outside the image.

Return ONLY valid JSON with these keys (use null when the value is not visible or you are uncertain):
{
  "eventName": string | null,
  "venueName": string | null,
  "address": string | null,
  "schedule_type": "single_day" | "multi_day" | null,
  "start_date": string | null,
  "end_date": string | null,
  "listing_type": "community_market" | "quarter_auction" | null,
  "startTime": string | null,
  "endTime": string | null,
  "description": string | null,
  "ticketPrice": string | null
}

Rules:
- eventName: the actual MARKET / EVENT TITLE printed on the poster — usually the largest stylised text block (e.g. "Christmas Market", "Spring Bazaar", "Summer Craft Fair"). Strip prefixes like "3rd Annual", "The", "Annual", and the host organization name. Never use the host association's name as the event name. Never use the uploaded file's name. If only an organization name is visible and no distinct event title, return null.
- venueName: the building / hall / venue name printed on the flyer (e.g. "Slovenian Hall", "Servus Place", "St Albert Community Centre"). The hosting association's name counts ONLY when the venue itself isn't separately printed. Do not include the street address here.
- address: the printed street address as written on the flyer, including unit / suite if present. Combine multi-line addresses into a single comma-separated string. Append the city + province if visible (e.g. "16703 - 66 Street NW, Edmonton, AB"). Do NOT include the venue name in this field.
- schedule_type / start_date / end_date (CRITICAL):
  - Actively search for hyphenated or conjoined multi-day date sequences (e.g. "Oct 5-6", "October 5th & 6th", "Nov 12–14").
  - When a multi-day span is detected, set schedule_type to "multi_day" and assign each boundary independently as ISO YYYY-MM-DD in start_date and end_date (e.g. start_date "2026-10-05", end_date "2026-10-06"). Do NOT collapse multi-day spans into a single date.
  - For a single-day event, set schedule_type to "single_day", start_date to that day, and end_date to the same day or null.
  - Year assignment: when the flyer shows month/day without an explicit year, compare against today's calendar date (current year is ${year}). If that month/day has already passed in ${year}, use ${nextYear}; otherwise use ${year}. Never output a year before ${year} unless the year is explicitly printed on the flyer.
  - Always prefer ISO YYYY-MM-DD in start_date and end_date.
- listing_type (CRITICAL):
  - Decide whether this poster is for a vendor community market or a quarter/live auction event.
  - Return "quarter_auction" when the flyer text or visual design heavily features auction elements — e.g. printed phrases like "Quarter Auction", "Live Auction", "Quarter Sale", gavel/auctioneer imagery, paddle bidding, lot numbers, or bid-call language.
  - Return "community_market" for craft fairs, bazaars, vendor markets, holiday markets, and similar booth-based events with no auction theme.
  - Use null only when the listing type is genuinely unclear from the poster.
- startTime / endTime: prefer 24-hour HH:mm; otherwise return the printed text (e.g. "9:30 AM").
- description: a one or two sentence neutral summary suitable for a market listing — not raw OCR dump and not marketing fluff.
- ticketPrice: admission, booth fee, or ticket price exactly as printed including currency symbol. Use "FREE" when the flyer says free entry / free admission.

If the image is too blurry or has no readable text, return all null values.`
}

function fileToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/** Strip optional markdown fences when the model ignores JSON-only instructions. */
function extractJsonPayload(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  if (fenced) return fenced[1].trim()
  const inline = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (inline) return inline[1].trim()
  return trimmed
}

/** Accept snake_case keys from the vision model and map onto camelCase fields. */
function coerceRawFlyerPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const record = raw as Record<string, unknown>
  return {
    ...record,
    eventName: record.eventName ?? record.event_name ?? null,
    venueName: record.venueName ?? record.venue_name ?? null,
    scheduleType: record.scheduleType ?? record.schedule_type ?? null,
    listingType: record.listingType ?? record.listing_type ?? null,
    startDate: record.startDate ?? record.start_date ?? null,
    endDate: record.endDate ?? record.end_date ?? null,
    startTime: record.startTime ?? record.start_time ?? null,
    endTime: record.endTime ?? record.end_time ?? null,
    ticketPrice: record.ticketPrice ?? record.ticket_price ?? null,
    date: record.date ?? null,
  }
}

/**
 * Filename-based fallback used when no OpenRouter API key is configured.
 *
 * Intentionally does NOT populate the event name from the filename — the
 * coordinator complained that uploads like "Craft_Fair_Poster_2024.png"
 * were filling the market name with the file slug. Returning null lets the
 * UI render an empty "name" field that the coordinator can type manually
 * instead of being seeded with garbage.
 *
 * The filename date heuristic is preserved because date prefixes
 * ("2024-11-30-poster.png") are common and unambiguous.
 */
function heuristicFromFilename(fileName: string): ParsedFlyerResponse {
  const base = fileName.replace(/\.[^.]+$/, '')
  const dateMatch =
    base.match(/(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})/) ??
    base.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/)

  let date: string | null = null
  if (dateMatch) {
    if (dateMatch[1].length === 4) {
      date = normalizeFlyerDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
    } else {
      date = normalizeFlyerDate(`${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`)
    }
  }

  return parsedFlyerSchema.parse({
    eventName: null,
    venueName: null,
    address: null,
    scheduleType: date ? 'single_day' : null,
    startDate: date,
    endDate: date,
    date,
    startTime: null,
    endTime: null,
    location: null,
    description: null,
    ticketPrice: null,
  })
}

function normalizeListingType(value: string | null | undefined) {
  if (!value?.trim()) return null
  const raw = value.trim().toLowerCase()
  if (raw === 'quarter_auction' || raw === 'garage_yard_sale') {
    return parsedFlyerListingTypeSchema.parse('quarter_auction')
  }
  if (raw === 'community_market') {
    return parsedFlyerListingTypeSchema.parse('community_market')
  }
  return null
}

function resolveFlyerListingFields(data: ParsedFlyerResponse): ParsedFlyerResponse {
  const combinedText = [
    data.eventName,
    data.description,
    data.location,
    data.venueName,
    data.address,
  ]
    .filter(Boolean)
    .join(' ')

  const listingType =
    normalizeListingType(data.listingType) ??
    (resolveFlyerListingType({ combinedText }) === 'garage_yard_sale'
      ? parsedFlyerListingTypeSchema.parse('quarter_auction')
      : null)

  return { ...data, listingType }
}

function resolveFlyerScheduleDates(data: ParsedFlyerResponse): ParsedFlyerResponse {
  let scheduleType = data.scheduleType ?? null
  let startDate = data.startDate ?? null
  let endDate = data.endDate ?? null
  const legacyDate = data.date ?? null

  if (!startDate && legacyDate) {
    const span = parseMultiDayDateSpan(legacyDate)
    if (span) {
      scheduleType = 'multi_day'
      startDate = span.startDate
      endDate = span.endDate
    }
  }

  startDate = normalizeFlyerDate(startDate) ?? startDate
  endDate = normalizeFlyerDate(endDate) ?? endDate

  if (!startDate && legacyDate) {
    startDate = normalizeFlyerDate(legacyDate)
  }

  if (!endDate && startDate) {
    endDate = startDate
  }

  if (startDate && endDate && startDate !== endDate && scheduleType !== 'single_day') {
    scheduleType = 'multi_day'
  }

  if (!scheduleType && startDate) {
    scheduleType = startDate !== endDate ? 'multi_day' : 'single_day'
  }

  if (data.listingType === 'quarter_auction') {
    scheduleType = 'single_day'
    if (startDate) endDate = startDate
  }

  return {
    ...data,
    scheduleType,
    startDate,
    endDate,
    date: startDate ?? legacyDate ?? null,
  }
}

function normalizeParsedFlyer(data: ParsedFlyerResponse): ParsedFlyerResponse {
  const withListing = resolveFlyerListingFields(data)
  const resolved = resolveFlyerScheduleDates(withListing)

  return parsedFlyerSchema.parse({
    eventName: resolved.eventName ?? null,
    venueName: resolved.venueName ?? null,
    address: resolved.address ?? null,
    listingType: resolved.listingType ?? null,
    scheduleType: resolved.scheduleType ?? null,
    startDate: resolved.startDate ?? null,
    endDate: resolved.endDate ?? null,
    date: resolved.date ?? null,
    startTime: normalizeFlyerTime(resolved.startTime ?? null) ?? resolved.startTime ?? null,
    endTime: normalizeFlyerTime(resolved.endTime ?? null) ?? resolved.endTime ?? null,
    location: resolved.location ?? null,
    description: resolved.description ?? null,
    ticketPrice: resolved.ticketPrice ?? null,
  })
}

export async function parseFlyerWithVision(input: {
  buffer: Buffer
  mimeType: string
  fileName: string
}): Promise<{ data: ParsedFlyerResponse; source: FlyerVisionSource }> {
  if (!isOpenRouterConfigured()) {
    return { data: heuristicFromFilename(input.fileName), source: 'heuristic' }
  }

  const dataUrl = fileToDataUrl(input.buffer, input.mimeType)

  const { content, provider } = await generateJsonFromVision({
    systemPrompt: FLYER_VISION_SYSTEM_PROMPT,
    userPrompt: buildFlyerParsePrompt(),
    dataUrl,
    mimeType: input.mimeType,
    task: 'flyer_vision',
  })

  const raw = JSON.parse(extractJsonPayload(content)) as unknown
  const data = parsedFlyerSchema.parse(coerceRawFlyerPayload(raw))

  return {
    data: normalizeParsedFlyer(data),
    source: provider,
  }
}
