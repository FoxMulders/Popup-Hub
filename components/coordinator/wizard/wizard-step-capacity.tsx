'use client'

import { Settings2 } from 'lucide-react'
import { CategoryLimitEditor, type CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { MlmTierGuard } from '@/components/coordinator/mlm-tier-guard'
import { SmartPopulateBoothCaps } from '@/components/coordinator/smart-populate-booth-caps'
import { TableSizeSelector } from '@/components/coordinator/table-size-selector'
import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
import { cn } from '@/lib/utils'
import type { Category, VenueElement } from '@/types/database'

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
}: WizardStepCapacityProps) {
  const totalCaps = categoryLimits.reduce((sum, cl) => sum + (cl.maxSlots ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200/80 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-heading font-semibold uppercase tracking-wide text-forest flex items-center gap-2">
            <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
            Category caps &amp; booth fees
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Set how many vendors each category can hold and what they pay. Use smart populate to draft
            caps from your floor dimensions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!skipVenueLayout ? (
            <>
              <span className="rounded-md border border-stone-200 bg-canvas px-2.5 py-1 tabular-nums">
                Floor <strong className="text-foreground">{venueWidth}×{venueLength} ft</strong>
              </span>
              <span className="rounded-md border border-sage-200 bg-sage-50 px-2.5 py-1 tabular-nums">
                C<sub>max</sub> <strong className="text-foreground">{layoutCapacity}</strong>
              </span>
            </>
          ) : null}
          <span className="rounded-md border border-harvest-200 bg-harvest-50 px-2.5 py-1 tabular-nums">
            Total caps <strong className="text-foreground">{totalCaps || '—'}</strong>
          </span>
        </div>
      </div>

      {!skipVenueLayout ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
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
          <TableSizeSelector
            value={baselineTableLengthFt}
            onChange={onBaselineTableLengthChange}
            disabled={venueReadOnly}
            className="lg:w-[240px]"
          />
        </div>
      ) : (
        <p className="rounded-lg border border-stone-200 bg-canvas px-3 py-2 text-xs text-muted-foreground">
          Floor plan planning is off — set vendor category caps manually below.
        </p>
      )}

      {allowMlm ? (
        <MlmTierGuard
          globalMlmCap={globalMlmCap}
          onGlobalMlmCapChange={onGlobalMlmCapChange}
        />
      ) : null}

      <CategoryLimitEditor
        categories={categories}
        value={categoryLimits}
        onChange={onCategoryLimitsChange}
        allowMlm={allowMlm}
        globalMlmCap={globalMlmCap}
      />
    </div>
  )
}
