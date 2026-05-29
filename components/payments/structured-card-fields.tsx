'use client'

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Single-form snapshot of an entered payment card. Persisted only in
 * client-side state — never sent to our servers without first being
 * tokenized by the secure Square iframe rendered alongside.
 *
 * The four fields match the spec:
 *   - cardNumber  → card PAN, max 16 digits, auto-spaced into 4×4 chunks
 *   - expiry      → MM/YY (5 chars including the slash)
 *   - cvc         → 3–4 digit security code, masked input (type="password")
 *   - postal      → ZIP / postal, free-form text
 */
export interface StructuredCardValue {
  cardNumber: string
  expiry: string
  cvc: string
  postal: string
}

export const EMPTY_STRUCTURED_CARD: StructuredCardValue = {
  cardNumber: '',
  expiry: '',
  cvc: '',
  postal: '',
}

interface StructuredCardFieldsProps {
  value: StructuredCardValue
  onChange: (next: StructuredCardValue) => void
  disabled?: boolean
  className?: string
}

/** Strip everything but digits — used by both card and expiry filters. */
function digitsOnly(input: string): string {
  return input.replace(/[^0-9]/g, '')
}

/** Insert a space after every 4 digits; visual-only, never persisted with spaces. */
export function formatCardNumber(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

/** Auto-insert the slash after the month. Caps at MM/YY (5 chars). */
export function formatExpiry(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/**
 * Renders the four-field card-input grid. Pure presentational —
 * tokenization flows through the secure Square iframe rendered as a
 * sibling. We deliberately keep these as native HTML inputs so
 * autofill, accessibility tools, and password managers all work the
 * way buyers expect.
 *
 * Layout breakdown:
 *   [ Card Number (full width) ]
 *   [ Expiry ] [ CVC ] [ Postal ]
 */
export function StructuredCardFields({
  value,
  onChange,
  disabled = false,
  className,
}: StructuredCardFieldsProps) {
  const idPrefix = useId().replace(/:/g, '')
  const cardId = `${idPrefix}-card`
  const expId = `${idPrefix}-exp`
  const cvcId = `${idPrefix}-cvc`
  const postalId = `${idPrefix}-postal`

  function patch(next: Partial<StructuredCardValue>) {
    onChange({ ...value, ...next })
  }

  return (
    <fieldset
      className={cn('grid grid-cols-6 gap-3', className)}
      disabled={disabled}
    >
      <legend className="sr-only">Payment card details</legend>

      <div className="col-span-6 space-y-1">
        <Label htmlFor={cardId} className="text-xs font-medium">
          Card Number
        </Label>
        <Input
          id={cardId}
          name="cc-number"
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          /*
           * maxLength counts the visual chunks (16 digits + 3 spaces);
           * the underlying value persisted in state stays digit-only so
           * downstream tokenizers don't have to strip whitespace.
           */
          maxLength={19}
          value={formatCardNumber(value.cardNumber)}
          onChange={(e) => patch({ cardNumber: digitsOnly(e.target.value).slice(0, 16) })}
          className="font-mono tracking-wider"
        />
      </div>

      <div className="col-span-2 space-y-1">
        <Label htmlFor={expId} className="text-xs font-medium">
          Expiry
        </Label>
        <Input
          id={expId}
          name="cc-exp"
          type="text"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/YY"
          maxLength={5}
          value={formatExpiry(value.expiry)}
          onChange={(e) => patch({ expiry: digitsOnly(e.target.value).slice(0, 4) })}
          className="font-mono text-center tracking-widest"
        />
      </div>

      <div className="col-span-2 space-y-1">
        <Label htmlFor={cvcId} className="text-xs font-medium">
          CVC
        </Label>
        <Input
          id={cvcId}
          name="cc-csc"
          /*
           * type="password" matches the spec — masks the security code
           * the way every major bank app does, and signals to password
           * managers + screen readers that this is sensitive.
           */
          type="password"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="•••"
          maxLength={4}
          value={value.cvc}
          onChange={(e) => patch({ cvc: digitsOnly(e.target.value).slice(0, 4) })}
          className="font-mono text-center tracking-widest"
        />
      </div>

      <div className="col-span-2 space-y-1">
        <Label htmlFor={postalId} className="text-xs font-medium">
          Postal / ZIP
        </Label>
        <Input
          id={postalId}
          name="postal-code"
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          placeholder="A1B 2C3"
          maxLength={10}
          value={value.postal}
          onChange={(e) => patch({ postal: e.target.value })}
          className="uppercase"
        />
      </div>
    </fieldset>
  )
}

/**
 * Lightweight client-side validity check used by callers (e.g. a
 * Pay-button enable gate). Pure — no network or DOM access — so it's
 * trivially unit-testable.
 */
export function isStructuredCardValid(value: StructuredCardValue): boolean {
  if (digitsOnly(value.cardNumber).length < 13) return false
  const expDigits = digitsOnly(value.expiry)
  if (expDigits.length !== 4) return false
  const month = parseInt(expDigits.slice(0, 2), 10)
  if (!(month >= 1 && month <= 12)) return false
  if (digitsOnly(value.cvc).length < 3) return false
  if (value.postal.trim().length < 3) return false
  return true
}
