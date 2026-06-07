'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatCents } from '@/lib/square/client'

export interface MarketBoothPricingFieldsProps {
  boothPriceCents: number
  onBoothPriceCentsChange: (cents: number) => void
  multiTableDiscountPercent?: number
  onMultiTableDiscountPercentChange?: (percent: number) => void
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
}: MarketBoothPricingFieldsProps) {
  const [boothDollarsInput, setBoothDollarsInput] = useState(() =>
    formatDollarsInput(boothPriceCents)
  )
  const [discountInput, setDiscountInput] = useState(() =>
    multiTableDiscountPercent > 0 ? String(multiTableDiscountPercent) : ''
  )

  useEffect(() => {
    setBoothDollarsInput(formatDollarsInput(boothPriceCents))
  }, [boothPriceCents])

  useEffect(() => {
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
    <div className="wizard-glass-inset space-y-4 rounded-xl p-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-forest">Booth fee</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          One price per table for every vendor at this market. Use $0 for free booths.
        </p>
      </div>

      <div className={showMultiTable ? 'grid gap-4 sm:grid-cols-2' : 'max-w-xs'}>
        <div className="space-y-1.5">
          <Label htmlFor="market-booth-price">Booth / table price (CAD)</Label>
          <Input
            id="market-booth-price"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={boothDollarsInput}
            onChange={(e) => setBoothDollarsInput(e.target.value)}
            onBlur={() => commitBoothDollars(boothDollarsInput)}
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
              onBlur={() => commitDiscount(discountInput)}
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
