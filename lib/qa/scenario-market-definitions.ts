import type {
  BookingMode,
  EventListingType,
  EventStatus,
  LayoutRoom,
  VenueVerificationStatus,
} from '@/types/database'
import { MAIN_HALL_ROOM_ID } from '@/components/coordinator/floor-plan-v2/state/canvas-init'
import { createLayoutRoom } from '@/lib/booth-planner/layout-rooms'
import { roomPatchFromVenuePreset } from '@/lib/booth-planner/venue-presets'

export const SCENARIO_MARKET_DESCRIPTION =
  'Seeded scenario market — safe to delete at launch.'

export type ScenarioLayoutKind = 'none' | 'kilkenny' | 'outdoor_tent' | 'kilkenny_hubgrid'

export type ScenarioScheduleKind = 'future' | 'past' | 'active_today'

export interface ScenarioMarketDefinition {
  id: string
  name: string
  status: EventStatus
  schedule: ScenarioScheduleKind
  listingType?: EventListingType
  bookingMode?: BookingMode
  skipVenueLayout?: boolean
  isMultiDay?: boolean
  allowMlm?: boolean
  maxMlmSlots?: number | null
  passportVendorsRequired?: number | null
  boothPriceCents?: number
  categoryPricePerBooth?: number
  venueVerificationStatus?: VenueVerificationStatus
  venueVerified?: boolean
  marketInsuranceRequired?: boolean
  layout?: ScenarioLayoutKind
  quarterAuction?: boolean
  seedTestSuite?: boolean
  cancelled?: boolean
}

export const SCENARIO_MARKET_DEFINITIONS: ScenarioMarketDefinition[] = [
  {
    id: 'juried-indoor',
    name: 'Community Market — Juried Indoor Layout',
    status: 'published',
    schedule: 'future',
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'instant-booking',
    name: 'Community Market — Instant Booking',
    status: 'published',
    schedule: 'future',
    bookingMode: 'instant',
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'multi-day',
    name: 'Community Market — Multi-Day Schedule',
    status: 'published',
    schedule: 'future',
    isMultiDay: true,
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'no-floor-plan',
    name: 'Community Market — No Floor Plan',
    status: 'published',
    schedule: 'future',
    skipVenueLayout: true,
    layout: 'none',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'outdoor-tent',
    name: 'Community Market — Outdoor Tent Layout',
    status: 'published',
    schedule: 'future',
    layout: 'outdoor_tent',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'quarter-auction',
    name: 'Quarter Auction — Single Day',
    status: 'published',
    schedule: 'future',
    listingType: 'garage_yard_sale',
    skipVenueLayout: true,
    layout: 'none',
    quarterAuction: true,
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'active-status',
    name: 'Market Day — Active Status',
    status: 'active',
    schedule: 'active_today',
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'completed',
    name: 'Past Market — Completed',
    status: 'completed',
    schedule: 'past',
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'cancelled',
    name: 'Cancelled Market',
    status: 'cancelled',
    schedule: 'past',
    layout: 'kilkenny',
    cancelled: true,
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'mlm-allowed',
    name: 'MLM Vendors Allowed',
    status: 'published',
    schedule: 'future',
    allowMlm: true,
    maxMlmSlots: 5,
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'passport-gamification',
    name: 'Passport Stamp Gamification',
    status: 'published',
    schedule: 'future',
    passportVendorsRequired: 5,
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'paid-booth-fees',
    name: 'Paid Booth Fees',
    status: 'published',
    schedule: 'future',
    boothPriceCents: 2500,
    categoryPricePerBooth: 2500,
    layout: 'kilkenny',
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
  {
    id: 'venue-pending',
    name: 'Venue Verification Pending',
    status: 'published',
    schedule: 'future',
    layout: 'kilkenny',
    venueVerificationStatus: 'pending',
    venueVerified: false,
  },
  {
    id: 'hubgrid-seeded',
    name: 'HubGrid — Seeded Vendors & Layout',
    status: 'published',
    schedule: 'future',
    layout: 'kilkenny_hubgrid',
    seedTestSuite: true,
    venueVerificationStatus: 'verified',
    venueVerified: true,
  },
]

export function scenarioCoordinateOffset(index: number): { latitude: number; longitude: number } {
  const baseLat = 53.5461
  const baseLng = -113.4938
  const step = 0.002
  return {
    latitude: baseLat + index * step * 0.5,
    longitude: baseLng + index * step,
  }
}

export function scheduleForScenario(kind: ScenarioScheduleKind): {
  startAt: string
  endAt: string
  startDate: string
  endDate: string
} {
  if (kind === 'past') {
    const start = new Date()
    start.setDate(start.getDate() - 60)
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setHours(16, 0, 0, 0)
    const isoDate = (d: Date) => d.toISOString().slice(0, 10)
    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      startDate: isoDate(start),
      endDate: isoDate(end),
    }
  }

  if (kind === 'active_today') {
    const start = new Date()
    start.setHours(8, 0, 0, 0)
    const end = new Date()
    end.setHours(20, 0, 0, 0)
    const isoDate = (d: Date) => d.toISOString().slice(0, 10)
    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      startDate: isoDate(start),
      endDate: isoDate(end),
    }
  }

  // Start today so the markets appear on the default `/discover` view (preset = "today").
  const start = new Date()
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(16, 0, 0, 0)
  const isoDate = (d: Date) => d.toISOString().slice(0, 10)
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    startDate: isoDate(start),
    endDate: isoDate(end),
  }
}

function outdoorTentRoom(): LayoutRoom {
  return createLayoutRoom('Main Lot', {
    id: MAIN_HALL_ROOM_ID,
    venue_width: 80,
    venue_length: 60,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    venue_profile: 'outdoor',
    cells: [
      {
        id: 'tent-1',
        col: 4,
        row: 6,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Tent Vendor A',
        categoryName: 'Handmade Crafts',
        categoryColor: '#94a3b8',
        boothNumber: 1,
        vendorUnitType: 'tent',
        tableLengthFt: null,
      },
      {
        id: 'tent-2',
        col: 20,
        row: 6,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Tent Vendor B',
        categoryName: 'Art & Photography',
        categoryColor: '#94a3b8',
        boothNumber: 2,
        vendorUnitType: 'tent',
        tableLengthFt: null,
      },
      {
        id: 'tent-3',
        col: 36,
        row: 6,
        colSpan: 10,
        rowSpan: 10,
        vendorName: 'Tent Vendor C',
        categoryName: 'Jewelry & Accessories',
        categoryColor: '#94a3b8',
        boothNumber: 3,
        vendorUnitType: 'tent',
        tableLengthFt: null,
      },
    ],
    venue_elements: [],
  })
}

function kilkennyIndoorRoom(): LayoutRoom {
  const patch = roomPatchFromVenuePreset('kilkenny')
  return createLayoutRoom('Main Hall', {
    id: MAIN_HALL_ROOM_ID,
    ...patch,
    venue_profile: 'indoor',
  })
}

export function layoutRoomsForScenario(layout: ScenarioLayoutKind | undefined): LayoutRoom[] | null {
  switch (layout) {
    case 'kilkenny':
    case 'kilkenny_hubgrid':
      return [kilkennyIndoorRoom()]
    case 'outdoor_tent':
      return [outdoorTentRoom()]
    case 'none':
    default:
      return null
  }
}
