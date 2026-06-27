import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeGoogleOAuthCode,
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  getGoogleOAuthRedirectUri,
} from '@/lib/google/oauth'
import { googleOAuthReturnUrl, parseGoogleOAuthState } from '@/lib/google/oauth-return'

function redirectWithError(request: Request, returnTo: string, code: string) {
  const origin = new URL(request.url).origin
  return NextResponse.redirect(googleOAuthReturnUrl(origin, returnTo, `error_${code}`))
}

export async function GET(request: Request) {
  const clientId = getGoogleOAuthClientId()
  const clientSecret = getGoogleOAuthClientSecret()
  const { searchParams } = new URL(request.url)
  const parsedState = parseGoogleOAuthState(searchParams.get('state'))
  const returnTo = parsedState?.returnTo ?? '/coordinator/events/new'

  if (!clientId || !clientSecret) {
    return redirectWithError(request, returnTo, 'not_configured')
  }

  const code = searchParams.get('code')?.trim()
  const state = searchParams.get('state')?.trim()
  const error = searchParams.get('error')?.trim()

  if (error || !code || !state || !parsedState) {
    return redirectWithError(request, returnTo, error ?? 'missing_code')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== parsedState.userId) {
    return redirectWithError(request, returnTo, 'session_mismatch')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return redirectWithError(request, returnTo, 'forbidden')
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

    const origin = new URL(request.url).origin
    return NextResponse.redirect(googleOAuthReturnUrl(origin, returnTo, 'connected'))
  } catch (err) {
    console.error('[google/oauth/callback]', err)
    return redirectWithError(request, returnTo, 'token_exchange_failed')
  }
}
