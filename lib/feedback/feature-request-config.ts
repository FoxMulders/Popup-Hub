export type FeatureSubmitterRole = 'coordinator' | 'vendor' | 'patron'

export type FeatureImpactLevel = 'nice_to_have' | 'workflow_blocked' | 'critical'

export const FEATURE_SUBMITTER_ROLE_OPTIONS: {
  value: FeatureSubmitterRole
  label: string
}[] = [
  { value: 'coordinator', label: 'Event Coordinator' },
  { value: 'vendor', label: 'Market Vendor' },
  { value: 'patron', label: 'Event Patron / Visitor' },
]

export const FEATURE_TARGET_COMPONENTS: Record<
  FeatureSubmitterRole,
  { value: string; label: string }[]
> = {
  coordinator: [
    { value: 'canvas_floor_plan', label: 'Canvas Floor Plan Designer' },
    { value: 'ai_auto_arrange', label: 'AI Auto-Arrange Flow' },
    { value: 'vendor_payments_escrow', label: 'Vendor Payments & Escrow' },
    { value: 'other', label: 'Other' },
  ],
  vendor: [
    { value: 'booth_booking', label: 'Booth Booking Process' },
    { value: 'floor_plan_navigation', label: 'Floor Plan Navigation' },
    { value: 'payouts_receipts', label: 'Payouts & Receipts' },
    { value: 'profile_passport', label: 'Profile Passport' },
    { value: 'other', label: 'Other' },
  ],
  patron: [
    { value: 'interactive_event_map', label: 'Interactive Event Map' },
    { value: 'find_vendor_search', label: 'Find a Vendor / Search' },
    { value: 'other', label: 'Other' },
  ],
}

export const FEATURE_IMPACT_LEVELS: {
  value: FeatureImpactLevel
  label: string
  description: string
}[] = [
  {
    value: 'nice_to_have',
    label: '🟢 Nice to Have',
    description: 'A small polish or quality-of-life upgrade',
  },
  {
    value: 'workflow_blocked',
    label: '🟡 Workflow Blocked',
    description: 'I have to use a frustrating manual workaround',
  },
  {
    value: 'critical',
    label: '🔴 Critical / Urgent',
    description:
      'This is actively losing me money, business, or breaking my experience',
  },
]

export function defaultSubmitterRoleFromPortal(
  portal: 'coordinator' | 'vendor' | 'patron'
): FeatureSubmitterRole {
  return portal
}

export function isValidSubmitterRole(value: string): value is FeatureSubmitterRole {
  return value === 'coordinator' || value === 'vendor' || value === 'patron'
}

export function isValidImpactLevel(value: string): value is FeatureImpactLevel {
  return value === 'nice_to_have' || value === 'workflow_blocked' || value === 'critical'
}

export function isValidTargetComponent(role: FeatureSubmitterRole, value: string): boolean {
  return FEATURE_TARGET_COMPONENTS[role].some((option) => option.value === value)
}
