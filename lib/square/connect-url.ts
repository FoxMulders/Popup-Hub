const SQUARE_OAUTH_SCOPES = 'MERCHANT_PROFILE_READ PAYMENTS_WRITE ORDERS_WRITE'

export function isSquareProductionEnvironment(): boolean {
  return process.env.SQUARE_ENVIRONMENT === 'production'
}

export function getSquareConnectBaseUrl(): string {
  return isSquareProductionEnvironment()
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

export function getSquareOAuthScopes(): string {
  return SQUARE_OAUTH_SCOPES
}

export function getSquareAppId(): string | null {
  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim()
  return appId || null
}

export function buildSquareOAuthAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
}): string {
  const url = new URL(`${getSquareConnectBaseUrl()}/oauth2/authorize`)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('scope', params.scope ?? SQUARE_OAUTH_SCOPES)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  return url.toString()
}

export function getSquareOAuthRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/square/oauth/callback`
}
