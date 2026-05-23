'use client'

import { Settings2 } from 'lucide-react'
import { CategoryLimitEditor, type CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { MlmTierGuard } from '@/components/coordinator/mlm-tier-guard'
import { SmartPopulateBoothCaps } from '@/components/coordinator/smart-populate-booth-caps'
import { TableSizeSelector } from '@/components/coordinator/table-size-selector'
import { countActiveMlmSlots } from '@/lib/categories/mlm-constraints'
import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
import { cn } from '@/lib/utils'
import {
  WIZARD_INFO_BOX,
  WIZARD_PANEL_INNER,
  WIZARD_STEP_TITLE,
} from '@/lib/wizard/wizard-panel-styles'
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
}: WizardStepCapacityProps) {
  const totalCaps = categoryLimits.reduce((sum, cl) => sum + (cl.maxSlots ?? 0), 0)
  const activeMlmSlots = countActiveMlmSlots(categoryLimits, categories)

  return (
    <div className={WIZARD_PANEL_INNER}>
      <h2 className={cn(WIZARD_STEP_TITLE, 'flex items-center gap-2')}>
        <Settings2 className="h-4 w-4" />
        Step 3 — Space Caps &amp; Math Specs
      </h2>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          <SmartPopulateBoothCaps
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
          {allowMlm ? (
            <MlmTierGuard
              globalMlmCap={globalMlmCap}
              onGlobalMlmCapChange={onGlobalMlmCapChange}
              activeMlmSlots={activeMlmSlots}
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
        <TableSizeSelector
          value={baselineTableLengthFt}
          onChange={onBaselineTableLengthChange}
          disabled={venueReadOnly}
        />
      </div>

      <p className={WIZARD_INFO_BOX}>
        Optimized capacity (C<sub>max</sub>): up to{' '}
        <span className="font-semibold text-foreground">{layoutCapacity}</span> vendor units on a{' '}
        {venueWidth} × {venueLength} ft floor. Category caps total:{' '}
        <span className="font-semibold">{totalCaps || '—'}</span>.
      </p>
    </div>
  )
}
