import { SquareClient, SquareEnvironment } from 'square'
import type { SupabaseClient } from '@supabase/supabase-js'

const environment =
  process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox

export interface CoordinatorSquareCredentials {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
  merchantId: string | null
  locationId: string | null
}

export function createSellerSquareClient(accessToken: string) {
  return new SquareClient({
    token: accessToken,
    environment,
  })
}

export function getSquareApplicationSecret(): string {
  return (
    process.env.SQUARE_APPLICATION_SECRET ??
    process.env.SQUARE_ACCESS_TOKEN ??
    ''
  )
}

export async function fetchPrimaryLocationId(accessToken: string): Promise<string | null> {
  try {
    const client = createSellerSquareClient(accessToken)
    const response = await client.locations.list()
    const locations = response.locations ?? []
    const active = locations.find((loc) => loc.status === 'ACTIVE') ?? locations[0]
    return active?.id ?? null
  } catch {
    return null
  }
}

export async function refreshCoordinatorAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string | null } | null> {
  try {
    const client = new SquareClient({ environment })
    const response = await client.oAuth.obtainToken({
      clientId: process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
      clientSecret: getSquareApplicationSecret(),
      refreshToken,
      grantType: 'refresh_token',
    })

    if (!response.accessToken) return null

    const expiresAt = response.expiresAt
      ? new Date(response.expiresAt).toISOString()
      : null

    return {
      accessToken: response.accessToken,
      expiresAt,
    }
  } catch {
    return null
  }
}

export async function getCoordinatorAccessToken(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{ accessToken: string; locationId: string | null; merchantId: string | null } | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'square_access_token, square_refresh_token, square_token_expires_at, square_location_id, payout_account_id'
    )
    .eq('id', coordinatorId)
    .single()

  if (!profile?.square_access_token) return null

  let accessToken = profile.square_access_token as string
  const expiresAt = profile.square_token_expires_at
    ? new Date(profile.square_token_expires_at as string).getTime()
    : null

  const isExpired = expiresAt != null && expiresAt <= Date.now() + 60_000

  if (isExpired && profile.square_refresh_token) {
    const refreshed = await refreshCoordinatorAccessToken(
      profile.square_refresh_token as string
    )
    if (refreshed) {
      accessToken = refreshed.accessToken
      await supabase
        .from('profiles')
        .update({
          square_access_token: refreshed.accessToken,
          square_token_expires_at: refreshed.expiresAt,
        })
        .eq('id', coordinatorId)
    }
  }

  return {
    accessToken,
    locationId: (profile.square_location_id as string | null) ?? null,
    merchantId: (profile.payout_account_id as string | null) ?? null,
  }
}
