import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function getDailyAdClickSalt(date = new Date()): string {
  const secret =
    process.env.AD_CLICK_HASH_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'popuphub-ad-click-fallback-secret'
  return createHash('sha256').update(`${secret}:${utcDateKey(date)}`).digest('hex')
}

export function hashClientIpForAdClick(ip: string, date = new Date()): string {
  const salt = getDailyAdClickSalt(date)
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex')
}

export interface RecordAdClickParams {
  marketId: string
  vendorId?: string | null
  ipAddressHash: string
  userAgent?: string | null
}

export async function recordAdClick(
  supabase: SupabaseClient,
  params: RecordAdClickParams
): Promise<{ inserted: boolean }> {
  const { error } = await supabase.from('ad_clicks_log').insert({
    market_id: params.marketId,
    vendor_id: params.vendorId ?? null,
    ip_address_hash: params.ipAddressHash,
    user_agent: params.userAgent ?? null,
  })

  if (error) {
    if (error.code === '23505') {
      return { inserted: false }
    }
    throw error
  }

  return { inserted: true }
}
