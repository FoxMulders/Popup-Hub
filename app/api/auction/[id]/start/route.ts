import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notifyAuctionStarting } from '@/lib/auction/notify-auction-starting'
import { assertLegacyAuctionManager } from '@/lib/auction/coordinator-access'
import {
  canStartQuarterAuctionNow,
  quarterAuctionStartBlockedMessage,
} from '@/lib/quarter-auction/schedule'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const access = await assertLegacyAuctionManager(admin, id, user.id)

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  if (access.auction.status !== 'upcoming') {
    return NextResponse.json(
      { error: `Auction is already ${access.auction.status}` },
      { status: 409 }
    )
  }

  const { data: auction } = await admin
    .from('auctions')
    .select('id, status, timer_duration_seconds, title, event_id, scheduled_start_at, event:events(start_at)')
    .eq('id', id)
    .single()

  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 })

  const eventRow = auction.event as { start_at: string } | { start_at: string }[] | null
  const eventStartAt = Array.isArray(eventRow) ? eventRow[0]?.start_at : eventRow?.start_at

  if (
    !canStartQuarterAuctionNow(auction.scheduled_start_at, eventStartAt ?? null)
  ) {
    return NextResponse.json(
      {
        error: quarterAuctionStartBlockedMessage(
          auction.scheduled_start_at,
          eventStartAt ?? null
        ),
      },
      { status: 422 }
    )
  }

  if (auction.event_id) {
    const { data: existingActive } = await supabase
      .from('auctions')
      .select('id')
      .eq('event_id', auction.event_id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingActive) {
      return NextResponse.json(
        { error: 'Another auction is already active for this event' },
        { status: 409 }
      )
    }
  }

  const timerEndsAt = new Date(
    Date.now() + auction.timer_duration_seconds * 1000
  ).toISOString()

  const { error } = await admin
    .from('auctions')
    .update({ status: 'active', timer_ends_at: timerEndsAt })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyAuctionStarting(admin, {
    auctionId: id,
    auctionTitle: auction.title,
    eventId: auction.event_id,
  })

  return NextResponse.json({ timerEndsAt })
}
