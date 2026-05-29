'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatCents } from '@/lib/square/client'

export interface MarketBoothPricingFieldsProps {
  boothPriceCents: number
  onBoothPriceCentsChange: (cents: number) => void
  multiTableDiscountPercent?: number
  onMultiTableDiscountPercentChange?: (percent: number) => void
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
  const boothDollars = (boothPriceCents / 100).toFixed(2)
  const showMultiTable =
    onMultiTableDiscountPercentChange != null &&
    multiTableDiscountPercent !== undefined

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
            type="number"
            min={0}
            step={0.01}
            value={boothDollars}
            onChange={(e) => {
              const dollars = Number.parseFloat(e.target.value)
              onBoothPriceCentsChange(
                Math.max(0, Math.round((Number.isFinite(dollars) ? dollars : 0) * 100))
              )
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
              type="number"
              min={0}
              max={100}
              step={1}
              value={multiTableDiscountPercent}
              onChange={(e) => {
                const pct = Number.parseInt(e.target.value, 10)
                onMultiTableDiscountPercentChange!(
                  Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0))
                )
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
