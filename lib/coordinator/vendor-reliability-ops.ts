import { createAdminClient } from '@/lib/supabase/server'
import {
  computeVendorReliabilityScore,
  type VendorReliabilityInputs,
} from '@/lib/vendor-reliability'

type AdminClient = ReturnType<typeof createAdminClient>

const RELIABILITY_SELECT =
  'late_arrival_count, no_show_count, left_early_count, poor_cleanup_strike_count'

async function readVendorStrikeCounts(
  admin: AdminClient,
  vendorId: string
): Promise<VendorReliabilityInputs | null> {
  const { data: profile, error } = await admin
    .from('profiles')
    .select(RELIABILITY_SELECT)
    .eq('id', vendorId)
    .single()

  if (error || !profile) return null
  return profile as VendorReliabilityInputs
}

async function writeVendorReliability(
  admin: AdminClient,
  vendorId: string,
  metrics: VendorReliabilityInputs
): Promise<boolean> {
  const { error } = await admin
    .from('profiles')
    .update({
      late_arrival_count: metrics.late_arrival_count ?? 0,
      left_early_count: metrics.left_early_count ?? 0,
      reliability_score: computeVendorReliabilityScore(metrics),
    })
    .eq('id', vendorId)

  return !error
}

/** Increment late-arrival strike when a coordinator marks load-in as late. */
export async function applyLateLoadInReliability(
  admin: AdminClient,
  vendorId: string
): Promise<boolean> {
  const current = await readVendorStrikeCounts(admin, vendorId)
  if (!current) return false

  const lateCount = (current.late_arrival_count ?? 0) + 1
  return writeVendorReliability(admin, vendorId, {
    ...current,
    late_arrival_count: lateCount,
  })
}

/** Increment early-departure strike when a coordinator flags early exit. */
export async function applyEarlyExitReliability(
  admin: AdminClient,
  vendorId: string
): Promise<boolean> {
  const current = await readVendorStrikeCounts(admin, vendorId)
  if (!current) return false

  const leftEarlyCount = (current.left_early_count ?? 0) + 1
  return writeVendorReliability(admin, vendorId, {
    ...current,
    left_early_count: leftEarlyCount,
  })
}

export function createVendorReliabilityAdminClient(): AdminClient {
  return createAdminClient()
}
