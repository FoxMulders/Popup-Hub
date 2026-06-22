'use client'

import { useState } from 'react'
import { Calculator, Sparkles, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CategoryLimitEditor, type CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { MlmTierGuard } from '@/components/coordinator/mlm-tier-guard'
import { SmartPopulateBoothCaps } from '@/components/coordinator/smart-populate-booth-caps'
import { WizardZone } from '@/components/coordinator/wizard/wizard-ui'
import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
import { WIZARD_DRAFT_BADGE, WIZARD_INFO_BOX } from '@/lib/wizard/wizard-panel-styles'
import {
  buildQuarterAuctionVendorPreset,
  distributeQuarterAuctionTotalSpots,
} from '@/lib/wizard/quarter-auction-vendor-presets'
import type { Category, VenueElement } from '@/types/database'
import { MarketBoothPricingFields } from '@/components/coordinator/wizard/market-booth-pricing-fields'
import { toast } from 'sonner'

export interface WizardStepCapacityProps {
  categories: Category[]
  allowMlm: boolean
  venueWidth: number
  venueLength: number
  venueReadOnly: boolean
  venueManualEntry?: boolean
  onVenueManualEntryChange?: (manual: boolean) => void
  onVenueWidthChange?: (width: number) => void
  onVenueLengthChange?: (length: number) => void
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
  isQuarterAuction?: boolean
  showMarketPricing?: boolean
  boothPriceCents?: number
  onBoothPriceCentsChange?: (cents: number) => void
  multiTableDiscountPercent?: number
  onMultiTableDiscountPercentChange?: (percent: number) => void
  communityLeagueDiscountEnabled?: boolean
  onCommunityLeagueDiscountEnabledChange?: (enabled: boolean) => void
  communityLeagueDiscountPercent?: number
  onCommunityLeagueDiscountPercentChange?: (percent: number) => void
  suggestCommunityLeagueDiscount?: boolean
  venueSubmissionPending?: boolean
}

export function WizardStepCapacity({
  categories,
  allowMlm,
  venueWidth,
  venueLength,
  venueReadOnly,
  venueManualEntry,
  onVenueManualEntryChange,
  onVenueWidthChange,
  onVenueLengthChange,
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
  isQuarterAuction = false,
  showMarketPricing = false,
  boothPriceCents = 0,
  onBoothPriceCentsChange,
  multiTableDiscountPercent = 0,
  onMultiTableDiscountPercentChange,
  communityLeagueDiscountEnabled = false,
  onCommunityLeagueDiscountEnabledChange,
  communityLeagueDiscountPercent = 0,
  onCommunityLeagueDiscountPercentChange,
  suggestCommunityLeagueDiscount = false,
  venueSubmissionPending = false,
}: WizardStepCapacityProps) {
  const [totalSpotsInput, setTotalSpotsInput] = useState('')

  const totalCaps = categoryLimits.reduce((sum, cl) => sum + (cl.maxSlots ?? 0), 0)

  function applyCommonVendorTypes() {
    const preset = buildQuarterAuctionVendorPreset(categories, allowMlm)
    if (preset.length === 0) {
      toast.error('No broad vendor categories available to add')
      return
    }
    onCategoryLimitsChange(preset)
    toast.success(`Added ${preset.length} common vendor types`)
  }

  function applyTotalSpots() {
    const total = parseInt(totalSpotsInput, 10)
    if (!total || total < 1) {
      toast.error('Enter a total vendor spot count of at least 1')
      return
    }
    const distributed = distributeQuarterAuctionTotalSpots(categories, total, allowMlm)
    if (distributed.length === 0) {
      toast.error('No broad vendor categories available to distribute spots')
      return
    }
    onCategoryLimitsChange(distributed)
    toast.success(`Set ${total} vendor spots across ${distributed.length} categories`)
  }

  if (isQuarterAuction) {
    return (
      <div className="wizard-step2-deck relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Step 2
            </p>
            <h2 className="font-heading text-[clamp(1.25rem,1.2vw+1rem,1.75rem)] font-bold tracking-tight text-forest">
              Vendor spots
            </h2>
          </div>
          <span className={WIZARD_DRAFT_BADGE} aria-label="Event status">
            Draft
          </span>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <WizardZone
            id="wizard-zone-capacity-categories"
            title="Who can sell tonight"
            subtitle="How many vendors can apply in each category. You’ll set the bid amount per item later — when each vendor is on stage."
            className="mx-auto w-full max-w-4xl"
          >
            <p className={WIZARD_INFO_BOX}>
              Quarter auctions don’t use a floor plan. Set how many donation tables or vendor spots
              you can accept per category, then approve vendors and build the catalog on the next
              screen.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={applyCommonVendorTypes}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Add common vendor types
              </Button>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="qa-total-spots" className="text-xs">
                    Or set total vendor spots
                  </Label>
                  <Input
                    id="qa-total-spots"
                    type="number"
                    min={1}
                    placeholder="e.g. 40"
                    value={totalSpotsInput}
                    onChange={(e) => setTotalSpotsInput(e.target.value)}
                    className="h-9 w-28"
                  />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={applyTotalSpots}>
                  Distribute
                </Button>
              </div>
            </div>

            <span className="wizard-glass-inset inline-flex rounded-md border-harvest-200/80 px-2.5 py-1 text-xs tabular-nums">
              Total spots <strong className="text-foreground">{totalCaps || '—'}</strong>
            </span>

            <div className="space-y-3 border-t border-stone-200/80 pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Tags className="h-3.5 w-3.5 shrink-0 text-forest" aria-hidden />
                <span>
                  {categoryLimits.length} vendor type{categoryLimits.length === 1 ? '' : 's'}{' '}
                  configured
                  {totalCaps > 0
                    ? ` · ${totalCaps} total spot${totalCaps === 1 ? '' : 's'}`
                    : ''}
                </span>
              </div>
              <div className="min-w-0">
                <CategoryLimitEditor
                  categories={categories}
                  value={categoryLimits}
                  onChange={onCategoryLimitsChange}
                  allowMlm={allowMlm}
                  globalMlmCap={globalMlmCap}
                  grouped
                  variant="quarter_auction"
                />
              </div>
            </div>
          </WizardZone>
        </div>
      </div>
    )
  }

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

      <div className="flex w-full flex-col items-center gap-4">
        <WizardZone
          id="wizard-zone-capacity-floor"
          title="Physical &amp; pricing setup"
          subtitle="Floor dimensions, booth capacity, and market-wide table pricing."
          className="mx-auto w-full max-w-4xl"
        >
          {!skipVenueLayout ? (
            <>
              <div className="wizard-step2-section1 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <span className="wizard-glass-inset rounded-md px-2.5 py-1 tabular-nums">
                  Floor <strong className="text-foreground">{venueWidth}×{venueLength} ft</strong>
                </span>
                <span
                  className="wizard-glass-inset rounded-md border-sage-200/80 px-2.5 py-1 tabular-nums"
                  title="Accounts for walking aisles and emergency fire paths."
                >
                  Max booths <strong className="text-foreground">{layoutCapacity}</strong>
                </span>
                <span className="wizard-glass-inset col-span-2 rounded-md border-harvest-200/80 px-2.5 py-1 tabular-nums sm:col-span-1">
                  Total caps <strong className="text-foreground">{totalCaps || '—'}</strong>
                </span>
              </div>
            </>
          ) : (
            <p className="wizard-glass-inset px-3 py-2 text-xs text-muted-foreground">
              No CAD layout for this market. Caps you set here control how many vendors can apply per
              category.
            </p>
          )}

          {venueSubmissionPending ? (
            <p className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              This venue was submitted for admin review. You can save drafts, but publishing stays
              blocked until it is approved.
            </p>
          ) : null}

          <div id="wizard-zone-capacity-pricing" className="scroll-mt-24">
            {onBoothPriceCentsChange ? (
              <MarketBoothPricingFields
                compact
                boothPriceCents={boothPriceCents}
                onBoothPriceCentsChange={onBoothPriceCentsChange}
                {...(showMarketPricing && onMultiTableDiscountPercentChange
                  ? {
                      multiTableDiscountPercent,
                      onMultiTableDiscountPercentChange,
                    }
                  : {})}
                {...(showMarketPricing && onCommunityLeagueDiscountEnabledChange
                  ? {
                      communityLeagueDiscountEnabled,
                      onCommunityLeagueDiscountEnabledChange,
                      communityLeagueDiscountPercent,
                      onCommunityLeagueDiscountPercentChange,
                      suggestCommunityLeagueDiscount,
                    }
                  : {})}
              />
            ) : null}
          </div>
        </WizardZone>

        <WizardZone
          id="wizard-zone-capacity-categories"
          title="Inventory &amp; category limits"
          subtitle="Apply suggested caps from your floor, then assign booth limits by vendor type."
          className="mx-auto w-full max-w-4xl"
        >
          {!skipVenueLayout ? (
            <SmartPopulateBoothCaps
              compact
              categories={categories}
              allowMlm={allowMlm}
              venueWidthFt={venueWidth}
              venueLengthFt={venueLength}
              onVenueWidthChange={onVenueWidthChange}
              onVenueLengthChange={onVenueLengthChange}
              existingLimits={categoryLimits}
              onPopulate={onCategoryLimitsChange}
              globalMlmCap={globalMlmCap}
              venueReadOnly={venueReadOnly}
              venueManualEntry={venueManualEntry}
              onVenueManualEntryChange={onVenueManualEntryChange}
              venueElements={venueElements}
              entrance={entrance}
              tableLengthFt={baselineTableLengthFt}
              onTableLengthChange={onBaselineTableLengthChange}
              hideTableSizeSelector
            />
          ) : (
            <span className="wizard-glass-inset inline-flex rounded-md border-harvest-200/80 px-2.5 py-1 text-xs tabular-nums">
              Total caps <strong className="text-foreground">{totalCaps || '—'}</strong>
            </span>
          )}

          <div className="space-y-3 border-t border-stone-200/80 pt-4">
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
            <div className="min-w-0">
              <CategoryLimitEditor
                categories={categories}
                value={categoryLimits}
                onChange={onCategoryLimitsChange}
                allowMlm={allowMlm}
                globalMlmCap={globalMlmCap}
                unifiedBoothFeeCents={onBoothPriceCentsChange ? boothPriceCents : undefined}
                maxTotalSlots={skipVenueLayout ? undefined : layoutCapacity > 0 ? layoutCapacity : undefined}
                grouped
              />
            </div>
          </div>
        </WizardZone>
      </div>

      {!skipVenueLayout && totalCaps > layoutCapacity && layoutCapacity > 0 ? (
        <p
          className="wizard-glass-inset flex items-start gap-2 rounded-xl border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950"
          role="status"
        >
          <Calculator className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Total caps ({totalCaps}) exceed the max booths your floor can hold ({layoutCapacity}). You
            can still proceed — the floor plan step will warn if placement runs out of room.
          </span>
        </p>
      ) : null}
    </div>
  )
}
