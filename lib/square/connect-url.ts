import { resolveSquareApplicationId } from '@/lib/square/app-credentials'

/** Space-separated scopes; encoded with `+` in the authorize URL per Square docs. */
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
  return raw.split(/\s+/).filter(Boolean).join('+')
}

export function getSquareAppId(): string | null {
  return resolveSquareApplicationId()
}

export function normalizeAppOrigin(raw?: string): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

export function buildSquareOAuthAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
}): string {
  const url = new URL(`${getSquareConnectBaseUrl()}/oauth2/authorize`)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('scope', formatSquareOAuthScopeParam(params.scope))
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('response_type', 'code')
  if (isSquareProductionEnvironment()) {
    url.searchParams.set('session', 'false')
  }
  return url.toString()
}

export function getSquareOAuthRedirectUri(): string | null {
  const appUrl = normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (!appUrl) return null
  return `${appUrl}/api/square/oauth/callback`
}
