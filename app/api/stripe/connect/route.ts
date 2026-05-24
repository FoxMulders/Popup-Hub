import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppBaseUrl, getStripe } from '@/lib/stripe/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${getAppBaseUrl()}/login`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, email, stripe_connected_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.redirect(`${getAppBaseUrl()}/coordinator/dashboard?status=error`)
  }

  if (profile.role !== 'coordinator') {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  try {
    const stripe = getStripe()
    let accountId = profile.stripe_connected_id

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile.email ?? undefined,
        metadata: {
          profile_id: user.id,
        },
      })

      accountId = account.id

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_connected_id: accountId,
          payout_onboarding_status: 'pending',
        })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }
    }

    const baseUrl = getAppBaseUrl()
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/coordinator/dashboard?status=refresh`,
      return_url: `${baseUrl}/coordinator/dashboard?status=success`,
      type: 'account_onboarding',
    })

    return NextResponse.redirect(accountLink.url)
  } catch {
    return NextResponse.redirect(`${getAppBaseUrl()}/coordinator/dashboard?status=error`)
  }
}
