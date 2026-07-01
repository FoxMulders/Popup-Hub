export interface UpgradeToNativeSquareOAuth {
  authorizeUrl: string | null
}

export interface UpgradeToNativeResponse {
  ok: true
  marketId: string
  squareOAuth: UpgradeToNativeSquareOAuth
}

export interface UpgradeToNativeErrorResponse {
  error: string
  code?: string
  message?: string
}

export async function postUpgradeToNative(
  marketId: string
): Promise<UpgradeToNativeResponse> {
  const response = await fetch(`/api/v1/markets/${encodeURIComponent(marketId)}/upgrade-to-native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  })

  const payload = (await response.json()) as UpgradeToNativeResponse | UpgradeToNativeErrorResponse

  if (!response.ok) {
    const message =
      'message' in payload && payload.message
        ? payload.message
        : 'error' in payload
          ? payload.error
          : 'Upgrade failed'
    throw new Error(message)
  }

  return payload as UpgradeToNativeResponse
}

export function redirectToSquareOnboarding(authorizeUrl: string | null | undefined): void {
  if (!authorizeUrl) return
  window.open(authorizeUrl, '_blank', 'noopener,noreferrer')
}
