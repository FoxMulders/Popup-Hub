import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const FEATURE_LOCKED_EXTERNAL_TIER = {
  error: 'Operation Locked',
  code: 'FEATURE_LOCKED_EXTERNAL_TIER',
  message: 'This operational function requires a Native Market migration.',
} as const

export type FeatureLockedExternalTierResponse = typeof FEATURE_LOCKED_EXTERNAL_TIER

export function featureLockedExternalTierResponse(): NextResponse {
  return NextResponse.json(FEATURE_LOCKED_EXTERNAL_TIER, { status: 403 })
}

export async function enforceNativeMarketPermissions(
  supabase: SupabaseClient,
  marketId: string
): Promise<NextResponse | null> {
  const trimmedId = marketId.trim()
  if (!trimmedId) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  const { data: market, error } = await supabase
    .from('events')
    .select('id, is_external_listing')
    .eq('id', trimmedId)
    .maybeSingle()

  if (error) {
    console.error('[enforceNativeMarketPermissions]', error.message)
    return NextResponse.json({ error: 'Could not verify market permissions' }, { status: 500 })
  }

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  if (market.is_external_listing === true) {
    return featureLockedExternalTierResponse()
  }

  return null
}

export async function resolveMarketIdFromApplicationId(
  supabase: SupabaseClient,
  applicationId: string
): Promise<{ marketId: string | null; error: NextResponse | null }> {
  const { data: application, error } = await supabase
    .from('booth_applications')
    .select('event_id')
    .eq('id', applicationId)
    .maybeSingle()

  if (error) {
    console.error('[resolveMarketIdFromApplicationId]', error.message)
    return {
      marketId: null,
      error: NextResponse.json({ error: 'Could not resolve application' }, { status: 500 }),
    }
  }

  if (!application?.event_id) {
    return {
      marketId: null,
      error: NextResponse.json({ error: 'Application not found' }, { status: 404 }),
    }
  }

  return { marketId: application.event_id, error: null }
}

export async function enforceNativeMarketPermissionsForApplication(
  supabase: SupabaseClient,
  applicationId: string
): Promise<NextResponse | null> {
  const { marketId, error } = await resolveMarketIdFromApplicationId(supabase, applicationId)
  if (error) return error
  if (!marketId) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  return enforceNativeMarketPermissions(supabase, marketId)
}
