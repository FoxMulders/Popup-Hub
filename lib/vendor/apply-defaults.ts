import type { PaymentMethod } from '@/types/database'

const STORAGE_KEY = 'popup-hub:vendor-apply-defaults'

export type VendorApplyDefaults = {
  paymentMethod: PaymentMethod | null
  termsAcknowledged: boolean
}

export const DEFAULT_VENDOR_APPLY_DEFAULTS: VendorApplyDefaults = {
  paymentMethod: null,
  termsAcknowledged: false,
}

export function readVendorApplyDefaults(userId: string): VendorApplyDefaults {
  if (typeof window === 'undefined') return DEFAULT_VENDOR_APPLY_DEFAULTS
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${userId}`)
    if (!raw) return DEFAULT_VENDOR_APPLY_DEFAULTS
    const parsed = JSON.parse(raw) as Partial<VendorApplyDefaults>
    return {
      paymentMethod: parsed.paymentMethod ?? null,
      termsAcknowledged: parsed.termsAcknowledged ?? false,
    }
  } catch {
    return DEFAULT_VENDOR_APPLY_DEFAULTS
  }
}

export function writeVendorApplyDefaults(userId: string, patch: Partial<VendorApplyDefaults>): void {
  if (typeof window === 'undefined') return
  const next = { ...readVendorApplyDefaults(userId), ...patch }
  window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(next))
}
