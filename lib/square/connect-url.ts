import { resolveSquareApplicationId } from '@/lib/square/app-credentials'

/** Space-separated scopes; URLSearchParams encodes spaces as `+` per Square OAuth docs. */
const SQUARE_OAUTH_SCOPES = 'MERCHANT_PROFILE_READ PAYMENTS_WRITE ORDERS_WRITE'

export function isSquareProductionEnvironment(): boolean {
  return process.env.SQUARE_ENVIRONMENT === 'production'
}

export function getSquareConnectBaseUrl(): string {
  return isSquareProductionEnvironment()
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

/** Sandbox seller dashboard (must be signed in before OAuth or authorize page can be blank). */
export const SQUARE_SANDBOX_SELLER_DASHBOARD_URL = 'https://squareupsandbox.com/dashboard'

export function getSquareOAuthScopes(): string {
  return SQUARE_OAUTH_SCOPES
}

export function formatSquareOAuthScopeParam(scope?: string): string {
  const raw = (scope ?? SQUARE_OAUTH_SCOPES).trim()
  // Pass space-separated scopes to URLSearchParams — it encodes spaces as `+`, which Square
  // treats as scope separators. Joining with literal `+` here would encode to `%2B` and 400.
  return raw.split(/\s+/).filter(Boolean).join(' ')
}

export function getSquareAppId(): string | null {
  return resolveSquareApplicationId()
}

export function normalizeAppOrigin(raw?: string): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

function assertOAuthParam(name: string, value: string | undefined | null): string {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    throw new Error(
      `[square/oauth] Missing or invalid ${name} for Square OAuth authorize URL`
    )
  }
  return trimmed
}

export function buildSquareOAuthAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
}): string {
  const clientId = assertOAuthParam(
    'client_id (set NEXT_PUBLIC_SQUARE_APP_ID, NEXT_PUBLIC_SQUARE_CLIENT_ID, SQUARE_SANDBOX_CLIENT_ID, or SQUARE_CLIENT_ID)',
    params.clientId
  )
  const redirectUri = assertOAuthParam(
    'redirect_uri (set NEXT_PUBLIC_APP_URL)',
    params.redirectUri
  )
  const state = assertOAuthParam('state (OAuth CSRF token)', params.state)

  try {
    const url = new URL(`${getSquareConnectBaseUrl()}/oauth2/authorize`)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('scope', formatSquareOAuthScopeParam(params.scope))
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')
    if (isSquareProductionEnvironment()) {
      url.searchParams.set('session', 'false')
    }
    return url.toString()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[square/oauth] Failed to build authorize URL:', message)
    throw err instanceof Error ? err : new Error(message)
  }
}

export function tryBuildSquareOAuthAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
}): { url: string } | { error: string } {
  try {
    return { url: buildSquareOAuthAuthorizeUrl(params) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error building Square OAuth URL'
    console.error('[square/oauth]', message)
    return { error: message }
  }
}

export function getSquareOAuthRedirectUri(): string | null {
  const appUrl = normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (!appUrl) return null
  return `${appUrl}/api/square/oauth/callback`
}
