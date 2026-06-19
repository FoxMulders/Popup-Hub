export type OrganizerReviewFields = {
  eventName: string
  eventMonthYear: string
  eventAsAdvertised: 'yes' | 'partial' | 'no'
  wouldReturn: boolean
  attendanceVsExpectations: 'much_lower' | 'lower' | 'about_right' | 'higher'
  communicationRating: number
  refundExperience: 'na' | 'fast' | 'slow' | 'never_received'
  optionalNotes?: string
}

export type OrganizerSuggestPayload = {
  displayName: string
  city: string
  websiteUrl?: string
  facebookUrl?: string
  contactName?: string
}

export type OrganizerReviewPayload =
  | ({ mode: 'existing'; organizerSlug: string } & OrganizerReviewFields)
  | ({ mode: 'suggest'; suggestOrganizer: OrganizerSuggestPayload } & OrganizerReviewFields)

const MONTH_YEAR = /^\d{4}-\d{2}$/

function parseReviewFields(raw: Record<string, unknown>):
  | { ok: true; fields: OrganizerReviewFields }
  | { ok: false; error: string } {
  const eventName = String(raw.eventName ?? '').trim()
  const eventMonthYear = String(raw.eventMonthYear ?? '').trim()
  const eventAsAdvertised = raw.eventAsAdvertised
  const attendanceVsExpectations = raw.attendanceVsExpectations
  const refundExperience = raw.refundExperience ?? 'na'
  const communicationRating = Number(raw.communicationRating)
  const wouldReturn = raw.wouldReturn === true
  const optionalNotes =
    typeof raw.optionalNotes === 'string' ? raw.optionalNotes.trim().slice(0, 500) : undefined

  if (eventName.length < 2) return { ok: false, error: 'Enter the market or event name' }
  if (!MONTH_YEAR.test(eventMonthYear)) {
    return { ok: false, error: 'Select when you vended (month and year)' }
  }
  if (!['yes', 'partial', 'no'].includes(String(eventAsAdvertised))) {
    return { ok: false, error: 'Select whether the event matched the listing' }
  }
  if (
    !['much_lower', 'lower', 'about_right', 'higher'].includes(String(attendanceVsExpectations))
  ) {
    return { ok: false, error: 'Select how busy it felt' }
  }
  if (!Number.isInteger(communicationRating) || communicationRating < 1 || communicationRating > 5) {
    return { ok: false, error: 'Communication rating must be 1–5' }
  }
  if (!['na', 'fast', 'slow', 'never_received'].includes(String(refundExperience))) {
    return { ok: false, error: 'Invalid refund experience' }
  }

  return {
    ok: true,
    fields: {
      eventName,
      eventMonthYear,
      eventAsAdvertised: eventAsAdvertised as OrganizerReviewFields['eventAsAdvertised'],
      wouldReturn,
      attendanceVsExpectations:
        attendanceVsExpectations as OrganizerReviewFields['attendanceVsExpectations'],
      communicationRating,
      refundExperience: refundExperience as OrganizerReviewFields['refundExperience'],
      optionalNotes: optionalNotes || undefined,
    },
  }
}

function parseSuggestOrganizer(raw: unknown):
  | { ok: true; suggest: OrganizerSuggestPayload }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Enter organizer name and city' }
  }

  const obj = raw as Record<string, unknown>
  const displayName = String(obj.displayName ?? '').trim()
  const city = String(obj.city ?? '').trim()
  const websiteUrl = String(obj.websiteUrl ?? '').trim() || undefined
  const facebookUrl = String(obj.facebookUrl ?? '').trim() || undefined
  const contactName = String(obj.contactName ?? '').trim() || undefined

  if (displayName.length < 2) {
    return { ok: false, error: 'Enter the organizer or business name' }
  }
  if (city.length < 2) {
    return { ok: false, error: 'Enter the city where this organizer runs markets' }
  }

  return {
    ok: true,
    suggest: {
      displayName,
      city,
      websiteUrl,
      facebookUrl,
      contactName,
    },
  }
}

export function parseOrganizerReviewPayload(body: unknown):
  | { ok: true; data: OrganizerReviewPayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' }
  }

  const raw = body as Record<string, unknown>
  const fieldsResult = parseReviewFields(raw)
  if (!fieldsResult.ok) return fieldsResult

  const suggestRaw = raw.suggestOrganizer
  const organizerSlug = String(raw.organizerSlug ?? '').trim()
  const notListed = raw.notListed === true || suggestRaw != null

  if (notListed) {
    const suggestResult = parseSuggestOrganizer(suggestRaw ?? raw)
    if (!suggestResult.ok) return suggestResult

    return {
      ok: true,
      data: {
        mode: 'suggest',
        suggestOrganizer: suggestResult.suggest,
        ...fieldsResult.fields,
      },
    }
  }

  if (!organizerSlug) return { ok: false, error: 'Select an organizer' }

  return {
    ok: true,
    data: {
      mode: 'existing',
      organizerSlug,
      ...fieldsResult.fields,
    },
  }
}
