import {
  getSquareOAuthRedirectUri,
  isSquareProductionEnvironment,
} from '@/lib/square/connect-url'

/** Resolve Square OAuth application id (authorize URL + token exchange must use the same value). */
export function resolveSquareApplicationId(): string | null {
  const isProduction = process.env.SQUARE_ENVIRONMENT === 'production'
  const candidates = [
    process.env.NEXT_PUBLIC_SQUARE_APP_ID,
    process.env.NEXT_PUBLIC_SQUARE_CLIENT_ID,
    ...(isProduction ? [] : [process.env.SQUARE_SANDBOX_CLIENT_ID]),
    process.env.SQUARE_CLIENT_ID,
    process.env.SQUARE_APPLICATION_ID,
  ]
  for (const raw of candidates) {
    const trimmed = raw?.trim()
    if (trimmed && trimmed !== 'undefined' && trimmed !== 'null') return trimmed
  }
  return null
}

export function resolveSquareApplicationSecret(): string {
  return (
    process.env.SQUARE_APPLICATION_SECRET?.trim() ??
    process.env.SQUARE_CLIENT_SECRET?.trim() ??
    ''
  )
}

export function squareCredentialsDiagnostics(): {
  appId: string | null
  hasSecret: boolean
  environment: 'production' | 'sandbox'
  redirectUri: string | null
} {
  return {
    appId: resolveSquareApplicationId(),
    hasSecret: resolveSquareApplicationSecret().length > 0,
    environment: isSquareProductionEnvironment() ? 'production' : 'sandbox',
    redirectUri: getSquareOAuthRedirectUri(),
  }
}
