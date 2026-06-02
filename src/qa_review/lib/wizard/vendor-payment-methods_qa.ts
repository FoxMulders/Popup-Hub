import type { UnifiedEventPaymentFlags } from '@/lib/payments/event-payment-flags'

/** Wizard Step 1 multi-select payment method keys. */
export type VendorPaymentMethodKey = 'credit_card' | 'etransfer' | 'cash'

export const VENDOR_PAYMENT_METHOD_LABELS: Record<VendorPaymentMethodKey, string> = {
  credit_card: 'Credit card',
  etransfer: 'e-Transfer',
  cash: 'Cash',
}

export const ALL_VENDOR_PAYMENT_METHODS: VendorPaymentMethodKey[] = [
  'credit_card',
  'etransfer',
  'cash',
]

export function paymentMethodsFromFlags(
  flags: UnifiedEventPaymentFlags
): VendorPaymentMethodKey[] {
  const methods: VendorPaymentMethodKey[] = []
  if (flags.accepts_credit_card) methods.push('credit_card')
  if (flags.accepts_etransfer) methods.push('etransfer')
  if (flags.accepts_cash) methods.push('cash')
  return methods
}

export function flagsFromPaymentMethods(
  methods: ReadonlyArray<VendorPaymentMethodKey>
): UnifiedEventPaymentFlags {
  return {
    accepts_credit_card: methods.includes('credit_card'),
    accepts_etransfer: methods.includes('etransfer'),
    accepts_cash: methods.includes('cash'),
  }
}

export function togglePaymentMethod(
  methods: ReadonlyArray<VendorPaymentMethodKey>,
  key: VendorPaymentMethodKey,
  enabled: boolean
): VendorPaymentMethodKey[] {
  const set = new Set(methods)
  if (enabled) {
    set.add(key)
  } else {
    set.delete(key)
  }
  return ALL_VENDOR_PAYMENT_METHODS.filter((m) => set.has(m))
}
