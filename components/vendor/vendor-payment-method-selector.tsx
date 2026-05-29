'use client'

import { Banknote, CreditCard, Landmark, Sparkles, Timer } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { formatCents } from '@/lib/square/client'
import type { PaymentMethod } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/lib/applications/payment-fields'
import { cn } from '@/lib/utils'

export interface VendorPaymentMethodSelectorProps {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  boothPriceCents: number
  platformFeeCents: number
  coordinatorEtransferEmail: string | null
  offlinePaymentInstructions?: string | null
  enabledMethods: PaymentMethod[]
  disabled?: boolean
  className?: string
}

const METHOD_META: Record<
  PaymentMethod,
  { title: string; icon: typeof CreditCard; description: string }
> = {
  SQUARE: {
    title: PAYMENT_METHOD_LABELS.SQUARE,
    icon: CreditCard,
    description: 'Instant approval after payment',
  },
  STRIPE: {
    title: PAYMENT_METHOD_LABELS.STRIPE,
    icon: CreditCard,
    description: 'Pay by card via Stripe',
  },
  ETRANSFER: {
    title: PAYMENT_METHOD_LABELS.ETRANSFER,
    icon: Landmark,
    description: 'Pay the organizer directly by Interac e-Transfer',
  },
  CASH: {
    title: PAYMENT_METHOD_LABELS.CASH,
    icon: Banknote,
    description: 'Pay the organizer in cash at load-in',
  },
}

export function VendorPaymentMethodSelector({
  value,
  onChange,
  boothPriceCents,
  platformFeeCents,
  coordinatorEtransferEmail,
  offlinePaymentInstructions,
  enabledMethods,
  disabled = false,
  className,
}: VendorPaymentMethodSelectorProps) {
  const methods = enabledMethods.length > 0 ? enabledMethods : (['SQUARE'] as PaymentMethod[])

  return (
    <fieldset className={cn('space-y-3', className)} disabled={disabled}>
      <legend className="sr-only">Choose payment method</legend>
      <Label className="text-sm font-medium text-foreground">Payment method</Label>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
        {methods.map((id) => {
          const { title, icon: Icon, description } = METHOD_META[id]
          const selected = value === id
          const isDigital = id === 'SQUARE' || id === 'STRIPE'
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
                onChange={() => onChange(id)}
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
                  ) : id === 'ETRANSFER' ? (
                    <>
                      {coordinatorEtransferEmail ? (
                        <p className="text-xs text-sky-900 break-all">
                          Send to:{' '}
                          <span className="font-medium">{coordinatorEtransferEmail}</span>
                        </p>
                      ) : null}
                      <p className="inline-flex items-start gap-1 rounded-md bg-terracotta-50 px-2 py-1.5 text-[11px] font-medium text-terracotta-800 leading-snug">
                        <Timer className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        Spot held 24 hours pending manual verification
                      </p>
                    </>
                  ) : (
                    <>
                      {offlinePaymentInstructions ? (
                        <p className="text-xs text-stone-700 whitespace-pre-wrap">
                          {offlinePaymentInstructions}
                        </p>
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
