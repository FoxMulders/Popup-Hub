import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { squareClient } from '@/lib/square/client'
import {
  fetchPrimaryLocationId,
  getSquareApplicationSecret,
} from '@/lib/square/oauth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=${error ?? 'missing_code'}`
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=session_mismatch`
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=forbidden`
    )
  }

  try {
    const response = await squareClient.oAuth.obtainToken({
      clientId: process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
      clientSecret: getSquareApplicationSecret(),
      code,
      grantType: 'authorization_code',
    })

    const merchantId = response.merchantId
    const accessToken = response.accessToken

    if (!merchantId || !accessToken) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=no_merchant`
      )
    }

    const locationId = await fetchPrimaryLocationId(accessToken)
    const expiresAt = response.expiresAt
      ? new Date(response.expiresAt).toISOString()
      : null

    await supabase
      .from('profiles')
      .update({
        payout_account_id: merchantId,
        payout_onboarding_status: 'complete',
        square_access_token: accessToken,
        square_refresh_token: response.refreshToken ?? null,
        square_token_expires_at: expiresAt,
        square_location_id: locationId,
      })
      .eq('id', user.id)

    await supabase
      .from('events')
      .update({ square_merchant_id: merchantId })
      .eq('coordinator_id', user.id)
      .is('square_merchant_id', null)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?success=true`
    )
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=oauth_failed`
    )
  }
}
