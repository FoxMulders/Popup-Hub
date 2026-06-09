import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  createSquareOAuthClient,
  fetchPrimaryLocationId,
  getSquareApplicationSecret,
} from '@/lib/square/oauth'
import { resolveSquareApplicationId } from '@/lib/square/app-credentials'
import {
  getSquareOAuthRedirectUri,
  normalizeAppOrigin,
} from '@/lib/square/connect-url'

function resolveAppBaseUrl(request: Request): string | null {
  const fromEnv = normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (fromEnv) return fromEnv
  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

function redirectWithError(request: Request, code: string, detail?: string) {
  const base = resolveAppBaseUrl(request)
  if (!base) {
    console.error(
      '[square/oauth/callback] Cannot redirect — NEXT_PUBLIC_APP_URL is unset and request origin unavailable',
      { code, detail }
    )
    return NextResponse.json({ error: code, detail: detail ?? null }, { status: 500 })
  }
  const url = new URL(`${base}/coordinator/payment-methods`)
  url.searchParams.set('error', code)
  if (detail) url.searchParams.set('detail', detail.slice(0, 200))
  return NextResponse.redirect(url.toString())
}

export async function GET(request: Request) {
  try {
    let searchParams: URLSearchParams
    try {
      searchParams = new URL(request.url).searchParams
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid_request_url'
      console.error('[square/oauth/callback] Failed to parse callback URL:', message)
      return redirectWithError(request, 'oauth_failed', message)
    }

    const code = searchParams.get('code')?.trim() || null
    const state = searchParams.get('state')?.trim() || null
    const error = searchParams.get('error')?.trim() || null

    if (error || !code || !state) {
      return redirectWithError(request, error ?? 'missing_code')
    }

    const clientId = resolveSquareApplicationId()
    const clientSecret = getSquareApplicationSecret()
    if (!clientId) {
      return redirectWithError(request, 'missing_app_id')
    }
    if (!clientSecret) {
      return redirectWithError(request, 'missing_app_secret')
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
        return redirectWithError(request, 'no_merchant')
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

      const base = resolveAppBaseUrl(request)
      if (!base) {
        console.error(
          '[square/oauth/callback] OAuth succeeded but NEXT_PUBLIC_APP_URL is unset — cannot redirect'
        )
        return NextResponse.json(
          { error: 'missing_redirect', detail: 'Square connected; set NEXT_PUBLIC_APP_URL and reload.' },
          { status: 500 }
        )
      }

      const successUrl = new URL(`${base}/coordinator/payment-methods`)
      successUrl.searchParams.set('success', 'true')
      return NextResponse.redirect(successUrl.toString())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'oauth_failed'
      console.error('[square/oauth/callback] Token exchange failed:', message)
      if (message.toLowerCase().includes('unable to find client')) {
        return redirectWithError(
          request,
          'invalid_client_id',
          'Square rejected the Application ID. Use the Sandbox Application ID when SQUARE_ENVIRONMENT is not production, set NEXT_PUBLIC_SQUARE_APP_ID (or SQUARE_CLIENT_ID) to match the Square Developer Dashboard, and register the OAuth redirect URL exactly.'
        )
      }
      return redirectWithError(request, 'oauth_failed', message)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed'
    console.error('[square/oauth/callback] Unhandled error:', message)
    return redirectWithError(request, 'oauth_failed', message)
  }
}
