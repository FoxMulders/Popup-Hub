import type { SupabaseClient } from '@supabase/supabase-js'

/** Upsert today's vendor interest snapshot from follow count (best-effort). */
export async function ensureVendorInterestDaily(
  service: SupabaseClient,
  vendorId: string
): Promise<{ followCount: number; viewCount: number }> {
  const day = new Date().toISOString().slice(0, 10)

  const { count } = await service
    .from('vendor_follows')
    .select('user_id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)

  const followCount = count ?? 0

  await service.from('vendor_interest_daily').upsert(
    {
      vendor_id: vendorId,
      day,
      follow_count: followCount,
      view_count: 0,
    },
    { onConflict: 'vendor_id,day' }
  )

  return { followCount, viewCount: 0 }
}
