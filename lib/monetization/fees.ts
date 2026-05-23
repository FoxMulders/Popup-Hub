import type { PlatformFeeMode } from '@/types/database'
import {
  getDefaultPlatformFeeBps,
  getDefaultPlatformFeeFlatCents,
  getDefaultPlatformFeeMode,
} from './fee-config'

/**
 * Compute Popup Hub platform fee in cents for a booth payment.
 * Default: 3% + $1.00 (percent_plus_flat).
 */
export function computePlatformFeeCents(
  boothPriceCents: number,
  options: {
    mode?: PlatformFeeMode
    flatCents?: number
    bps?: number
  } = {}
): number {
  const mode = options.mode ?? getDefaultPlatformFeeMode()
  const flatCents = options.flatCents ?? getDefaultPlatformFeeFlatCents()
  const bps = options.bps ?? getDefaultPlatformFeeBps()

  const percentFee = Math.round((boothPriceCents * bps) / 10000)

  switch (mode) {
    case 'percent':
      return percentFee
    case 'flat':
      return flatCents
    case 'percent_plus_flat':
      return percentFee + flatCents
    case 'greater_of':
    default:
      return Math.max(flatCents, percentFee)
  }
}

export function splitBoothPayment(
  totalCents: number,
  platformFeeCents: number
): { organizerPayoutCents: number; platformFeeCents: number } {
  const fee = Math.min(platformFeeCents, totalCents)
  return {
    platformFeeCents: fee,
    organizerPayoutCents: totalCents - fee,
  }
}
