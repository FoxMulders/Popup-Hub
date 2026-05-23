export type EventCancellationReason =
  | 'force_majeure'
  | 'low_vendor_turnout'
  | 'logistical_personal'
  | 'other'

export const CANCELLATION_REASONS: {
  value: EventCancellationReason
  label: string
  description: string
  isEmergency: boolean
}[] = [
  {
    value: 'force_majeure',
    label: 'Force Majeure',
    description: 'Weather, safety, or other emergencies beyond your control',
    isEmergency: true,
  },
  {
    value: 'low_vendor_turnout',
    label: 'Low Vendor Turnout',
    description: 'Insufficient vendor interest or approvals to run the market',
    isEmergency: false,
  },
  {
    value: 'logistical_personal',
    label: 'Logistical / Personal',
    description: 'Venue, staffing, or personal circumstances',
    isEmergency: false,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Another reason — provide details below',
    isEmergency: false,
  },
]

const REASON_MAP = Object.fromEntries(
  CANCELLATION_REASONS.map((r) => [r.value, r])
) as Record<EventCancellationReason, (typeof CANCELLATION_REASONS)[number]>

export function isEmergencyCancellationReason(reason: EventCancellationReason): boolean {
  return REASON_MAP[reason]?.isEmergency ?? false
}

export function getCancellationReasonLabel(
  reason: EventCancellationReason,
  notes?: string | null
): string {
  const base = REASON_MAP[reason]?.label ?? reason
  if (reason === 'other' && notes?.trim()) {
    return `${base}: ${notes.trim()}`
  }
  return base
}

export function isValidCancellationReason(value: string): value is EventCancellationReason {
  return value in REASON_MAP
}
