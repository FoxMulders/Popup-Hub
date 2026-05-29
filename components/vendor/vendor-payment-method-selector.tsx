'use client'

import { Banknote, CreditCard, Landmark, Sparkles, Timer } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { formatCents } from '@/lib/square/client'
import type { PaymentMethod } from '@/types/database'
import type { VendorCheckoutMethod } from '@/lib/payments/booth-payment-display'
import { resolvePreferredDigitalPaymentMethod } from '@/lib/applications/payment-fields'
import { cn } from '@/lib/utils'

export interface VendorPaymentMethodSelectorProps {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  boothPriceCents: number
  platformFeeCents: number
  coordinatorEtransferEmail: string | null
  offlinePaymentInstructions?: string | null
  paymentInstructions?: string | null
  enabledMethods: PaymentMethod[]
  vendorCheckoutMethods?: VendorCheckoutMethod[]
  disabled?: boolean
  className?: string
}

const CHECKOUT_META: Record<
  VendorCheckoutMethod,
  { title: string; icon: typeof CreditCard; description: string }
> = {
  credit_card: {
    title: 'Credit card',
    icon: CreditCard,
    description: 'Pay by card — instant confirmation after payment clears',
  },
  etransfer: {
    title: 'Interac e-Transfer',
    icon: Landmark,
    description: 'Pay the organizer directly by e-Transfer',
  },
  cash: {
    title: 'Cash',
    icon: Banknote,
    description: 'Pay the organizer in cash at load-in',
  },
}

function paymentMethodMatchesCheckout(
  paymentMethod: PaymentMethod,
  checkout: VendorCheckoutMethod,
  enabledMethods: PaymentMethod[]
): boolean {
  if (checkout === 'etransfer') return paymentMethod === 'ETRANSFER'
  if (checkout === 'cash') return paymentMethod === 'CASH'
  return paymentMethod === 'SQUARE' || paymentMethod === 'STRIPE'
}

export function VendorPaymentMethodSelector({
  value,
  onChange,
  boothPriceCents,
  platformFeeCents,
  coordinatorEtransferEmail,
  offlinePaymentInstructions,
  paymentInstructions,
  enabledMethods,
  vendorCheckoutMethods,
  disabled = false,
  className,
}: VendorPaymentMethodSelectorProps) {
  const instructions = paymentInstructions ?? offlinePaymentInstructions
  const checkoutMethods: VendorCheckoutMethod[] =
    vendorCheckoutMethods && vendorCheckoutMethods.length > 0
      ? vendorCheckoutMethods
      : buildCheckoutMethodsFromEnabled(enabledMethods)

  return (
    <fieldset className={cn('space-y-3', className)} disabled={disabled}>
      <legend className="sr-only">Choose payment method</legend>
      <Label className="text-sm font-medium text-foreground">Payment method</Label>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
        {checkoutMethods.map((id) => {
          const { title, icon: Icon, description } = CHECKOUT_META[id]
          const selected = paymentMethodMatchesCheckout(value, id, enabledMethods)
          const isDigital = id === 'credit_card'
          const displayTotal = isDigital ? boothPriceCents + platformFeeCents : boothPriceCents

          return (
            <label
              key={id}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-all',
                'focus-within:ring-2 focus-within:ring-harvest-500 focus-within:ring-offset-2',
                selected
                  ? 'border-harvest-500 bg-harvest-50/80 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <input
                type="radio"
                name="vendor-payment-method"
                value={id}
                checked={selected}
                disabled={disabled}
                onChange={() => {
                  if (id === 'credit_card') {
                    onChange(resolvePreferredDigitalPaymentMethod(enabledMethods))
                  } else if (id === 'etransfer') {
                    onChange('ETRANSFER')
                  } else {
                    onChange('CASH')
                  }
                }}
                className="sr-only"
              />

              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    selected ? 'bg-harvest-500 text-white' : 'bg-stone-100 text-stone-600'
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  <p className="text-sm font-semibold text-foreground">
                    Total {formatCents(displayTotal)}
                  </p>
                  {isDigital ? (
                    <p className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Instant booth confirmation
                    </p>
                  ) : id === 'etransfer' ? (
                    <>
                      {coordinatorEtransferEmail ? (
                        <p className="text-xs text-sky-900 break-all">
                          Send to:{' '}
                          <span className="font-medium">{coordinatorEtransferEmail}</span>
                        </p>
                      ) : null}
                      {instructions ? (
                        <p className="text-xs text-stone-700 whitespace-pre-wrap">{instructions}</p>
                      ) : null}
                      <p className="inline-flex items-start gap-1 rounded-md bg-terracotta-50 px-2 py-1.5 text-[11px] font-medium text-terracotta-800 leading-snug">
                        <Timer className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        Pending until coordinator marks you paid
                      </p>
                    </>
                  ) : (
                    <>
                      {instructions ? (
                        <p className="text-xs text-stone-700 whitespace-pre-wrap">{instructions}</p>
                      ) : (
                        <p className="text-xs text-harvest-700">
                          Coordinator payment instructions will be included after you apply.
                        </p>
                      )}
                      <p className="inline-flex items-start gap-1 rounded-md bg-stone-100 px-2 py-1.5 text-[11px] font-medium text-stone-800 leading-snug">
                        <Timer className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        Pending until coordinator marks you paid
                      </p>
                    </>
                  )}
                </div>
              </div>

              {selected ? (
                <span
                  className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-harvest-500"
                  aria-hidden
                />
              ) : null}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function buildCheckoutMethodsFromEnabled(enabled: PaymentMethod[]): VendorCheckoutMethod[] {
  const out: VendorCheckoutMethod[] = []
  if (enabled.some((m) => m === 'SQUARE' || m === 'STRIPE')) out.push('credit_card')
  if (enabled.includes('ETRANSFER')) out.push('etransfer')
  if (enabled.includes('CASH')) out.push('cash')
  return out.length > 0 ? out : ['credit_card']
}

