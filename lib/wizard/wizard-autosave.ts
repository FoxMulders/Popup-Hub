import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoothClearancePolicy, EventListingType } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { DESCRIPTION_MIN_LENGTH } from '@/lib/wizard/critique/copy-audit'
import { effectiveScheduleTypeForListing } from '@/lib/events/listing-type'

export interface EventDraftPayload {
  coordinatorId: string
  name: string
  description: string
  locationName: string
  address: string
  latitude: number
  longitude: number
  bookingMode: 'instant' | 'juried'
  allowMlm: boolean
  maxMlmSlots?: number
  boothClearancePolicy: BoothClearancePolicy
  raffleDonationRequirement: string
  scheduleType: 'single' | 'multi'
  startAt: string
  endAt: string
  coverImageUrl?: string | null
  status?: 'draft' | 'published'
  listingType?: EventListingType
  requireFullAttendance?: boolean
  marketInsuranceRequired?: boolean
  skipVenueLayout?: boolean
  marketCity?: string
  boothPriceCents?: number
  multiTableDiscountPercent?: number
}

export interface DayRowPayload {
  date: string
  start_time: string
  end_time: string
}

function safeTrim(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function safeString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  return null
}

/** Guard Radix/select handlers that may pass empty objects instead of strings. */
export function selectValueOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value
}

/** Safe description for DB writes — bypasses thin/empty Step 1 text without blocking venue saves. */
export const DESCRIPTION_PERSIST_FALLBACK =
  'Market details in progress — vendor mix and location highlights to follow.'

export function descriptionForPersist(raw: string | null | undefined): string {
  const trimmed = safeTrim(raw)
  if (trimmed.length >= DESCRIPTION_MIN_LENGTH) return trimmed
  return DESCRIPTION_PERSIST_FALLBACK
}

export async function persistEventVenueFields(
  supabase: SupabaseClient,
  eventId: string,
  fields: {
    locationName: string
    address: string
    latitude: number
    longitude: number
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('events')
    .update({
      location_name: safeTrim(fields.locationName),
      address: safeTrim(fields.address),
      latitude: Number.isFinite(fields.latitude) ? fields.latitude : 53.5461,
      longitude: Number.isFinite(fields.longitude) ? fields.longitude : -113.4938,
    })
    .eq('id', eventId)
  return { error: error ? new Error(error.message) : null }
}

export async function persistEventDraft(
  supabase: SupabaseClient,
  eventId: string | null,
  draft: EventDraftPayload,
  categoryLimits: CategoryLimit[],
  dayRows: DayRowPayload[],
  scheduleType: 'single' | 'multi'
): Promise<{ eventId: string; error: Error | null }> {
  const effectiveScheduleType = effectiveScheduleTypeForListing(
    draft.listingType,
    scheduleType
  )

  const sanitizedPayload = {
    coordinator_id: draft.coordinatorId,
    name: safeTrim(draft.name),
    description: descriptionForPersist(draft.description),
    location_name: safeTrim(draft.locationName),
    address: safeTrim(draft.address),
    latitude: Number.isFinite(draft.latitude) ? draft.latitude : 53.5461,
    longitude: Number.isFinite(draft.longitude) ? draft.longitude : -113.4938,
    start_at: draft.startAt,
    end_at: draft.endAt,
    booking_mode: draft.bookingMode,
    listing_type: draft.listingType ?? 'community_market',
    status: draft.status ?? 'draft',
    cover_image_url: draft.coverImageUrl ?? null,
    allow_mlm: draft.allowMlm,
    is_multi_day: effectiveScheduleType === 'multi',
    require_full_attendance: draft.requireFullAttendance ?? true,
    market_insurance_required: draft.marketInsuranceRequired ?? false,
    skip_venue_layout: draft.skipVenueLayout ?? false,
    market_city: draft.marketCity ?? 'edmonton',
    booth_clearance_policy: draft.boothClearancePolicy,
    booth_price_cents: Math.max(0, draft.boothPriceCents ?? 0),
    multi_table_discount_percent: Math.min(
      100,
      Math.max(0, Math.round(draft.multiTableDiscountPercent ?? 0))
    ),
  }

  const eventDatabasePayload = {
    ...sanitizedPayload,
    max_mlm_slots: draft.allowMlm ? (draft.maxMlmSlots ?? null) : null,
  }

  let resolvedId = eventId

  if (resolvedId) {
    const { error } = await supabase.from('events').update(eventDatabasePayload).eq('id', resolvedId)
    if (error) return { eventId: resolvedId, error: new Error(error.message) }
  } else {
    const { data, error } = await supabase
      .from('events')
      .insert(eventDatabasePayload)
      .select('id')
      .single()
    if (error || !data?.id) {
      return { eventId: '', error: new Error(error?.message ?? 'Failed to create event') }
    }
    resolvedId = data.id as string
  }

  if (categoryLimits.length > 0) {
    await supabase.from('event_category_limits').delete().eq('event_id', resolvedId)
    const rows = categoryLimits
      .filter((cl) => cl.categoryId && cl.maxSlots > 0)
      .map((cl) => ({
        event_id: resolvedId,
        category_id: cl.categoryId,
        max_slots: cl.maxSlots,
        price_per_booth: cl.pricePerBooth,
        table_length_ft: cl.tableLengthFt ?? null,
      }))
    if (rows.length > 0) {
      const { error } = await supabase.from('event_category_limits').insert(rows)
      if (error) return { eventId: resolvedId, error: new Error(error.message) }
    }
  }

  if (effectiveScheduleType === 'multi') {
    await supabase.from('event_days').delete().eq('event_id', resolvedId)
    const sorted = [...dayRows]
      .filter((r) => r.date && r.start_time && r.end_time)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length > 0) {
      const { error } = await supabase.from('event_days').insert(
        sorted.map((row, i) => ({
          event_id: resolvedId,
          date: row.date,
          start_time: row.start_time,
          end_time: row.end_time,
          sort_order: i,
        }))
      )
      if (error) return { eventId: resolvedId, error: new Error(error.message) }
    }
  } else {
    await supabase.from('event_days').delete().eq('event_id', resolvedId)
  }

  return { eventId: resolvedId, error: null }
}

const VALID_LAYOUT_SPACING_MODES = new Set(['standard', 'table_provided'])

/** Normalize spacing_mode for booth_layouts CHECK constraint on upsert. */
function spacingModeForPersist(raw: unknown): 'standard' | 'table_provided' {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (normalized === 'one_foot') return 'standard'
  if (VALID_LAYOUT_SPACING_MODES.has(normalized)) {
    return normalized as 'standard' | 'table_provided'
  }
  return 'standard'
}

export async function persistLayoutDraft(
  supabase: SupabaseClient,
  eventId: string,
  layoutPayload: Record<string, unknown>
): Promise<{ error: Error | null }> {
  if (!eventId) return { error: new Error('Missing event id for layout save') }

  const sanitizedPayload = {
    ...layoutPayload,
    spacing_mode: spacingModeForPersist(layoutPayload.spacing_mode),
  }

  const { error } = await supabase
    .from('booth_layouts')
    .upsert(sanitizedPayload, { onConflict: 'event_id' })
  return { error: error ? new Error(error.message) : null }
}
