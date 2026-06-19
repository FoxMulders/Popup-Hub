import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeGoogleOAuthCode,
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  getGoogleOAuthRedirectUri,
} from '@/lib/google/oauth'

function redirectWithError(request: Request, code: string) {
  const url = new URL(`${new URL(request.url).origin}/coordinator/events/new`)
  url.searchParams.set('google_error', code)
  return NextResponse.redirect(url.toString())
}

export async function GET(request: Request) {
  const clientId = getGoogleOAuthClientId()
  const clientSecret = getGoogleOAuthClientSecret()
  if (!clientId || !clientSecret) {
    return redirectWithError(request, 'not_configured')
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim()
  const state = searchParams.get('state')?.trim()
  const error = searchParams.get('error')?.trim()

  if (error || !code || !state) {
    return redirectWithError(request, error ?? 'missing_code')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== state) {
    return redirectWithError(request, 'session_mismatch')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return redirectWithError(request, 'forbidden')
  }

  try {
    const tokens = await exchangeGoogleOAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri: getGoogleOAuthRedirectUri(new URL(request.url).origin),
    })

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    await supabase
      .from('profiles')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token ?? undefined,
        google_token_expires_at: expiresAt,
      })
      .eq('id', user.id)

    const successUrl = new URL(`${new URL(request.url).origin}/coordinator/events/new`)
    successUrl.searchParams.set('google_connected', '1')
    return NextResponse.redirect(successUrl.toString())
  } catch (err) {
    console.error('[google/oauth/callback]', err)
    return redirectWithError(request, 'token_exchange_failed')
  }
}
