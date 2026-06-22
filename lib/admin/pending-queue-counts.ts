import type { SupabaseClient } from '@supabase/supabase-js'

export interface AdminPendingQueueCounts {
  featureRequests: number
  venueSubmissions: number
  total: number
}

export async function fetchAdminPendingQueueCounts(
  service: SupabaseClient
): Promise<AdminPendingQueueCounts> {
  const [{ count: featureRequests }, { count: venueSubmissions }] = await Promise.all([
    service
      .from('feature_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    service
      .from('platform_venue_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const featureCount = featureRequests ?? 0
  const venueCount = venueSubmissions ?? 0

  return {
    featureRequests: featureCount,
    venueSubmissions: venueCount,
    total: featureCount + venueCount,
  }
}
