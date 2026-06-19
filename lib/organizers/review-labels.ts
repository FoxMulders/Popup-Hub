export const EVENT_AS_ADVERTISED_LABELS: Record<string, string> = {
  yes: 'Yes — as advertised',
  partial: 'Partially — some surprises',
  no: 'No — not as advertised',
}

export const ATTENDANCE_LABELS: Record<string, string> = {
  much_lower: 'Much quieter than expected',
  lower: 'Quieter than expected',
  about_right: 'About what I expected',
  higher: 'Busier than expected',
}

export const REFUND_LABELS: Record<string, string> = {
  na: 'N/A — no refund needed',
  fast: 'Refund was fast',
  slow: 'Refund was slow',
  never_received: 'Never received a refund',
}

export const VERIFICATION_TIER_LABELS: Record<string, string> = {
  unverified: 'Vendor review',
  receipt_verified: 'Receipt verified',
  invited_verified: 'Invited verified',
  platform_verified: 'PopUp Hub verified',
}
