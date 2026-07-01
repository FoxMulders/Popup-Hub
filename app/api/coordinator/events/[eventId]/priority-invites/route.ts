import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireVenueVerified } from '@/lib/venues/require-venue-verified'
import {
  extractOpenVendorBooths,
  summarizeOpenBoothCategories,
  syncEventBoothSlots,
} from '@/lib/floor-plan/sync-booth-slots'
import { fetchCategoryVendorMatches } from '@/lib/vendors/category-vendor-matches'
import { sendPriorityBoothInviteEmail } from '@/lib/email/priority-booth-invite'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { BoothCell } from '@/types/database'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import { enforceNativeMarketPermissions } from '@/lib/markets/enforce-native-market-permissions'

const PRIORITY_WINDOW_HOURS = 24

interface RouteContext {
  params: Promise<{ eventId: string }>
}

async function loadCoordinatorEvent(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, userId: string) {
  const { data: event, error } = await supabase
    .from('events')
    .select(
      'id, name, coordinator_id, venue_verified, venue_verification_status, venue_verification_reason'
    )
    .eq('id', eventId)
    .single()

  if (error || !event || event.coordinator_id !== userId) {
    return null
  }
  return event
}

async function buildCategoryNameToId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string
): Promise<Record<string, string>> {
  const { data: limits } = await supabase
    .from('event_category_limits')
    .select('category_id, category:categories(name)')
    .eq('event_id', eventId)

  const map: Record<string, string> = {}
  for (const row of limits ?? []) {
    const category = Array.isArray(row.category) ? row.category[0] : row.category
    const name = (category as { name?: string } | null)?.name?.trim()
    if (name) map[name] = row.category_id as string
  }
  return map
}

function boothObjectFromCell(cell: BoothCell): BoothObject | null {
  const isVendor = (cell.tablePurpose ?? 'vendor') === 'vendor'
  const unassigned = !cell.vendorName?.trim()
  if (!isVendor || !unassigned || !cell.categoryName?.trim()) return null
  return {
    id: cell.id,
    kind: 'booth',
    x: cell.col,
    y: cell.row,
    width: Math.max(1, cell.colSpan),
    height: Math.max(1, cell.rowSpan),
    rotation: 0,
    tablePurpose: 'vendor',
    categoryName: cell.categoryName.trim(),
    vendorId: null,
  }
}

function boothsFromLayoutRooms(rooms: LayoutRoom[]): BoothObject[] {
  const booths: BoothObject[] = []
  for (const room of rooms) {
    for (const cell of room.cells ?? []) {
      const booth = boothObjectFromCell(cell)
      if (booth) booths.push(booth)
    }
  }
  return booths
}

export async function GET(_request: Request, context: RouteContext) {
  const { eventId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await loadCoordinatorEvent(supabase, eventId, user.id)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const categoryNameToId = await buildCategoryNameToId(supabase, eventId)
  const { data: layout } = await supabase
    .from('booth_layouts')
    .select('layout_rooms')
    .eq('event_id', eventId)
    .maybeSingle()

  const rooms = (layout?.layout_rooms as LayoutRoom[] | null) ?? []
  const booths = boothsFromLayoutRooms(rooms)
  await syncEventBoothSlots(supabase, { eventId, booths, categoryNameToId })

  const openBooths = extractOpenVendorBooths(booths)
  const openCategories = summarizeOpenBoothCategories(openBooths, categoryNameToId)
  const matches = await fetchCategoryVendorMatches(supabase, openCategories)

  const { data: activeWindow } = await supabase
    .from('event_booth_slots')
    .select('priority_window_ends_at')
    .eq('event_id', eventId)
    .eq('access_phase', 'priority_exclusive')
    .order('priority_window_ends_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    eventName: event.name,
    venueVerified: event.venue_verified,
    matches,
    openBoothCount: openBooths.length,
    priorityWindowEndsAt: activeWindow?.priority_window_ends_at ?? null,
  })
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nativeGate = await enforceNativeMarketPermissions(supabase, eventId)
  if (nativeGate) return nativeGate

  const event = await loadCoordinatorEvent(supabase, eventId, user.id)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const venueGate = requireVenueVerified(event)
  if (!venueGate.ok) {
    return NextResponse.json({ error: venueGate.reason }, { status: 400 })
  }

  const categoryNameToId = await buildCategoryNameToId(supabase, eventId)
  const { data: layout } = await supabase
    .from('booth_layouts')
    .select('layout_rooms')
    .eq('event_id', eventId)
    .maybeSingle()

  const rooms = (layout?.layout_rooms as LayoutRoom[] | null) ?? []
  const booths = boothsFromLayoutRooms(rooms)
  await syncEventBoothSlots(supabase, { eventId, booths, categoryNameToId })

  const openBooths = extractOpenVendorBooths(booths)
  const openCategories = summarizeOpenBoothCategories(openBooths, categoryNameToId)
  const matches = await fetchCategoryVendorMatches(supabase, openCategories)

  const { data: slots } = await supabase
    .from('event_booth_slots')
    .select('id, layout_object_id, category_id, access_phase, claimed_by_application_id')
    .eq('event_id', eventId)
    .is('claimed_by_application_id', null)
    .in('access_phase', ['coordinator_only', 'priority_exclusive'])

  if (!slots?.length) {
    return NextResponse.json({ error: 'No open vendor booths to invite for.' }, { status: 400 })
  }

  const batchId = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + PRIORITY_WINDOW_HOURS)
  const expiresIso = expiresAt.toISOString()

  let inviteCount = 0
  const vendorsByCategory = new Map(matches.map((m) => [m.categoryId, m.vendors]))

  for (const slot of slots) {
    const vendors = vendorsByCategory.get(slot.category_id as string) ?? []
    if (!vendors.length) continue

    await supabase
      .from('event_booth_slots')
      .update({
        access_phase: 'priority_exclusive',
        priority_invite_batch_id: batchId,
        priority_window_ends_at: expiresIso,
        updated_at: expiresIso,
      })
      .eq('id', slot.id)

    for (const vendor of vendors) {
      const { error: inviteError } = await supabase.from('vendor_priority_invites').upsert(
        {
          event_id: eventId,
          vendor_id: vendor.vendorId,
          booth_slot_id: slot.id,
          batch_id: batchId,
          expires_at: expiresIso,
        },
        { onConflict: 'event_id,vendor_id,booth_slot_id' }
      )
      if (inviteError) continue
      inviteCount += 1

      if (vendor.email) {
        const categoryName =
          matches.find((m) => m.categoryId === slot.category_id)?.categoryName ?? 'Vendor'
        await sendPriorityBoothInviteEmail({
          to: vendor.email,
          vendorName: vendor.businessName,
          eventName: event.name,
          eventId,
          categoryName,
          expiresAt,
        })
      }

      const categoryLabel =
        matches.find((m) => m.categoryId === slot.category_id)?.categoryName ?? 'vendor'
      await serviceSupabase.from('notifications').insert({
        user_id: vendor.vendorId,
        type: 'priority_booth_invite',
        message: `Priority booth invite — ${event.name}: 24h exclusive access to a ${categoryLabel} booth.`,
        metadata: { event_id: eventId, booth_slot_id: slot.id, expires_at: expiresIso },
      })
    }
  }

  if (inviteCount === 0) {
    return NextResponse.json(
      { error: 'No matching vendors found for open booth categories.' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    batchId,
    inviteCount,
    expiresAt: expiresIso,
  })
}
