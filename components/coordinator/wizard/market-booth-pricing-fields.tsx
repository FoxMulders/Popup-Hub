'use client'

import { useEffect, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatCents } from '@/lib/square/client'

export interface MarketBoothPricingFieldsProps {
  boothPriceCents: number
  onBoothPriceCentsChange: (cents: number) => void
  multiTableDiscountPercent?: number
  onMultiTableDiscountPercentChange?: (percent: number) => void
  /** Omit section heading when parent already labels the block. */
  compact?: boolean
}

function formatDollarsInput(cents: number): string {
  if (cents <= 0) return ''
  return (cents / 100).toFixed(2)
}

/**
 * Event-wide booth/table fee — one price for every vendor category.
 */
export function MarketBoothPricingFields({
  boothPriceCents,
  onBoothPriceCentsChange,
  multiTableDiscountPercent = 0,
  onMultiTableDiscountPercentChange,
  compact = false,
}: MarketBoothPricingFieldsProps) {
  const [boothDollarsInput, setBoothDollarsInput] = useState(() =>
    formatDollarsInput(boothPriceCents)
  )
  const [discountInput, setDiscountInput] = useState(() =>
    multiTableDiscountPercent > 0 ? String(multiTableDiscountPercent) : ''
  )
  const boothFocusedRef = useRef(false)
  const discountFocusedRef = useRef(false)

  useEffect(() => {
    if (boothFocusedRef.current) return
    setBoothDollarsInput(formatDollarsInput(boothPriceCents))
  }, [boothPriceCents])

  useEffect(() => {
    if (discountFocusedRef.current) return
    setDiscountInput(multiTableDiscountPercent > 0 ? String(multiTableDiscountPercent) : '')
  }, [multiTableDiscountPercent])

  const showMultiTable =
    onMultiTableDiscountPercentChange != null &&
    multiTableDiscountPercent !== undefined

  function commitBoothDollars(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === '') {
      onBoothPriceCentsChange(0)
      return
    }
    const dollars = Number.parseFloat(trimmed)
    onBoothPriceCentsChange(
      Math.max(0, Math.round((Number.isFinite(dollars) ? dollars : 0) * 100))
    )
  }

  function commitDiscount(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === '') {
      onMultiTableDiscountPercentChange!(0)
      return
    }
    const pct = Number.parseInt(trimmed, 10)
    onMultiTableDiscountPercentChange!(
      Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0))
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'wizard-glass-inset space-y-4 rounded-xl p-4'}>
      {!compact ? (
        <div>
          <h3 className="text-sm font-heading font-semibold text-forest">Booth fee</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            One price per table for every vendor at this market. Use $0 for free booths.
          </p>
        </div>
      ) : null}

      <div
        className={
          showMultiTable
            ? 'grid gap-3 sm:grid-cols-2 sm:items-start'
            : compact
              ? 'max-w-xs'
              : 'max-w-xs'
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="market-booth-price">Booth / table price (CAD)</Label>
          <Input
            id="market-booth-price"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={boothDollarsInput}
            onChange={(e) => setBoothDollarsInput(e.target.value)}
            onFocus={() => {
              boothFocusedRef.current = true
            }}
            onBlur={() => {
              boothFocusedRef.current = false
              commitBoothDollars(boothDollarsInput)
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            {boothPriceCents > 0
              ? `All vendors pay ${formatCents(boothPriceCents)} per table.`
              : 'Free market — vendors are not charged a booth fee.'}
          </p>
        </div>

        {showMultiTable ? (
          <div className="space-y-1.5">
            <Label htmlFor="market-multi-table-discount">Multi-table discount (%)</Label>
            <Input
              id="market-multi-table-discount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              onFocus={() => {
                discountFocusedRef.current = true
              }}
              onBlur={() => {
                discountFocusedRef.current = false
                commitDiscount(discountInput)
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              {multiTableDiscountPercent > 0
                ? `${multiTableDiscountPercent}% off the total when a vendor books 2+ tables.`
                : 'No multi-table discount.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
