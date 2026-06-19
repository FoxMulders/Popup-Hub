export type OrganizerReviewPayload = {
  organizerSlug: string
  eventName: string
  eventMonthYear: string
  eventAsAdvertised: 'yes' | 'partial' | 'no'
  wouldReturn: boolean
  attendanceVsExpectations: 'much_lower' | 'lower' | 'about_right' | 'higher'
  communicationRating: number
  refundExperience: 'na' | 'fast' | 'slow' | 'never_received'
  optionalNotes?: string
}

const MONTH_YEAR = /^\d{4}-\d{2}$/

export function parseOrganizerReviewPayload(body: unknown):
  | { ok: true; data: OrganizerReviewPayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' }
  }

  const raw = body as Record<string, unknown>
  const organizerSlug = String(raw.organizerSlug ?? '').trim()
  const eventName = String(raw.eventName ?? '').trim()
  const eventMonthYear = String(raw.eventMonthYear ?? '').trim()
  const eventAsAdvertised = raw.eventAsAdvertised
  const attendanceVsExpectations = raw.attendanceVsExpectations
  const refundExperience = raw.refundExperience ?? 'na'
  const communicationRating = Number(raw.communicationRating)
  const wouldReturn = raw.wouldReturn === true
  const optionalNotes =
    typeof raw.optionalNotes === 'string' ? raw.optionalNotes.trim().slice(0, 500) : undefined

  if (!organizerSlug) return { ok: false, error: 'Select an organizer' }
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
    data: {
      organizerSlug,
      eventName,
      eventMonthYear,
      eventAsAdvertised: eventAsAdvertised as OrganizerReviewPayload['eventAsAdvertised'],
      wouldReturn,
      attendanceVsExpectations:
        attendanceVsExpectations as OrganizerReviewPayload['attendanceVsExpectations'],
      communicationRating,
      refundExperience: refundExperience as OrganizerReviewPayload['refundExperience'],
      optionalNotes: optionalNotes || undefined,
    },
  }
}
