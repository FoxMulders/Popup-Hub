import type { SupabaseClient } from '@supabase/supabase-js'
import { COORDINATOR_APPLICATION_SELECT } from '@/lib/applications/coordinator-application-select'
import { normalizeCoordinatorApplication } from '@/lib/applications/normalize-coordinator-application'
import type { BoothApplication } from '@/types/database'

const COORDINATOR_APPLICATION_SELECT_FALLBACK = `
  *,
  vendor:profiles!booth_applications_vendor_id_fkey(
    id,
    full_name,
    email,
    phone,
    avatar_url,
    reliability_score,
    no_show_count,
    left_early_count,
    late_arrival_count,
    poor_cleanup_strike_count,
    total_markets
  ),
  category:categories(name)
` as const

export type FetchCoordinatorApplicationsResult = {
  applications: BoothApplication[]
  error: string | null
  usedFallback: boolean
}

export async function fetchCoordinatorEventApplications(
  supabase: SupabaseClient,
  eventId: string
): Promise<FetchCoordinatorApplicationsResult> {
  const primary = await supabase
    .from('booth_applications')
    .select(COORDINATOR_APPLICATION_SELECT)
    .eq('event_id', eventId)
    .order('applied_at', { ascending: true })

  if (!primary.error && (primary.data?.length ?? 0) > 0) {
    return {
      applications: (primary.data ?? []).map((row) =>
        normalizeCoordinatorApplication(row as Record<string, unknown>)
      ) as BoothApplication[],
      error: null,
      usedFallback: false,
    }
  }

  if (!primary.error && (primary.data?.length ?? 0) === 0) {
    const { count } = await supabase
      .from('booth_applications')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)

    if ((count ?? 0) === 0) {
      return { applications: [], error: null, usedFallback: false }
    }
  }

  const fallback = await supabase
    .from('booth_applications')
    .select(COORDINATOR_APPLICATION_SELECT_FALLBACK)
    .eq('event_id', eventId)
    .order('applied_at', { ascending: true })

  if (fallback.error) {
    return {
      applications: [],
      error: fallback.error.message,
      usedFallback: true,
    }
  }

  return {
    applications: (fallback.data ?? []).map((row) =>
      normalizeCoordinatorApplication(row as Record<string, unknown>)
    ) as BoothApplication[],
    error: primary.error?.message ?? null,
    usedFallback: true,
  }
}
