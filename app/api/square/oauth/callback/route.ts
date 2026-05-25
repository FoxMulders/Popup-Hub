import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createSquareOAuthClient,
  fetchPrimaryLocationId,
  getSquareApplicationSecret,
} from '@/lib/square/oauth'
import { resolveSquareApplicationId } from '@/lib/square/app-credentials'
import { getSquareOAuthRedirectUri } from '@/lib/square/connect-url'

function redirectWithError(code: string, detail?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const url = new URL(`${base}/coordinator/square-connect`)
  url.searchParams.set('error', code)
  if (detail) url.searchParams.set('detail', detail.slice(0, 200))
  return NextResponse.redirect(url.toString())
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return redirectWithError(error ?? 'missing_code')
  }

  const clientId = resolveSquareApplicationId()
  const clientSecret = getSquareApplicationSecret()
  if (!clientId) {
    return redirectWithError('missing_app_id')
  }
  if (!clientSecret) {
    return redirectWithError('missing_app_secret')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== state) {
    return redirectWithError('session_mismatch')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return redirectWithError('forbidden')
  }

  const redirectUri = getSquareOAuthRedirectUri()

  try {
    const oauthClient = createSquareOAuthClient()
    const response = await oauthClient.oAuth.obtainToken({
      clientId,
      clientSecret,
      code,
      grantType: 'authorization_code',
      ...(redirectUri ? { redirectUri } : {}),
    })

    const merchantId = response.merchantId
    const accessToken = response.accessToken

    if (!merchantId || !accessToken) {
      return redirectWithError('no_merchant')
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

    const successUrl = new URL(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect`
    )
    successUrl.searchParams.set('success', 'true')
    return NextResponse.redirect(successUrl.toString())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed'
    console.error('[square/oauth/callback]', message)
    if (message.toLowerCase().includes('unable to find client')) {
      return redirectWithError(
        'invalid_client_id',
        'Square rejected the Application ID. Use the Sandbox Application ID when SQUARE_ENVIRONMENT is not production, set NEXT_PUBLIC_SQUARE_APP_ID (or SQUARE_CLIENT_ID) to match the Square Developer Dashboard, and register the OAuth redirect URL exactly.'
      )
    }
    return redirectWithError('oauth_failed', message)
  }
}
