'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import {
  applyDirectSalesBoothCount,
  applyMlmLimitRules,
  hasPerBrandDirectSalesLimits,
  readDirectSalesBoothCount,
} from '@/lib/categories/mlm-constraints'

const PRESET_COUNTS = [0, 1, 2, 3] as const

interface DirectSalesCapacityCardProps {
  allowMlm: boolean
  categories: Category[]
  categoryLimits: CategoryLimit[]
  onCategoryLimitsChange: (limits: CategoryLimit[]) => void
  globalMlmCap: number
  onGlobalMlmCapChange: (cap: number) => void
  unifiedBoothFeeCents?: number
  onOpenVendorRules?: () => void
}

function DirectSalesApprovalCap({
  globalMlmCap,
  onGlobalMlmCapChange,
}: {
  globalMlmCap: number
  onGlobalMlmCapChange: (cap: number) => void
}) {
  return (
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 border-t border-stone-200/80 pt-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)]">
      <label htmlFor="global-direct-sales-cap" className="text-xs font-semibold uppercase tracking-wide">
        Max direct sales to approve
      </label>
      <input
        id="global-direct-sales-cap"
        type="number"
        min={0}
        max={50}
        value={globalMlmCap}
        onChange={(e) => onGlobalMlmCapChange(Math.max(0, Number(e.target.value) || 0))}
        className="h-9 w-full rounded-lg border-2 border-stone-200 bg-card px-2 text-center text-sm font-semibold tabular-nums focus:border-harvest-500 focus:outline-none"
      />
      <span className="col-span-2 text-xs text-muted-foreground sm:col-span-1">
        Enforced when you approve vendors — applicants beyond this stay pending until a slot opens.
      </span>
    </div>
  )
}

export function DirectSalesCapacityCard({
  allowMlm,
  categories,
  categoryLimits,
  onCategoryLimitsChange,
  globalMlmCap,
  onGlobalMlmCapChange,
  unifiedBoothFeeCents = 0,
  onOpenVendorRules,
}: DirectSalesCapacityCardProps) {
  const boothCount = readDirectSalesBoothCount(categoryLimits, categories)
  const hasPerBrandCaps = hasPerBrandDirectSalesLimits(categoryLimits, categories)

  function applyBoothCount(count: number) {
    const nextCount = Math.max(0, Math.min(50, Math.round(count)))
    const withBroad = applyDirectSalesBoothCount(
      categoryLimits,
      categories,
      nextCount,
      unifiedBoothFeeCents
    )
    const withRules = applyMlmLimitRules(withBroad, categories, nextCount)
    onCategoryLimitsChange(withRules)
    if (!hasPerBrandCaps) {
      onGlobalMlmCapChange(nextCount)
    }
  }

  if (!allowMlm) {
    return (
      <div className="rounded-xl border border-stone-200 bg-muted/40 px-4 py-3">
        <h4 className="text-sm font-semibold text-foreground">Direct sales booths</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Direct sales vendors are turned off for this market.
        </p>
        {onOpenVendorRules ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mt-2 h-auto p-0 text-xs"
            onClick={onOpenVendorRules}
          >
            Change in Vendor rules
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-harvest-50/40 px-4 py-3">
      <h4 className="text-sm font-semibold text-foreground">Direct sales booths</h4>
      <p className="mt-1 text-xs text-muted-foreground whitespace-normal break-words">
        Catalog and party-plan vendors (e.g. Scentsy, doTERRA). Set how many can have a booth —
        any brand counts toward this total.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PRESET_COUNTS.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={boothCount === preset ? 'default' : 'outline'}
            className={cn('h-8 min-w-[2.25rem] tabular-nums', boothCount === preset && 'pointer-events-none')}
            onClick={() => applyBoothCount(preset)}
            aria-pressed={boothCount === preset}
          >
            {preset}
          </Button>
        ))}
        <div className="flex items-center gap-1.5">
          <label htmlFor="direct-sales-booth-count" className="sr-only">
            Direct sales booth count
          </label>
          <Input
            id="direct-sales-booth-count"
            type="number"
            min={0}
            max={50}
            value={boothCount}
            onChange={(e) => applyBoothCount(Number(e.target.value) || 0)}
            className="h-8 w-16 text-center tabular-nums"
          />
          <span className="text-xs text-muted-foreground">booths</span>
        </div>
      </div>

      {hasPerBrandCaps ? (
        <>
          <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
            You also have specific brand caps below. The booth count above applies to the generic
            direct-sales category; brand rows and the approval cap below work independently.
          </p>
          <DirectSalesApprovalCap
            globalMlmCap={globalMlmCap}
            onGlobalMlmCapChange={onGlobalMlmCapChange}
          />
        </>
      ) : null}
    </div>
  )
}
