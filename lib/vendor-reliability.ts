/** Vendor reliability score from strike counters (0–100). */

export interface VendorReliabilityInputs {
  reliability_score?: number | null
  no_show_count?: number | null
  left_early_count?: number | null
  late_arrival_count?: number | null
  poor_cleanup_strike_count?: number | null
}

const NO_SHOW_PENALTY = 20
const LEFT_EARLY_PENALTY = 10
const LATE_ARRIVAL_PENALTY = 5
const CLEANUP_STRIKE_PENALTY = 8

export function computeVendorReliabilityScore(input: VendorReliabilityInputs): number {
  const score =
    100 -
    (input.no_show_count ?? 0) * NO_SHOW_PENALTY -
    (input.left_early_count ?? 0) * LEFT_EARLY_PENALTY -
    (input.late_arrival_count ?? 0) * LATE_ARRIVAL_PENALTY -
    (input.poor_cleanup_strike_count ?? 0) * CLEANUP_STRIKE_PENALTY
  return Math.max(0, Math.min(100, score))
}

export type VendorStrikeFlag = 'no_show' | 'late_arrival' | 'left_early' | 'poor_cleanup'

export function vendorStrikeFlags(input: VendorReliabilityInputs): VendorStrikeFlag[] {
  const flags: VendorStrikeFlag[] = []
  if ((input.no_show_count ?? 0) > 0) flags.push('no_show')
  if ((input.late_arrival_count ?? 0) > 0) flags.push('late_arrival')
  if ((input.left_early_count ?? 0) > 0) flags.push('left_early')
  if ((input.poor_cleanup_strike_count ?? 0) > 0) flags.push('poor_cleanup')
  return flags
}
