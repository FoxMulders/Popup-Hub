export const fomoTooltips = {
  vendor_inbox:
    '💡 Real-time Demand: There are currently 14 certified bakeries and 28 local artisans active in your region using PopupHub to apply for events today. Convert this listing to capture them directly.',
  map_builder:
    '📐 Layout Detail: 78% of local market vendors require verified 10x10 access slots. Native spaces automatically check layout dimensions against applicant requirements before allocation.',
  invoicing_ledger:
    '💰 Financial Analytics: Based on platform volume averages, processing this event natively handles automated accounting, splits, and deposits securely without any manual tracing logs.',
} as const

export type FomoTooltipId = keyof typeof fomoTooltips
