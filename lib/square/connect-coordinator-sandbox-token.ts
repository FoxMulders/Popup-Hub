import type { SupabaseClient } from '@supabase/supabase-js'
import { createSellerSquareClient } from '@/lib/square/oauth'

export class SquareSandboxConnectError extends Error {
  constructor(
    readonly code:
      | 'missing_access_token'
      | 'invalid_access_token'
      | 'no_merchant'
      | 'square_api_failed',
    message?: string
  ) {
    super(message ?? code)
    this.name = 'SquareSandboxConnectError'
  }
}

export async function connectCoordinatorSandboxFromEnv(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{ merchantId: string; locationId: string | null }> {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim()
  if (!accessToken) {
    throw new SquareSandboxConnectError('missing_access_token')
  }

  const locationIdFromEnv = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim() || null

  let merchantId: string | null = null
  let locationId = locationIdFromEnv

  try {
    const client = createSellerSquareClient(accessToken)
    const response = await client.locations.list()
    const locations = response.locations ?? []
    const active = locations.find((loc) => loc.status === 'ACTIVE') ?? locations[0]
    merchantId = active?.merchantId ?? null
    if (!locationId) locationId = active?.id ?? null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('401') || message.includes('UNAUTHORIZED')) {
      throw new SquareSandboxConnectError(
        'invalid_access_token',
        'Square rejected SQUARE_ACCESS_TOKEN — copy a fresh Sandbox access token from Developer Console → Sandbox test accounts → your seller → Access token.'
      )
    }
    throw new SquareSandboxConnectError('square_api_failed', message)
  }

  if (!merchantId) {
    throw new SquareSandboxConnectError('no_merchant')
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      payout_account_id: merchantId,
      payout_onboarding_status: 'complete',
      square_access_token: accessToken,
      square_refresh_token: null,
      square_token_expires_at: null,
      square_location_id: locationId,
    })
    .eq('id', coordinatorId)

  if (profileError) {
    throw new SquareSandboxConnectError('square_api_failed', profileError.message)
  }

  await supabase
    .from('events')
    .update({ square_merchant_id: merchantId })
    .eq('coordinator_id', coordinatorId)
    .is('square_merchant_id', null)

  return { merchantId, locationId }
}
