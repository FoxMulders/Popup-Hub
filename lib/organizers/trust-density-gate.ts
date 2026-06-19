import { createClient } from '@/lib/supabase/server'

/** Stage 4 marketplace GTM thresholds (Edmonton launch). */
export const TRUST_DENSITY_GATE = {
  organizersWithTwoPlusReviews: 20,
  activePhCoordinators: 5,
  claimRatePercent: 15,
} as const

export type TrustDensityMetrics = {
  organizersWithTwoPlusReviews: number
  activePhCoordinators: number
  profilesWithActivity: number
  claimedProfilesWithActivity: number
  claimRatePercent: number
}

export async function getTrustDensityMetrics(
  region = 'edmonton-metro'
): Promise<TrustDensityMetrics> {
  const supabase = await createClient()

  const { data: organizers } = await supabase
    .from('organizers')
    .select('id, claimed_by')
    .eq('region', region)
    .eq('listing_status', 'published')

  const organizerIds = (organizers ?? []).map((o) => o.id)
  if (organizerIds.length === 0) {
    return {
      organizersWithTwoPlusReviews: 0,
      activePhCoordinators: 0,
      profilesWithActivity: 0,
      claimedProfilesWithActivity: 0,
      claimRatePercent: 0,
    }
  }

  const { data: reviews } = await supabase
    .from('organizer_reviews')
    .select('organizer_id')
    .eq('published', true)
    .in('organizer_id', organizerIds)

  const reviewCounts = new Map<string, number>()
  for (const row of reviews ?? []) {
    reviewCounts.set(row.organizer_id, (reviewCounts.get(row.organizer_id) ?? 0) + 1)
  }

  const { data: mentions } = await supabase
    .from('organizer_community_mentions')
    .select('organizer_id')
    .eq('published', true)
    .in('organizer_id', organizerIds)

  const mentionCounts = new Map<string, number>()
  for (const row of mentions ?? []) {
    mentionCounts.set(row.organizer_id, (mentionCounts.get(row.organizer_id) ?? 0) + 1)
  }

  let organizersWithTwoPlusReviews = 0
  let profilesWithActivity = 0
  let claimedProfilesWithActivity = 0

  for (const org of organizers ?? []) {
    const activity = (reviewCounts.get(org.id) ?? 0) + (mentionCounts.get(org.id) ?? 0)
    if ((reviewCounts.get(org.id) ?? 0) >= 2) organizersWithTwoPlusReviews += 1
    if (activity > 0) {
      profilesWithActivity += 1
      if (org.claimed_by) claimedProfilesWithActivity += 1
    }
  }

  const { count: activePhCoordinators } = await supabase
    .from('organizers')
    .select('id', { count: 'exact', head: true })
    .eq('region', region)
    .eq('listing_status', 'published')
    .not('popup_hub_coordinator_id', 'is', null)

  const claimRatePercent =
    profilesWithActivity > 0
      ? Math.round((claimedProfilesWithActivity / profilesWithActivity) * 100)
      : 0

  return {
    organizersWithTwoPlusReviews,
    activePhCoordinators: activePhCoordinators ?? 0,
    profilesWithActivity,
    claimedProfilesWithActivity,
    claimRatePercent,
  }
}

export async function isMarketplaceGtmEnabled(region = 'edmonton-metro'): Promise<boolean> {
  const metrics = await getTrustDensityMetrics(region)
  return (
    metrics.organizersWithTwoPlusReviews >= TRUST_DENSITY_GATE.organizersWithTwoPlusReviews &&
    metrics.activePhCoordinators >= TRUST_DENSITY_GATE.activePhCoordinators &&
    metrics.claimRatePercent >= TRUST_DENSITY_GATE.claimRatePercent
  )
}
