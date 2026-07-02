import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { canMutateCoordinatorEvent } from '@/lib/events/coordinator-event-ownership'
import { createClient } from '@/lib/supabase/server'

function startOfUtcDay(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'id, name, start_at, status, is_external_listing, destination_url, ad_campaign_status, ad_campaign_expires_at, coordinator_id'
    )
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) {
    console.error('[campaign] event load failed', eventError.message)
    return NextResponse.json({ error: 'Could not load market' }, { status: 500 })
  }

  if (!event) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  if (
    !canMutateCoordinatorEvent({
      userId: user.id,
      isAdmin: profile?.is_admin === true,
      eventCoordinatorId: event.coordinator_id,
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const todayStart = startOfUtcDay(now)

  const [totalResult, todayResult, weekResult, recentResult] = await Promise.all([
    supabase
      .from('ad_clicks_log')
      .select('id', { count: 'exact', head: true })
      .eq('market_id', eventId),
    supabase
      .from('ad_clicks_log')
      .select('id', { count: 'exact', head: true })
      .eq('market_id', eventId)
      .gte('clicked_at', todayStart),
    supabase
      .from('ad_clicks_log')
      .select('id', { count: 'exact', head: true })
      .eq('market_id', eventId)
      .gte('clicked_at', sevenDaysAgo),
    supabase
      .from('ad_clicks_log')
      .select('clicked_at, ip_address_hash')
      .eq('market_id', eventId)
      .order('clicked_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startAt: event.start_at,
      status: event.status,
      isExternalListing: event.is_external_listing === true,
      destinationUrl: event.destination_url,
      adCampaignStatus: event.ad_campaign_status,
      adCampaignExpiresAt: event.ad_campaign_expires_at,
    },
    clicks: {
      total: totalResult.count ?? 0,
      today: todayResult.count ?? 0,
      last7Days: weekResult.count ?? 0,
    },
    recentClicks: (recentResult.data ?? []).map((row) => ({
      clickedAt: row.clicked_at,
      ipHashPrefix: row.ip_address_hash?.slice(0, 8) ?? '',
    })),
  })
}
