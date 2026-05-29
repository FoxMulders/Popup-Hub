import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createStripeConnectAccountLink, refreshStripeConnectStatus } from '@/lib/stripe/connect'
import { isStripeConfigured } from '@/lib/stripe/client'

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured on this deployment' }, { status: 503 })
  }

  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const link = await createStripeConnectAccountLink(serviceSupabase, user.id)
  if (!link) {
    return NextResponse.json({ error: 'Could not create Stripe onboarding link' }, { status: 500 })
  }

  return NextResponse.json({ url: link.url })
}

export async function GET() {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const complete = await refreshStripeConnectStatus(serviceSupabase, user.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connected_id, stripe_onboarding_complete')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    configured: isStripeConfigured(),
    connected: !!profile?.stripe_connected_id,
    onboardingComplete: complete || profile?.stripe_onboarding_complete === true,
    accountId: profile?.stripe_connected_id ?? null,
  })
}
