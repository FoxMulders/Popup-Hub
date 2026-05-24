'use client'

import { CreditCard, Landmark, Sparkles, Timer } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { formatCents } from '@/lib/square/client'
import type { PaymentMethod } from '@/types/database'
import { cn } from '@/lib/utils'

export interface VendorPaymentMethodSelectorProps {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  boothPriceCents: number
  platformFeeCents: number
  coordinatorEtransferEmail: string | null
  squareConnected?: boolean
  disabled?: boolean
  className?: string
}

const METHODS: Array<{
  id: PaymentMethod
  title: string
  icon: typeof CreditCard
}> = [
  { id: 'SQUARE', title: 'Pay with Card (Square)', icon: CreditCard },
  { id: 'ETRANSFER', title: 'Pay via E-Transfer', icon: Landmark },
]

export function VendorPaymentMethodSelector({
  value,
  onChange,
  boothPriceCents,
  platformFeeCents,
  coordinatorEtransferEmail,
  squareConnected = true,
  disabled = false,
  className,
}: VendorPaymentMethodSelectorProps) {
  const squareTotalCents = boothPriceCents + platformFeeCents
  const etransferTotalCents = boothPriceCents

  return (
    <fieldset className={cn('space-y-3', className)} disabled={disabled}>
      <legend className="sr-only">Choose payment method</legend>
      <Label className="text-sm font-medium text-foreground">Payment method</Label>

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Payment method"
      >
        {METHODS.map(({ id, title, icon: Icon }) => {
          const selected = value === id
          const squareDisabled = id === 'SQUARE' && !squareConnected

          return (
            <label
              key={id}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-all',
                'focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-2',
                selected
                  ? 'border-amber-500 bg-amber-50/80 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300',
                (disabled || squareDisabled) && id === 'SQUARE' && 'cursor-not-allowed opacity-60'
              )}
            >
              <input
                type="radio"
                name="vendor-payment-method"
                value={id}
                checked={selected}
                disabled={disabled || squareDisabled}
                onChange={() => onChange(id)}
                className="sr-only"
              />

              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    selected ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-600'
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
                  {id === 'SQUARE' ? (
                    <>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        3% convenience fee · instant approval after payment
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        Total {formatCents(squareTotalCents)}
                      </p>
                      {platformFeeCents > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Includes {formatCents(platformFeeCents)} processing fee
                        </p>
                      )}
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <Sparkles className="h-3 w-3" aria-hidden />
                        Instant booth confirmation
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        0% fees · pay the organizer directly
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        Total {formatCents(etransferTotalCents)}
                      </p>
                      {coordinatorEtransferEmail ? (
                        <p className="text-xs text-sky-900 break-all">
                          Send to:{' '}
                          <span className="font-medium">{coordinatorEtransferEmail}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-800">
                          Coordinator payment email will be included in your instructions.
                        </p>
                      )}
                      <p className="inline-flex items-start gap-1 rounded-md bg-orange-50 px-2 py-1.5 text-[11px] font-medium text-orange-900 leading-snug">
                        <Timer className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        Spot held 24 hours pending manual verification
                      </p>
                    </>
                  )}
                </div>
              </div>

              {selected && (
                <span
                  className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-amber-500"
                  aria-hidden
                />
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
