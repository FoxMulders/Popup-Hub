import type { SupabaseClient } from '@supabase/supabase-js'
import { layoutPayloadFromRooms } from '@/lib/booth-planner/layout-rooms'
import { persistTestSuiteApplications } from '@/lib/booth-planner/persist-test-suite-applications'
import {
  layoutRoomsForScenario,
  SCENARIO_MARKET_DEFINITIONS,
  SCENARIO_MARKET_DESCRIPTION,
  scenarioCoordinateOffset,
  scheduleForScenario,
  type ScenarioMarketDefinition,
} from '@/lib/qa/scenario-market-definitions'
import type { EventCategoryLimit } from '@/types/database'

export interface SeedScenarioMarketsOptions {
  coordinatorId: string
  dryRun?: boolean
}

export interface SeedScenarioMarketsResult {
  created: number
  updated: number
  skipped: number
  markets: Array<{ id: string; name: string; action: 'created' | 'updated' | 'skipped' }>
}

interface CategoryRow {
  id: string
  name: string
}

async function resolveBroadCategory(supabase: SupabaseClient): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_broad', true)
    .neq('name', 'Alcohol')
    .order('name')
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message ?? 'No broad category found — apply migrations before seeding')
  }

  return data
}

function buildEventPayload(
  scenario: ScenarioMarketDefinition,
  coordinatorId: string,
  index: number
) {
  const schedule = scheduleForScenario(scenario.schedule)
  const coords = scenarioCoordinateOffset(index)

  return {
    coordinator_id: coordinatorId,
    name: scenario.name,
    description: SCENARIO_MARKET_DESCRIPTION,
    location_name: 'QA Community Hall',
    address: '100 QA Test Ave, Edmonton, AB',
    latitude: coords.latitude,
    longitude: coords.longitude,
    start_at: schedule.startAt,
    end_at: schedule.endAt,
    booking_mode: scenario.bookingMode ?? ('juried' as const),
    listing_type: scenario.listingType ?? ('community_market' as const),
    status: scenario.status,
    is_test: true,
    allow_mlm: scenario.allowMlm ?? false,
    max_mlm_slots: scenario.maxMlmSlots ?? null,
    require_full_attendance: true,
    skip_venue_layout: scenario.skipVenueLayout ?? false,
    market_city: 'edmonton',
    booth_clearance_policy: 'leave_furniture' as const,
    booth_price_cents: scenario.boothPriceCents ?? 0,
    passport_vendors_required: scenario.passportVendorsRequired ?? null,
    is_multi_day: scenario.isMultiDay ?? false,
    venue_verified: scenario.venueVerified ?? false,
    venue_verification_status: scenario.venueVerificationStatus ?? 'pending',
    market_insurance_required: scenario.marketInsuranceRequired ?? false,
    cancelled_at: scenario.cancelled ? new Date().toISOString() : null,
    cancellation_reason: scenario.cancelled ? ('other' as const) : null,
    cancellation_reason_notes: scenario.cancelled
      ? 'Seeded cancelled scenario market.'
      : null,
  }
}

async function upsertCategoryLimit(
  supabase: SupabaseClient,
  eventId: string,
  category: CategoryRow,
  scenario: ScenarioMarketDefinition
): Promise<void> {
  await supabase.from('event_category_limits').delete().eq('event_id', eventId)

  const maxSlots = scenario.seedTestSuite ? 48 : 20
  const pricePerBooth = scenario.categoryPricePerBooth ?? scenario.boothPriceCents ?? 0

  const { error } = await supabase.from('event_category_limits').insert({
    event_id: eventId,
    category_id: category.id,
    max_slots: maxSlots,
    price_per_booth: pricePerBooth,
  })

  if (error) throw new Error(`category limit for ${scenario.name}: ${error.message}`)
}

async function upsertEventDays(
  supabase: SupabaseClient,
  eventId: string,
  scenario: ScenarioMarketDefinition
): Promise<void> {
  await supabase.from('event_days').delete().eq('event_id', eventId)

  if (!scenario.isMultiDay) return

  const schedule = scheduleForScenario(scenario.schedule)
  const day1 = schedule.startDate
  const day2Date = new Date(schedule.startDate)
  day2Date.setDate(day2Date.getDate() + 1)
  const day2 = day2Date.toISOString().slice(0, 10)

  const { error } = await supabase.from('event_days').insert([
    {
      event_id: eventId,
      date: day1,
      start_time: '10:00',
      end_time: '16:00',
      sort_order: 0,
    },
    {
      event_id: eventId,
      date: day2,
      start_time: '10:00',
      end_time: '16:00',
      sort_order: 1,
    },
  ])

  if (error) throw new Error(`event days for ${scenario.name}: ${error.message}`)
}

async function upsertLayout(
  supabase: SupabaseClient,
  eventId: string,
  scenario: ScenarioMarketDefinition
): Promise<void> {
  if (scenario.skipVenueLayout || scenario.layout === 'none') {
    await supabase.from('booth_layouts').delete().eq('event_id', eventId)
    return
  }

  const rooms = layoutRoomsForScenario(scenario.layout)
  if (!rooms || rooms.length === 0) {
    await supabase.from('booth_layouts').delete().eq('event_id', eventId)
    return
  }

  const activeRoomId = rooms[0]!.id
  const payload = layoutPayloadFromRooms(eventId, rooms, activeRoomId)

  const { error } = await supabase.from('booth_layouts').upsert(payload, { onConflict: 'event_id' })
  if (error) throw new Error(`booth layout for ${scenario.name}: ${error.message}`)
}

async function upsertQuarterAuctionSettings(
  supabase: SupabaseClient,
  eventId: string,
  scenario: ScenarioMarketDefinition
): Promise<void> {
  if (!scenario.quarterAuction) {
    await supabase.from('quarter_auction_settings').delete().eq('event_id', eventId)
    return
  }

  const { error } = await supabase.from('quarter_auction_settings').upsert(
    {
      event_id: eventId,
      enabled: true,
      charity_milestones: [
        { amount_cents: 50000, label: 'Community Garden Beds' },
        { amount_cents: 100000, label: 'Local Youth Supplies' },
      ],
    },
    { onConflict: 'event_id' }
  )

  if (error) throw new Error(`quarter auction settings for ${scenario.name}: ${error.message}`)
}

async function seedTestSuiteForEvent(
  supabase: SupabaseClient,
  authAdmin: SupabaseClient['auth']['admin'],
  eventId: string,
  coordinatorId: string,
  category: CategoryRow,
  categoryLimits: EventCategoryLimit[],
  scenario: ScenarioMarketDefinition
): Promise<void> {
  if (!scenario.seedTestSuite) return

  const limits = categoryLimits.map((limit) => ({
    category_id: limit.category_id,
    category_name: category.name,
    max_slots: limit.max_slots,
  }))

  const maxBoothCapacity = limits.reduce((sum, limit) => sum + limit.max_slots, 0)

  await persistTestSuiteApplications({
    supabase,
    authAdmin,
    eventId,
    coordinatorId,
    maxBoothCapacity,
    venuePresetId: 'kilkenny',
    roomName: 'Main Hall',
    categoryLimits: limits,
  })
}

async function seedScenarioMarket(
  supabase: SupabaseClient,
  authAdmin: SupabaseClient['auth']['admin'],
  scenario: ScenarioMarketDefinition,
  index: number,
  coordinatorId: string,
  category: CategoryRow,
  dryRun: boolean
): Promise<'created' | 'updated' | 'skipped'> {
  const { data: existing } = await supabase
    .from('events')
    .select('id')
    .eq('coordinator_id', coordinatorId)
    .eq('name', scenario.name)
    .eq('is_test', true)
    .maybeSingle()

  if (dryRun) {
    return existing ? 'updated' : 'created'
  }

  const payload = buildEventPayload(scenario, coordinatorId, index)
  const eventRow = payload

  let eventId = existing?.id

  if (eventId) {
    const { error } = await supabase.from('events').update(eventRow).eq('id', eventId)
    if (error) throw new Error(`update ${scenario.name}: ${error.message}`)
  } else {
    const { data, error } = await supabase.from('events').insert(eventRow).select('id').single()
    if (error || !data) throw new Error(error?.message ?? `insert ${scenario.name} failed`)
    eventId = data.id
  }

  await upsertCategoryLimit(supabase, eventId, category, scenario)
  await upsertEventDays(supabase, eventId, scenario)
  await upsertLayout(supabase, eventId, scenario)
  await upsertQuarterAuctionSettings(supabase, eventId, scenario)

  if (scenario.seedTestSuite) {
    const { data: limits } = await supabase
      .from('event_category_limits')
      .select('*')
      .eq('event_id', eventId)

    await seedTestSuiteForEvent(
      supabase,
      authAdmin,
      eventId,
      coordinatorId,
      category,
      (limits ?? []) as EventCategoryLimit[],
      scenario
    )
  }

  return existing ? 'updated' : 'created'
}

export async function seedScenarioMarkets(
  supabase: SupabaseClient,
  authAdmin: SupabaseClient['auth']['admin'],
  options: SeedScenarioMarketsOptions
): Promise<SeedScenarioMarketsResult> {
  const category = await resolveBroadCategory(supabase)
  const dryRun = options.dryRun ?? false

  const result: SeedScenarioMarketsResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    markets: [],
  }

  for (let index = 0; index < SCENARIO_MARKET_DEFINITIONS.length; index++) {
    const scenario = SCENARIO_MARKET_DEFINITIONS[index]!
    const action = await seedScenarioMarket(
      supabase,
      authAdmin,
      scenario,
      index,
      options.coordinatorId,
      category,
      dryRun
    )

    if (action === 'created') result.created += 1
    else if (action === 'updated') result.updated += 1
    else result.skipped += 1

    result.markets.push({
      id: scenario.id,
      name: scenario.name,
      action,
    })
  }

  return result
}

export async function resolveCoordinatorIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string> {
  const needle = email.toLowerCase()
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((user) => user.email?.toLowerCase() === needle)
    if (match) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', match.id)
        .maybeSingle()

      if (profileError) throw new Error(profileError.message)
      if (!profile || profile.role !== 'coordinator') {
        throw new Error(`${email} is not a coordinator account`)
      }
      return match.id
    }
    if (data.users.length < perPage) break
    page += 1
  }

  throw new Error(`Coordinator not found for email: ${email}`)
}
