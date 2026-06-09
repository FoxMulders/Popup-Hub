import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoothSlotAccessPhase, Event } from '@/types/database'
import { requireVenueVerified } from '@/lib/venues/require-venue-verified'

const EQUALITY_WINDOW_DAYS = 90

export function vendorAccessEqualityUntilFromRelease(
  publicReleasedAt: Date = new Date()
): string {
  const until = new Date(publicReleasedAt)
  until.setDate(until.getDate() + EQUALITY_WINDOW_DAYS)
  return until.toISOString()
}

export function isWithinVendorAccessEqualityWindow(
  vendorAccessEqualityUntil: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!vendorAccessEqualityUntil) return false
  return new Date(vendorAccessEqualityUntil).getTime() > now.getTime()
}

export function shouldDisableRankingPriorityForEvent(
  vendorAccessEqualityUntil: string | null | undefined,
  now: Date = new Date()
): boolean {
  return isWithinVendorAccessEqualityWindow(vendorAccessEqualityUntil, now)
}

type EventAccessFields = Pick<
  Event,
  | 'id'
  | 'venue_verified'
  | 'venue_verification_status'
  | 'venue_verification_reason'
  | 'vendor_access_equality_until'
>

export async function loadOpenSlotsForCategory(
  supabase: SupabaseClient,
  eventId: string,
  categoryId: string
) {
  const { data, error } = await supabase
    .from('event_booth_slots')
    .select('id, access_phase, claimed_by_application_id, priority_window_ends_at')
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .is('claimed_by_application_id', null)

  if (error) throw error
  return data ?? []
}

export async function vendorHasActivePriorityInvite(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string,
  categoryId: string,
  now: Date = new Date()
): Promise<boolean> {
  const { data: invites, error: inviteError } = await supabase
    .from('vendor_priority_invites')
    .select('booth_slot_id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .is('claimed_at', null)
    .gt('expires_at', now.toISOString())

  if (inviteError) throw inviteError
  if (!invites?.length) return false

  const slotIds = invites.map((i) => i.booth_slot_id as string)
  const { data: slots, error: slotError } = await supabase
    .from('event_booth_slots')
    .select('id')
    .in('id', slotIds)
    .eq('category_id', categoryId)
    .limit(1)

  if (slotError) throw slotError
  return (slots?.length ?? 0) > 0
}

export async function assertVendorCanApplyToCategory(
  supabase: SupabaseClient,
  params: {
    event: EventAccessFields
    vendorId: string
    categoryId: string
    now?: Date
  }
): Promise<{ ok: true; phase: BoothSlotAccessPhase | 'none' } | { ok: false; reason: string }> {
  const venueGate = requireVenueVerified(params.event)
  if (!venueGate.ok) return venueGate

  const slots = await loadOpenSlotsForCategory(supabase, params.event.id, params.categoryId)
  if (slots.length === 0) {
    return { ok: true, phase: 'none' }
  }

  const now = params.now ?? new Date()
  const hasPriorityExclusive = slots.some((s) => s.access_phase === 'priority_exclusive')
  const hasPublicRelease = slots.some((s) => s.access_phase === 'public_release')

  if (hasPriorityExclusive) {
    const invited = await vendorHasActivePriorityInvite(
      supabase,
      params.event.id,
      params.vendorId,
      params.categoryId,
      now
    )
    if (!invited) {
      const earliestEnd = slots
        .filter((s) => s.access_phase === 'priority_exclusive' && s.priority_window_ends_at)
        .map((s) => new Date(s.priority_window_ends_at as string).getTime())
        .sort((a, b) => a - b)[0]
      const hint =
        earliestEnd != null
          ? ` Priority window ends ${new Date(earliestEnd).toLocaleString()}.`
          : ''
      return {
        ok: false,
        reason: `This booth category is in a 24-hour priority invite window.${hint}`,
      }
    }
    return { ok: true, phase: 'priority_exclusive' }
  }

  if (hasPublicRelease) {
    return { ok: true, phase: 'public_release' }
  }

  return { ok: true, phase: 'coordinator_only' }
}

export async function assertVendorCanPayForApplication(
  supabase: SupabaseClient,
  params: {
    event: EventAccessFields
    vendorId: string
    categoryId: string
    now?: Date
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const gate = await assertVendorCanApplyToCategory(supabase, params)
  if (!gate.ok) return gate
  return { ok: true }
}

export async function claimBoothSlotForApplication(
  supabase: SupabaseClient,
  params: {
    eventId: string
    categoryId: string
    applicationId: string
    vendorId: string
  }
): Promise<void> {
  const { data: slot } = await supabase
    .from('event_booth_slots')
    .select('id')
    .eq('event_id', params.eventId)
    .eq('category_id', params.categoryId)
    .is('claimed_by_application_id', null)
    .in('access_phase', ['priority_exclusive', 'public_release', 'coordinator_only'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!slot?.id) return

  await supabase
    .from('event_booth_slots')
    .update({
      claimed_by_application_id: params.applicationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', slot.id)
    .is('claimed_by_application_id', null)

  await supabase
    .from('vendor_priority_invites')
    .update({ claimed_at: new Date().toISOString() })
    .eq('event_id', params.eventId)
    .eq('vendor_id', params.vendorId)
    .eq('booth_slot_id', slot.id)
    .is('claimed_at', null)
}
