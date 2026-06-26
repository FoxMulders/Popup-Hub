import type { SupabaseClient } from '@supabase/supabase-js'
import { computeVendorReliabilityScore } from '@/lib/vendor-reliability'

type ReliabilityProfileRow = {
  late_arrival_count: number | null
  left_early_count: number | null
  no_show_count: number | null
  poor_cleanup_strike_count: number | null
}

export async function applyVendorLateArrivalStrike(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  const { data: profile, error: readError } = await admin
    .from('profiles')
    .select('late_arrival_count, left_early_count, no_show_count, poor_cleanup_strike_count')
    .eq('id', vendorId)
    .maybeSingle()

  if (readError || !profile) return false

  const row = profile as ReliabilityProfileRow
  const lateArrivalCount = (row.late_arrival_count ?? 0) + 1
  const reliabilityScore = computeVendorReliabilityScore({
    late_arrival_count: lateArrivalCount,
    left_early_count: row.left_early_count,
    no_show_count: row.no_show_count,
    poor_cleanup_strike_count: row.poor_cleanup_strike_count,
  })

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      late_arrival_count: lateArrivalCount,
      reliability_score: reliabilityScore,
    })
    .eq('id', vendorId)

  return !updateError
}

export async function applyVendorEarlyExitStrike(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  const { data: profile, error: readError } = await admin
    .from('profiles')
    .select('late_arrival_count, left_early_count, no_show_count, poor_cleanup_strike_count')
    .eq('id', vendorId)
    .maybeSingle()

  if (readError || !profile) return false

  const row = profile as ReliabilityProfileRow
  const leftEarlyCount = (row.left_early_count ?? 0) + 1
  const reliabilityScore = computeVendorReliabilityScore({
    late_arrival_count: row.late_arrival_count,
    left_early_count: leftEarlyCount,
    no_show_count: row.no_show_count,
    poor_cleanup_strike_count: row.poor_cleanup_strike_count,
  })

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      left_early_count: leftEarlyCount,
      reliability_score: reliabilityScore,
    })
    .eq('id', vendorId)

  return !updateError
}

export function shouldApplyLateArrivalStrike(
  previousStatus: string | null | undefined,
  nextStatus: string | null
): boolean {
  return (
    (nextStatus === 'late' || nextStatus === 'missed') &&
    previousStatus !== 'late' &&
    previousStatus !== 'missed'
  )
}

export function shouldApplyEarlyExitStrike(alreadyLeftEarly: boolean): boolean {
  return !alreadyLeftEarly
}
