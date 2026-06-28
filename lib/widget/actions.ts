import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { dispatchNativePushToUsers } from '@/lib/mobile/push-dispatch'
import { buildWidgetFeed } from '@/lib/widget/fetch-data'
import { cycleMarketFilter } from '@/lib/widget/feed'
import type { WidgetAuthContext, WidgetPatronFeed } from '@/lib/widget/types'

export type WidgetActionName =
  | 'refresh'
  | 'checkin'
  | 'toggleFilter'
  | 'broadcast'
  | 'incident'
  | 'vendorMessage'

export type WidgetActionBody = {
  action: WidgetActionName
  eventId?: string
  message?: string
  title?: string
  lat?: number
  lng?: number
}

export async function executeWidgetAction(
  service: SupabaseClient,
  context: WidgetAuthContext,
  body: WidgetActionBody
) {
  switch (body.action) {
    case 'refresh':
      return refreshAction(service, context)
    case 'checkin':
      return vendorCheckInAction(service, context, body.eventId)
    case 'toggleFilter':
      return toggleFilterAction(service, context)
    case 'broadcast':
      return broadcastAction(service, context, body)
    case 'incident':
      return incidentAction(service, context, body)
    case 'vendorMessage':
      return vendorMessageAction(service, context, body)
    default:
      return { ok: false as const, status: 400, error: 'Unknown action' }
  }
}

async function refreshAction(service: SupabaseClient, context: WidgetAuthContext) {
  const feed = await buildWidgetFeed(service, context.userId, context.persona)
  return { ok: true as const, feed }
}

async function vendorCheckInAction(
  service: SupabaseClient,
  context: WidgetAuthContext,
  eventId?: string
) {
  if (context.persona !== 'vendor') {
    return { ok: false as const, status: 403, error: 'Vendor account required' }
  }

  let targetEventId = eventId
  if (!targetEventId) {
    const { data: app } = await service
      .from('booth_applications')
      .select('event_id, event:events!inner(status)')
      .eq('vendor_id', context.userId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()

    const event = Array.isArray(app?.event) ? app?.event[0] : app?.event
    if (!event || !['published', 'active'].includes(event.status as string)) {
      return { ok: false as const, status: 422, error: 'No active market to check in' }
    }
    targetEventId = app?.event_id as string
  }

  const { data: application, error } = await service
    .from('booth_applications')
    .update({ checked_in: true, arrived_at: new Date().toISOString() })
    .eq('vendor_id', context.userId)
    .eq('event_id', targetEventId)
    .eq('status', 'approved')
    .select('id, booth_number')
    .maybeSingle()

  if (error || !application) {
    return { ok: false as const, status: 404, error: 'Approved booth not found' }
  }

  const feed = await buildWidgetFeed(service, context.userId, context.persona)
  return {
    ok: true as const,
    checkedIn: true,
    boothNumber: application.booth_number,
    eventId: targetEventId,
    feed,
  }
}

async function toggleFilterAction(service: SupabaseClient, context: WidgetAuthContext) {
  if (context.persona !== 'patron') {
    return { ok: false as const, status: 403, error: 'Patron context required' }
  }

  const { data: existing } = await service
    .from('widget_preferences')
    .select('market_filter')
    .eq('user_id', context.userId)
    .maybeSingle()

  const current = (existing?.market_filter ?? 'all') as WidgetPatronFeed['marketFilter']
  const next = cycleMarketFilter(current)

  await service.from('widget_preferences').upsert(
    {
      user_id: context.userId,
      market_filter: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  const feed = await buildWidgetFeed(service, context.userId, 'patron', { marketFilter: next })
  return { ok: true as const, marketFilter: next, feed }
}

async function broadcastAction(
  service: SupabaseClient,
  context: WidgetAuthContext,
  body: WidgetActionBody
) {
  if (context.persona !== 'coordinator') {
    return { ok: false as const, status: 403, error: 'Coordinator account required' }
  }

  const message = body.message?.trim()
  const eventId = body.eventId?.trim()
  if (!message || !eventId) {
    return { ok: false as const, status: 400, error: 'eventId and message required' }
  }

  const scope = await getCoordinatorScope(service, context.userId)
  const { data: event } = await applyCoordinatorEventScope(
    service.from('events').select('id, name').eq('id', eventId),
    context.userId,
    scope.isAdmin
  ).maybeSingle()

  if (!event) {
    return { ok: false as const, status: 404, error: 'Event not found' }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('role, is_admin')
    .eq('id', context.userId)
    .maybeSingle()

  if (!canActAsCoordinator(profile)) {
    return { ok: false as const, status: 403, error: 'Coordinator account required' }
  }

  const { data: followers } = await service
    .from('shopper_favorites')
    .select('user_id')
    .eq('event_id', eventId)

  const { data: vendors } = await service
    .from('booth_applications')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('status', 'approved')

  const recipientIds = [
    ...new Set([
      ...(followers ?? []).map((f) => f.user_id as string),
      ...(vendors ?? []).map((v) => v.vendor_id as string),
    ]),
  ]

  const title = body.title?.trim() || `${event.name} update`
  const push = await dispatchNativePushToUsers(service, {
    userIds: recipientIds,
    title,
    body: message,
    deepLink: `/events/${eventId}`,
  })

  await service.from('coordinator_broadcasts').insert({
    event_id: eventId,
    coordinator_id: context.userId,
    message,
    recipient_count: recipientIds.length,
  })

  await service.from('notifications').insert(
    recipientIds.slice(0, 50).map((userId) => ({
      user_id: userId,
      type: 'coordinator_announcement' as const,
      message: `${event.name}: ${message}`,
      metadata: { event_id: eventId, deep_link: `/events/${eventId}` },
    }))
  )

  const feed = await buildWidgetFeed(service, context.userId, context.persona)
  return { ok: true as const, recipientCount: recipientIds.length, pushSent: push.sent, feed }
}

async function incidentAction(
  service: SupabaseClient,
  context: WidgetAuthContext,
  body: WidgetActionBody
) {
  if (context.persona !== 'coordinator') {
    return { ok: false as const, status: 403, error: 'Coordinator account required' }
  }

  const eventId = body.eventId?.trim()
  const title = body.title?.trim() || body.message?.trim()
  if (!eventId || !title) {
    return { ok: false as const, status: 400, error: 'eventId and title/message required' }
  }

  const scope = await getCoordinatorScope(service, context.userId)
  const { data: event } = await applyCoordinatorEventScope(
    service.from('events').select('id').eq('id', eventId),
    context.userId,
    scope.isAdmin
  ).maybeSingle()

  if (!event) {
    return { ok: false as const, status: 404, error: 'Event not found' }
  }

  const { data: incident, error } = await service
    .from('coordinator_incidents')
    .insert({
      event_id: eventId,
      coordinator_id: context.userId,
      title,
      description: body.message?.trim() ?? null,
      status: 'open',
    })
    .select('id')
    .single()

  if (error || !incident) {
    return { ok: false as const, status: 500, error: error?.message ?? 'Failed to log incident' }
  }

  const feed = await buildWidgetFeed(service, context.userId, context.persona)
  return { ok: true as const, incidentId: incident.id, feed }
}

async function vendorMessageAction(
  service: SupabaseClient,
  context: WidgetAuthContext,
  body: WidgetActionBody
) {
  if (context.persona !== 'vendor') {
    return { ok: false as const, status: 403, error: 'Vendor account required' }
  }

  const eventId = body.eventId?.trim()
  const message = body.message?.trim()
  if (!eventId || !message) {
    return { ok: false as const, status: 400, error: 'eventId and message required' }
  }

  const { data: app } = await service
    .from('booth_applications')
    .select('id')
    .eq('vendor_id', context.userId)
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .maybeSingle()

  if (!app) {
    return { ok: false as const, status: 404, error: 'No approved booth at this market' }
  }

  const { error } = await service.from('coordinator_vendor_messages').insert({
    event_id: eventId,
    vendor_id: context.userId,
    body: message,
  })

  if (error) {
    return { ok: false as const, status: 500, error: error.message }
  }

  const feed = await buildWidgetFeed(service, context.userId, context.persona)
  return { ok: true as const, feed }
}
