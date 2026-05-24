import type { SupabaseClient } from '@supabase/supabase-js'

type EventCoordinatorRow =
  | { coordinator_id: string }
  | { coordinator_id: string }[]
  | null
  | undefined

export function resolveEventCoordinatorId(event: EventCoordinatorRow): string | undefined {
  if (!event) return undefined
  if (Array.isArray(event)) return event[0]?.coordinator_id
  return event.coordinator_id
}

export function canManageEventResource(
  userId: string,
  resourceOwnerId: string | null | undefined,
  eventCoordinatorId: string | undefined
): boolean {
  if (resourceOwnerId && resourceOwnerId === userId) return true
  if (eventCoordinatorId && eventCoordinatorId === userId) return true
  return false
}

export async function assertLegacyAuctionManager(
  service: SupabaseClient,
  auctionId: string,
  userId: string
): Promise<
  | {
      ok: true
      auction: {
        id: string
        coordinator_id: string
        status: string
        event_id: string | null
      }
    }
  | { ok: false; status: number; error: string }
> {
  const { data: auction, error } = await service
    .from('auctions')
    .select('id, coordinator_id, status, event_id, event:events(coordinator_id)')
    .eq('id', auctionId)
    .single()

  if (error || !auction) {
    return { ok: false, status: 404, error: 'Auction not found' }
  }

  const eventCoordinatorId = resolveEventCoordinatorId(
    auction.event as EventCoordinatorRow
  )

  if (
    !canManageEventResource(userId, auction.coordinator_id, eventCoordinatorId)
  ) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return {
    ok: true,
    auction: {
      id: auction.id,
      coordinator_id: auction.coordinator_id,
      status: auction.status,
      event_id: auction.event_id,
    },
  }
}

export async function assertEventCoordinator(
  service: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: event, error } = await service
    .from('events')
    .select('coordinator_id')
    .eq('id', eventId)
    .single()

  if (error || !event) {
    return { ok: false, status: 404, error: 'Event not found' }
  }

  if (event.coordinator_id !== userId) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true }
}
