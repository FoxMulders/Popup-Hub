import { addDays, format, nextSaturday, setHours, setMinutes, startOfDay } from 'date-fns'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import type { DayRowPayload, EventDraftPayloadInput } from '@/lib/wizard/wizard-autosave'
import { appendLayoutRoom } from '@/lib/coordinator/add-layout-room'
import { layoutPayloadFromRooms } from '@/lib/booth-planner/layout-rooms'
import { DEFAULT_MARKET_START, DEFAULT_MARKET_END } from '@/lib/wizard/wizard-panel-styles'

export const DEMO_MARKET_NAME = 'Demo Makers Market (draft)'

function demoMarketSaturday(): Date {
  const today = startOfDay(new Date())
  const saturday = nextSaturday(today)
  return today.getDay() === 6 ? addDays(saturday, 7) : saturday
}

export function buildDemoMarketSchedule(): {
  dayRows: DayRowPayload[]
  startAt: string
  endAt: string
} {
  const marketDay = demoMarketSaturday()
  const dateStr = format(marketDay, 'yyyy-MM-dd')
  const [startH, startM] = DEFAULT_MARKET_START.split(':').map(Number)
  const [endH, endM] = DEFAULT_MARKET_END.split(':').map(Number)
  const start = setMinutes(setHours(marketDay, startH), startM ?? 0)
  const end = setMinutes(setHours(marketDay, endH), endM ?? 0)

  return {
    dayRows: [{ date: dateStr, start_time: DEFAULT_MARKET_START, end_time: DEFAULT_MARKET_END }],
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  }
}

export function buildDemoMarketDraft(coordinatorId: string): EventDraftPayloadInput {
  const { startAt, endAt } = buildDemoMarketSchedule()
  return {
    name: DEMO_MARKET_NAME,
    description:
      'Practice market for learning Popup Hub — update the name, venue, and booth fees before you publish.',
    locationName: 'Community Hall',
    address: '123 Demo Street NW, Edmonton, AB',
    latitude: 53.5461,
    longitude: -113.4938,
    bookingMode: 'instant',
    allowMlm: false,
    boothClearancePolicy: 'not_required',
    raffleDonationRequirement: '',
    scheduleType: 'single',
    startAt,
    endAt,
    listingType: 'community_market',
    marketCity: 'edmonton',
    boothPriceCents: 2500,
    skipVenueLayout: false,
  }
}

export function buildDemoCategoryLimits(
  categories: Array<{ id: string; name: string }>
): CategoryLimit[] {
  return categories.slice(0, 3).map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    maxSlots: 6,
    pricePerBooth: 25,
    tableLengthFt: 6,
  }))
}

export function buildDemoLayoutPayload(eventId: string) {
  const { rooms, activeRoomId } = appendLayoutRoom([], {
    presetId: 'blank',
    widthFt: 40,
    lengthFt: 50,
  })
  return {
    payload: layoutPayloadFromRooms(eventId, rooms, activeRoomId),
    activeRoomId,
  }
}
