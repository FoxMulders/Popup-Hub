import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isWithinVendorAccessEqualityWindow } from '@/lib/engagement/booth-access'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { eventId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const [{ data: event }, { data: invites }, { data: slots }] = await Promise.all([
    supabase
      .from('events')
      .select('vendor_access_equality_until')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('vendor_priority_invites')
      .select('expires_at')
      .eq('event_id', eventId)
      .eq('vendor_id', user.id)
      .is('claimed_at', null)
      .gt('expires_at', now)
      .limit(1),
    supabase
      .from('event_booth_slots')
      .select('access_phase, priority_window_ends_at')
      .eq('event_id', eventId),
  ])

  const hasPriorityInvite = (invites?.length ?? 0) > 0
  const nowMs = Date.now()
  const isActivePrioritySlot = (s: {
    access_phase: string
    priority_window_ends_at: string | null
  }) =>
    s.access_phase === 'priority_exclusive' &&
    (!s.priority_window_ends_at ||
      new Date(s.priority_window_ends_at).getTime() > nowMs)
  const hasPriorityExclusive = (slots ?? []).some(isActivePrioritySlot)
  const hasPublicRelease =
    (slots ?? []).some((s) => s.access_phase === 'public_release') ||
    (slots ?? []).some(
      (s) =>
        s.access_phase === 'priority_exclusive' &&
        s.priority_window_ends_at &&
        new Date(s.priority_window_ends_at).getTime() <= nowMs
    )
  const priorityWindowEndsAt =
    slots
      ?.filter(isActivePrioritySlot)
      .map((s) => s.priority_window_ends_at as string)
      .sort()[0] ?? null

  return NextResponse.json({
    hasPriorityInvite,
    hasPriorityExclusive,
    hasPublicRelease,
    priorityWindowEndsAt,
    equalityWindowActive: isWithinVendorAccessEqualityWindow(
      event?.vendor_access_equality_until
    ),
  })
}
