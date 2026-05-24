import { format, isValid, parseISO } from 'date-fns'
import type { Event } from '@/types/database'

export interface FlyerExtractedDetails {
  eventName: string | null
  eventDate: Date | null
  eventDateLabel: string | null
  locationHint: string | null
  suggestsQuarterAuction: boolean
  matchedEventId: string | null
  confidence: 'high' | 'medium' | 'low'
  sourceNotes: string[]
}

const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => Date | null }[] = [
  {
    re: /(\d{4})[-_./](\d{1,2})[-_./](\d{1,2})/,
    parse: (m) => {
      const d = parseISO(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)
      return isValid(d) ? d : null
    },
  },
  {
    re: /(\d{1,2})[-_./](\d{1,2})[-_./](\d{4})/,
    parse: (m) => {
      const d = parseISO(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)
      return isValid(d) ? d : null
    },
  },
]

const QUARTER_AUCTION_KEYWORDS =
  /\b(quarter\s*auction|quarter\s*sale|qa\b|garage\s*sale|yard\s*sale)\b/i

function parseDateFromFilename(name: string): Date | null {
  for (const { re, parse } of DATE_PATTERNS) {
    const match = name.match(re)
    if (match) {
      const d = parse(match)
      if (d) return d
    }
  }
  return null
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function findBestEventMatch(
  events: Event[],
  hints: { name?: string | null; date?: Date | null; location?: string | null }
): Event | null {
  const nameHint = hints.name ? normalizeForMatch(hints.name) : ''
  const locationHint = hints.location ? normalizeForMatch(hints.location) : ''

  let best: { event: Event; score: number } | null = null

  for (const event of events) {
    let score = 0
    if (hints.date) {
      const eventDay = format(new Date(event.start_at), 'yyyy-MM-dd')
      const hintDay = format(hints.date, 'yyyy-MM-dd')
      if (eventDay === hintDay) score += 3
    }
    if (nameHint) {
      const eventName = normalizeForMatch(event.name)
      if (eventName.includes(nameHint) || nameHint.includes(eventName)) score += 2
    }
    if (locationHint) {
      const loc = normalizeForMatch(event.location_name)
      if (loc.includes(locationHint) || locationHint.includes(loc)) score += 1
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { event, score }
    }
  }

  return best && best.score >= 2 ? best.event : null
}

/** Best-effort extraction from flyer filename + optional event catalog match. */
export function parseFlyerImage(
  file: File,
  events: Event[]
): FlyerExtractedDetails {
  const sourceNotes: string[] = []
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const suggestsQuarterAuction = QUARTER_AUCTION_KEYWORDS.test(baseName)

  if (suggestsQuarterAuction) {
    sourceNotes.push('Filename suggests a quarter auction event.')
  }

  let eventDate = parseDateFromFilename(file.name)
  if (eventDate) {
    sourceNotes.push('Date detected in filename.')
  } else if (file.lastModified) {
    eventDate = new Date(file.lastModified)
    sourceNotes.push('Using file date as a hint (no date found in filename).')
  }

  const eventDateLabel = eventDate ? format(eventDate, 'EEEE, MMMM d, yyyy') : null

  const nameFromFile = baseName
    .replace(DATE_PATTERNS[0].re, '')
    .replace(DATE_PATTERNS[1].re, '')
    .replace(/[-_]+/g, ' ')
    .trim()

  const matched = findBestEventMatch(events, {
    name: nameFromFile.length > 3 ? nameFromFile : null,
    date: eventDate,
  })

  const eventName = matched?.name ?? (nameFromFile.length > 3 ? nameFromFile : null)
  const locationHint = matched?.location_name ?? null
  const matchedEventId = matched?.id ?? null

  let confidence: FlyerExtractedDetails['confidence'] = 'low'
  if (matched && eventDate) confidence = 'high'
  else if (matched || eventDate) confidence = 'medium'

  if (matched) {
    sourceNotes.push('Matched a published market in our catalog.')
  }

  return {
    eventName,
    eventDate: matched ? new Date(matched.start_at) : eventDate,
    eventDateLabel: matched
      ? format(new Date(matched.start_at), 'EEEE, MMMM d, yyyy')
      : eventDateLabel,
    locationHint,
    suggestsQuarterAuction:
      suggestsQuarterAuction || (matched?.listing_type ?? '') === 'garage_yard_sale',
    matchedEventId,
    confidence,
    sourceNotes,
  }
}
