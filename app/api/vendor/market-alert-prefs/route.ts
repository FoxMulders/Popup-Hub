import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canActAsVendor } from '@/lib/auth/rbac'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, is_admin').eq('id', user.id).single()
  if (!canActAsVendor(profile)) {
    return NextResponse.json({ error: 'Vendor account required' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('vendor_market_alert_prefs')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prefs: data })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, is_admin').eq('id', user.id).single()
  if (!canActAsVendor(profile)) {
    return NextResponse.json({ error: 'Vendor account required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    home_lat?: number
    home_lng?: number
    radius_km?: number
    category_ids?: string[] | null
    notify_push?: boolean
    notify_email?: boolean
    notify_in_app?: boolean
  }

  if (
    typeof body.home_lat !== 'number' ||
    typeof body.home_lng !== 'number' ||
    !Number.isFinite(body.home_lat) ||
    !Number.isFinite(body.home_lng)
  ) {
    return NextResponse.json({ error: 'home_lat and home_lng are required' }, { status: 400 })
  }

  const radiusKm = body.radius_km ?? 50
  if (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 500) {
    return NextResponse.json({ error: 'radius_km must be between 1 and 500' }, { status: 400 })
  }

  const row = {
    user_id: user.id,
    home_lat: body.home_lat,
    home_lng: body.home_lng,
    radius_km: radiusKm,
    category_ids: body.category_ids ?? null,
    notify_push: body.notify_push ?? true,
    notify_email: body.notify_email ?? true,
    notify_in_app: body.notify_in_app ?? true,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('vendor_market_alert_prefs')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prefs: data })
}
