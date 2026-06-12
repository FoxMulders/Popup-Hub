'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CreditCard, Banknote, Landmark, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import type { UnifiedEventPaymentFlags } from '@/lib/payments/event-payment-flags'

type PaymentSettingsResponse = {
  paymentInstructions: string | null
  squareConnected: boolean
  stripeConnected: boolean
  defaultEventPaymentFlags: UnifiedEventPaymentFlags
}

const DEFAULT_WIZARD_PAYMENT_FLAGS: UnifiedEventPaymentFlags = {
  accepts_credit_card: true,
  accepts_etransfer: false,
  accepts_cash: false,
}

function PaymentMethodChip({
  id,
  label,
  icon: Icon,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  icon: typeof CreditCard
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'wizard-payment-chip flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors duration-150',
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-600 focus-within:ring-offset-2',
        checked
          ? 'border-sky-400/80 bg-sky-50/90 text-sky-950 shadow-[0_0_14px_rgb(56_189_248/0.12)]'
          : 'border-stone-200/80 bg-white/50 text-stone-700 hover:border-stone-300',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </label>
  )
}

export function WizardPaymentPreviewStrip() {
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState<UnifiedEventPaymentFlags>({ ...DEFAULT_WIZARD_PAYMENT_FLAGS })
  const [instructions, setInstructions] = useState('')
  const [squareConnected, setSquareConnected] = useState(false)
  const [stripeConnected, setStripeConnected] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(
    (nextFlags: UnifiedEventPaymentFlags, nextInstructions: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch('/api/coordinator/payment-settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              defaultEventPaymentFlags: nextFlags,
              paymentInstructions: nextInstructions.trim() || null,
            }),
          })
        } catch {
          /* silent — coordinator can fix on payment methods page */
        }
      }, 600)
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/coordinator/payment-settings')
        if (!res.ok) return
        const data = (await res.json()) as PaymentSettingsResponse
        if (cancelled) return
        setFlags({
          ...DEFAULT_WIZARD_PAYMENT_FLAGS,
          ...(data.defaultEventPaymentFlags ?? {}),
        })
        setInstructions(data.paymentInstructions ?? '')
        setSquareConnected(data.squareConnected)
        setStripeConnected(data.stripeConnected)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function updateFlags(patch: Partial<UnifiedEventPaymentFlags>) {
    const next = { ...flags, ...patch }
    setFlags(next)
    persist(next, instructions)
  }

  function updateInstructions(text: string) {
    setInstructions(text)
    persist(flags, text)
  }

  const cardDisabled = !squareConnected && !stripeConnected
  const showOfflineFields = flags.accepts_etransfer || flags.accepts_cash

  return (
    <div className="space-y-3" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">How vendors can pay</p>
        <Link
          href="/coordinator/payment-methods"
          className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-sky-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Configure
        </Link>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Payment methods enabled for your markets"
      >
        <PaymentMethodChip
          id="wizard-pay-card"
          label="Credit card"
          icon={CreditCard}
          checked={flags.accepts_credit_card}
          disabled={loading || (cardDisabled && !flags.accepts_credit_card)}
          onChange={(v) => updateFlags({ accepts_credit_card: v })}
        />
        <PaymentMethodChip
          id="wizard-pay-etransfer"
          label="e-Transfer"
          icon={Landmark}
          checked={flags.accepts_etransfer}
          disabled={loading}
          onChange={(v) => updateFlags({ accepts_etransfer: v })}
        />
        <PaymentMethodChip
          id="wizard-pay-cash"
          label="Cash"
          icon={Banknote}
          checked={flags.accepts_cash}
          disabled={loading}
          onChange={(v) => updateFlags({ accepts_cash: v })}
        />
      </div>
      {cardDisabled && flags.accepts_credit_card ? (
        <p className="text-[0.75rem] text-harvest-700">
          Connect Square or Stripe on Payment Methods to accept card checkout.
        </p>
      ) : (
        <p className="text-[0.75rem] text-muted-foreground">
          Card uses your connected processor. Offline fees are billed to your platform balance
          when you mark booths paid.
        </p>
      )}
      {showOfflineFields ? (
        <div className="space-y-1.5">
          <label htmlFor="wizard-payment-instructions" className="wizard-field-label">
            Offline payment instructions
          </label>
          <Textarea
            id="wizard-payment-instructions"
            value={instructions}
            onChange={(e) => updateInstructions(e.target.value)}
            rows={2}
            placeholder="e.g. Send e-Transfer to info@yourmarket.ca — include booth # in the memo"
            className="min-h-[4rem] resize-y bg-white/70 text-sm"
          />
        </div>
      ) : null}
    </div>
  )
}
