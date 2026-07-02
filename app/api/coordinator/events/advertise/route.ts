import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { descriptionForPersist } from '@/lib/wizard/wizard-autosave'

type AdvertiseRequestBody = {
  name: string
  startAt: string
  endAt: string
  destinationUrl: string
  locationName?: string
  address?: string
  activateCampaign?: boolean
}

const DEFAULT_LOCATION = 'Market venue TBD'
const DEFAULT_ADDRESS = 'Edmonton, AB'

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await authSupabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  let body: AdvertiseRequestBody
  try {
    body = (await request.json()) as AdvertiseRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = body.name?.trim()
  const destinationUrl = normalizeUrl(body.destinationUrl ?? '')
  const startAt = body.startAt?.trim()
  const endAt = body.endAt?.trim()

  if (!name || name.length < 3) {
    return NextResponse.json({ error: 'Market name is required (min 3 characters).' }, { status: 400 })
  }
  if (!destinationUrl) {
    return NextResponse.json({ error: 'A valid destination URL is required.' }, { status: 400 })
  }
  if (!startAt || !endAt) {
    return NextResponse.json({ error: 'Start and end dates are required.' }, { status: 400 })
  }

  const activateCampaign = body.activateCampaign !== false
  const expiresAt = activateCampaign
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('events')
    .insert({
      coordinator_id: user.id,
      name,
      description: descriptionForPersist(''),
      location_name: body.locationName?.trim() || DEFAULT_LOCATION,
      address: body.address?.trim() || DEFAULT_ADDRESS,
      latitude: 53.5461,
      longitude: -113.4938,
      start_at: startAt,
      end_at: endAt,
      booking_mode: 'juried',
      listing_type: 'community_market',
      status: 'published',
      allow_mlm: false,
      require_full_attendance: true,
      skip_venue_layout: true,
      market_city: 'edmonton',
      booth_clearance_policy: 'leave_furniture',
      booth_price_cents: 0,
      is_external_listing: true,
      destination_url: destinationUrl,
      ad_campaign_status: activateCampaign ? 'active' : 'inactive',
      ad_campaign_expires_at: expiresAt,
    })
    .select('id, name, is_external_listing, ad_campaign_status, destination_url')
    .single()

  if (error) {
    console.error('[advertise] insert failed', error.message)
    return NextResponse.json({ error: 'Could not create ad listing' }, { status: 500 })
  }

  return NextResponse.json({
    eventId: data.id,
    name: data.name,
    isExternalListing: data.is_external_listing === true,
    adCampaignStatus: data.ad_campaign_status,
    destinationUrl: data.destination_url,
  })
}
