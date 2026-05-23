import type { PlatformFeeMode } from '@/types/database'

export function getDefaultPlatformFeeMode(): PlatformFeeMode {
  const mode = process.env.PLATFORM_FEE_MODE
  if (
    mode === 'percent' ||
    mode === 'flat' ||
    mode === 'greater_of' ||
    mode === 'percent_plus_flat'
  ) {
    return mode
  }
  return 'percent_plus_flat'
}

export function getDefaultPlatformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS
  const parsed = raw ? Number.parseInt(raw, 10) : 300
  return Number.isFinite(parsed) ? parsed : 300
}

export function getDefaultPlatformFeeFlatCents(): number {
  const raw = process.env.PLATFORM_FEE_FLAT_CENTS
  const parsed = raw ? Number.parseInt(raw, 10) : 100
  return Number.isFinite(parsed) ? parsed : 100
}

export interface EventFeeConfig {
  mode: PlatformFeeMode
  flatCents: number
  bps: number
}

export function resolveEventFeeConfig(event?: {
  platform_fee_mode?: PlatformFeeMode | null
  platform_fee_flat_cents?: number | null
  platform_fee_bps?: number | null
} | null): EventFeeConfig {
  return {
    mode: event?.platform_fee_mode ?? getDefaultPlatformFeeMode(),
    flatCents: event?.platform_fee_flat_cents ?? getDefaultPlatformFeeFlatCents(),
    bps: event?.platform_fee_bps ?? getDefaultPlatformFeeBps(),
  }
}
