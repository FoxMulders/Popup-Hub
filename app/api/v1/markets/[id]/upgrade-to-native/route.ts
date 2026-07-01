import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { canMutateCoordinatorEvent } from '@/lib/events/coordinator-event-ownership'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getSquareAppId,
  getSquareOAuthRedirectUri,
  tryBuildSquareOAuthAuthorizeUrl,
} from '@/lib/square/connect-url'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: marketId } = await params
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

  const { data: market, error: marketError } = await supabase
    .from('events')
    .select('id, coordinator_id, is_external_listing')
    .eq('id', marketId)
    .maybeSingle()

  if (marketError) {
    console.error('[upgrade-to-native]', marketError.message)
    return NextResponse.json({ error: 'Could not load market' }, { status: 500 })
  }

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  if (
    !canMutateCoordinatorEvent({
      userId: user.id,
      isAdmin: profile?.is_admin === true,
      eventCoordinatorId: market.coordinator_id,
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (market.is_external_listing !== true) {
    return NextResponse.json(
      { ok: true, marketId, alreadyNative: true, squareOAuth: { authorizeUrl: null } },
      { status: 200 }
    )
  }

  const service = await createServiceClient()
  const { data: updated, error: updateError } = await service
    .from('events')
    .update({
      is_external_listing: false,
      ad_campaign_status: 'inactive',
      destination_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', marketId)
    .eq('coordinator_id', user.id)
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('[upgrade-to-native] update failed', updateError.message)
    return NextResponse.json({ error: 'Could not upgrade market' }, { status: 500 })
  }

  if (!updated) {
    return NextResponse.json({ error: 'Market not found or not owned' }, { status: 404 })
  }

  const appId = getSquareAppId()
  const redirectUri = getSquareOAuthRedirectUri()
  let authorizeUrl: string | null = null

  if (appId && redirectUri) {
    const built = tryBuildSquareOAuthAuthorizeUrl({
      clientId: appId,
      redirectUri,
      state: user.id,
    })
    authorizeUrl = 'url' in built ? built.url : null
  }

  return NextResponse.json({
    ok: true,
    marketId,
    squareOAuth: {
      authorizeUrl,
    },
  })
}
