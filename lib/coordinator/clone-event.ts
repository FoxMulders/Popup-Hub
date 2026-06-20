import { addDays, format, parseISO } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import {
  persistEventDraft,
  persistLayoutDraft,
  type DayRowPayload,
  type EventDraftPayload,
} from '@/lib/wizard/wizard-autosave'
import type { BoothLayout, Event, EventCategoryLimit, EventDay } from '@/types/database'

const CLONE_DAY_OFFSET = 7

function shiftIsoDate(iso: string, days: number): string {
  return addDays(parseISO(iso), days).toISOString()
}

function shiftDateString(date: string, days: number): string {
  return format(addDays(parseISO(`${date}T12:00:00`), days), 'yyyy-MM-dd')
}

function buildCategoryLimits(limits: EventCategoryLimit[] | undefined): CategoryLimit[] {
  return (limits ?? []).map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category?.name ?? '',
    maxSlots: row.max_slots,
    pricePerBooth: row.price_per_booth,
    tableLengthFt: row.table_length_ft ?? null,
  }))
}

function buildDayRows(days: EventDay[] | undefined): DayRowPayload[] {
  return [...(days ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((day) => ({
      date: shiftDateString(day.date, CLONE_DAY_OFFSET),
      start_time: day.start_time,
      end_time: day.end_time,
    }))
}

function buildCloneDraft(source: Event, coordinatorId: string): EventDraftPayload {
  return {
    coordinatorId,
    name: `${source.name.trim()} (copy)`,
    description: source.description ?? '',
    locationName: source.location_name,
    address: source.address,
    latitude: source.latitude,
    longitude: source.longitude,
    bookingMode: source.booking_mode,
    allowMlm: source.allow_mlm,
    maxMlmSlots: source.max_mlm_slots ?? undefined,
    boothClearancePolicy: source.booth_clearance_policy,
    raffleDonationRequirement: source.raffle_donation_requirement ?? '',
    scheduleType: source.is_multi_day ? 'multi' : 'single',
    startAt: shiftIsoDate(source.start_at, CLONE_DAY_OFFSET),
    endAt: shiftIsoDate(source.end_at, CLONE_DAY_OFFSET),
    coverImageUrl: source.cover_image_url,
    status: 'draft',
    listingType: source.listing_type,
    requireFullAttendance: source.require_full_attendance,
    marketInsuranceRequired: source.market_insurance_required ?? false,
    skipVenueLayout: source.skip_venue_layout ?? false,
    marketCity: source.market_city ?? 'edmonton',
    boothPriceCents: source.booth_price_cents ?? 0,
    multiTableDiscountPercent: source.multi_table_discount_percent ?? 0,
    communityLeagueDiscountEnabled: source.community_league_discount_enabled ?? false,
    communityLeagueDiscountPercent: source.community_league_discount_percent ?? 0,
    boothContractEnabled: source.booth_contract_enabled ?? true,
    boothContractClauses: source.booth_contract_clauses ?? [],
    boothContractPdfUrl: source.booth_contract_pdf_url ?? null,
  }
}

export async function cloneCoordinatorEvent(
  supabase: SupabaseClient,
  sourceEventId: string,
  coordinatorId: string
): Promise<{ eventId: string } | { error: string }> {
  const { data: source, error: sourceError } = await supabase
    .from('events')
    .select(
      `
      *,
      category_limits:event_category_limits(*, category:categories(name)),
      event_days(*)
    `
    )
    .eq('id', sourceEventId)
    .eq('coordinator_id', coordinatorId)
    .single()

  if (sourceError || !source) {
    return { error: sourceError?.message ?? 'Market not found' }
  }

  const typedSource = source as Event & {
    category_limits?: EventCategoryLimit[]
    event_days?: EventDay[]
  }

  const scheduleType = typedSource.is_multi_day ? 'multi' : 'single'
  const categoryLimits = buildCategoryLimits(typedSource.category_limits)
  const dayRows = buildDayRows(typedSource.event_days)
  const draft = buildCloneDraft(typedSource, coordinatorId)

  const { eventId, error: draftError } = await persistEventDraft(
    supabase,
    null,
    draft,
    categoryLimits,
    dayRows,
    scheduleType,
    { coordinatorId }
  )

  if (draftError || !eventId) {
    return { error: draftError?.message ?? 'Could not clone market' }
  }

  const { data: layout } = await supabase
    .from('booth_layouts')
    .select('*')
    .eq('event_id', sourceEventId)
    .maybeSingle()

  if (layout) {
    const row = layout as BoothLayout & Record<string, unknown>
    const {
      id: _id,
      event_id: _eventId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...rest
    } = row
    const { error: layoutError } = await persistLayoutDraft(supabase, eventId, {
      ...rest,
      event_id: eventId,
    })
    if (layoutError) {
      return { error: layoutError.message }
    }
  }

  return { eventId }
}
