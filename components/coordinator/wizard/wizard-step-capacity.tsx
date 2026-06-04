'use client'

import { Calculator, Tags } from 'lucide-react'
import { CategoryLimitEditor, type CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { MlmTierGuard } from '@/components/coordinator/mlm-tier-guard'
import { SmartPopulateBoothCaps } from '@/components/coordinator/smart-populate-booth-caps'
import { TableSizeSelector } from '@/components/coordinator/table-size-selector'
import { WizardZone } from '@/components/coordinator/wizard/wizard-ui'
import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
import { WIZARD_DRAFT_BADGE } from '@/lib/wizard/wizard-panel-styles'
import type { Category, VenueElement } from '@/types/database'
import { MarketBoothPricingFields } from '@/components/coordinator/wizard/market-booth-pricing-fields'

export interface WizardStepCapacityProps {
  categories: Category[]
  allowMlm: boolean
  venueWidth: number
  venueLength: number
  venueReadOnly: boolean
  categoryLimits: CategoryLimit[]
  onCategoryLimitsChange: (limits: CategoryLimit[]) => void
  globalMlmCap: number
  onGlobalMlmCapChange: (cap: number) => void
  baselineTableLengthFt: LayoutBaselineTableLengthFt
  onBaselineTableLengthChange: (ft: LayoutBaselineTableLengthFt) => void
  layoutCapacity: number
  venueElements?: VenueElement[]
  entrance?: 'north' | 'south' | 'east' | 'west'
  skipVenueLayout?: boolean
  showMarketPricing?: boolean
  boothPriceCents?: number
  onBoothPriceCentsChange?: (cents: number) => void
  multiTableDiscountPercent?: number
  onMultiTableDiscountPercentChange?: (percent: number) => void
}

export function WizardStepCapacity({
  categories,
  allowMlm,
  venueWidth,
  venueLength,
  venueReadOnly,
  categoryLimits,
  onCategoryLimitsChange,
  globalMlmCap,
  onGlobalMlmCapChange,
  baselineTableLengthFt,
  onBaselineTableLengthChange,
  layoutCapacity,
  venueElements,
  entrance = 'south',
  skipVenueLayout = false,
  showMarketPricing = false,
  boothPriceCents = 0,
  onBoothPriceCentsChange,
  multiTableDiscountPercent = 0,
  onMultiTableDiscountPercentChange,
}: WizardStepCapacityProps) {
  const totalCaps = categoryLimits.reduce((sum, cl) => sum + (cl.maxSlots ?? 0), 0)

  return (
    <div className="wizard-step2-deck relative space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Step 2
          </p>
          <h2 className="font-heading text-[clamp(1.25rem,1.2vw+1rem,1.75rem)] font-bold tracking-tight text-forest">
            Capacity &amp; pricing
          </h2>
        </div>
        <span className={WIZARD_DRAFT_BADGE} aria-label="Event status">
          Draft
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {!skipVenueLayout ? (
          <WizardZone
            id="wizard-zone-capacity-floor"
            title="Floor capacity"
            subtitle="Table size and C_max from your venue — use smart populate to draft category caps."
          >
            <div className="wizard-step2-section1 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <span className="wizard-glass-inset rounded-md px-2.5 py-1 tabular-nums">
                Floor <strong className="text-foreground">{venueWidth}×{venueLength} ft</strong>
              </span>
              <span
                className="wizard-glass-inset rounded-md border-sage-200/80 px-2.5 py-1 tabular-nums"
                title="Accounts for walking aisles and emergency fire paths."
              >
                C<sub>max</sub> <strong className="text-foreground">{layoutCapacity}</strong>
              </span>
              <span className="wizard-glass-inset col-span-2 rounded-md border-harvest-200/80 px-2.5 py-1 tabular-nums sm:col-span-1">
                Total caps <strong className="text-foreground">{totalCaps || '—'}</strong>
              </span>
            </div>
            <section
              aria-label="Section 2: venue table standard"
              className="wizard-step2-section2-wrap wizard-glass-inset rounded-xl border-stone-200/80 bg-white/50 p-2.5"
            >
              <TableSizeSelector
                variant="inline"
                value={baselineTableLengthFt}
                onChange={(selection) => {
                  if (typeof selection === 'number') {
                    onBaselineTableLengthChange(selection)
                  }
                }}
                labelTitle="Venue standard size or vendor-permitted footprint."
              />
            </section>
            <SmartPopulateBoothCaps
              compact
              categories={categories}
              allowMlm={allowMlm}
              venueWidthFt={venueWidth}
              venueLengthFt={venueLength}
              onVenueWidthChange={() => {}}
              onVenueLengthChange={() => {}}
              existingLimits={categoryLimits}
              onPopulate={onCategoryLimitsChange}
              globalMlmCap={globalMlmCap}
              venueReadOnly={venueReadOnly}
              venueElements={venueElements}
              entrance={entrance}
              tableLengthFt={baselineTableLengthFt}
              onTableLengthChange={onBaselineTableLengthChange}
              hideTableSizeSelector
            />
          </WizardZone>
        ) : (
          <WizardZone
            id="wizard-zone-capacity-floor"
            title="Vendor caps"
            subtitle="Floor plan is off — set category limits manually in the panel on the right."
          >
            <p className="wizard-glass-inset px-3 py-2 text-xs text-muted-foreground">
              No CAD layout for this market. Caps you set here control how many vendors can apply per
              category.
            </p>
            <span className="wizard-glass-inset inline-flex rounded-md border-harvest-200/80 px-2.5 py-1 text-xs tabular-nums">
              Total caps <strong className="text-foreground">{totalCaps || '—'}</strong>
            </span>
          </WizardZone>
        )}

        {onBoothPriceCentsChange ? (
          <WizardZone
            id="wizard-zone-capacity-pricing"
            title="Booth fee"
            subtitle="One price per table for every vendor — $0 is allowed for free markets."
          >
            <MarketBoothPricingFields
              boothPriceCents={boothPriceCents}
              onBoothPriceCentsChange={onBoothPriceCentsChange}
              {...(showMarketPricing && onMultiTableDiscountPercentChange
                ? {
                    multiTableDiscountPercent,
                    onMultiTableDiscountPercentChange,
                  }
                : {})}
            />
          </WizardZone>
        ) : (
          <WizardZone
            id="wizard-zone-capacity-pricing"
            title="Quarter auction"
            subtitle="Booth fees are set per vendor during the live auction — no market-wide table price."
          >
            <p className="wizard-glass-inset px-3 py-2 text-xs text-muted-foreground">
              Skip booth pricing here and configure category caps for participating vendors.
            </p>
          </WizardZone>
        )}
      </div>

      <WizardZone
        id="wizard-zone-capacity-categories"
        title="Category limits"
        subtitle="How many booths each vendor type can hold — totals should stay at or below C_max when using a floor plan."
        variant="wide"
      >
        <div className="space-y-4">
          {allowMlm ? (
            <MlmTierGuard
              globalMlmCap={globalMlmCap}
              onGlobalMlmCapChange={onGlobalMlmCapChange}
            />
          ) : null}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tags className="h-3.5 w-3.5 shrink-0 text-forest" aria-hidden />
            <span>
              {categoryLimits.length} categor{categoryLimits.length === 1 ? 'y' : 'ies'} configured
              {totalCaps > 0 ? ` · ${totalCaps} total booth cap${totalCaps === 1 ? '' : 's'}` : ''}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <CategoryLimitEditor
            categories={categories}
            value={categoryLimits}
            onChange={onCategoryLimitsChange}
            allowMlm={allowMlm}
            globalMlmCap={globalMlmCap}
            unifiedBoothFeeCents={onBoothPriceCentsChange ? boothPriceCents : undefined}
          />
        </div>
      </WizardZone>

      {!skipVenueLayout && totalCaps > layoutCapacity && layoutCapacity > 0 ? (
        <p
          className="wizard-glass-inset flex items-start gap-2 rounded-xl border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950"
          role="status"
        >
          <Calculator className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Total caps ({totalCaps}) exceed structural C<sub>max</sub> ({layoutCapacity}). You can
            still proceed — the floor plan step will warn if placement runs out of room.
          </span>
        </p>
      ) : null}
    </div>
  )
}
