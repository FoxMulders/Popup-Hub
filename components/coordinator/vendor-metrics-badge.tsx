'use client'

import { computeVendorReliabilityScore, vendorStrikeFlags, type VendorReliabilityInputs } from '@/lib/vendor-reliability'

const STRIKE_LABELS: Record<string, string> = {
  no_show: 'No-shows',
  late_arrival: 'Late arrivals',
  left_early: 'Early departures',
  poor_cleanup: 'Cleanup strikes',
}

interface VendorMetricsBadgeProps {
  vendor: VendorReliabilityInputs
  compact?: boolean
}

export function VendorMetricsBadge({ vendor, compact }: VendorMetricsBadgeProps) {
  const score = computeVendorReliabilityScore(vendor)
  const strikes = vendorStrikeFlags(vendor)

  const tone =
    score >= 90
      ? 'bg-sage-100 text-sage-800 border-sage-200'
      : score >= 70
        ? 'bg-harvest-50 text-harvest-800 border-harvest-200'
        : 'bg-terracotta-50 text-terracotta-800 border-terracotta-200'

  return (
    <div className={compact ? 'inline-flex flex-col gap-0.5' : 'space-y-1'}>
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
      >
        {score}% reliable
      </span>
      {!compact && strikes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {strikes.map((flag) => (
            <span
              key={flag}
              className="rounded-md border border-harvest-200/80 bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-harvest-800"
            >
              {STRIKE_LABELS[flag]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
