'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TEST_CATEGORY_PRESETS } from '@/lib/booth-planner/fake-vendors'
import type { VendorUnitType } from '@/lib/booth-planner/vendor-unit-types'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { FlaskConical, Plus, Shuffle, Sparkles, Trash2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FakeVendorsPanelProps {
  fakeVendorCount: number
  layoutCapacity: number
  maxBoothCapacity: number
  lastFillSummary: string | null
  allowsTentVendors?: boolean
  tentRestrictionTooltip?: string
  randomFillRunning?: boolean
  /** Vertical stack for the 20% left utility rail. */
  compact?: boolean
  onAdd: (
    count: number,
    options: { namePrefix: string; category: string; vendorUnitType: VendorUnitType }
  ) => void
  onClear: () => void
  onAutoFill: () => void
  onRandomFillToMax: () => void
  onSeedDiverseToMax?: () => void
  seedFillRunning?: boolean
}

export function FakeVendorsPanel({
  fakeVendorCount,
  layoutCapacity,
  maxBoothCapacity,
  lastFillSummary,
  allowsTentVendors = false,
  tentRestrictionTooltip = 'Tents are restricted to outdoor row presets.',
  randomFillRunning = false,
  compact = false,
  onAdd,
  onClear,
  onAutoFill,
  onRandomFillToMax,
  onSeedDiverseToMax,
  seedFillRunning = false,
}: FakeVendorsPanelProps) {
  const [count, setCount] = useState(5)
  const [namePrefix, setNamePrefix] = useState('Test Vendor')
  const [category, setCategory] = useState<string>(TEST_CATEGORY_PRESETS[0])
  const [vendorUnitType, setVendorUnitType] = useState<VendorUnitType>('table')

  function handleAdd() {
    const n = Math.min(50, Math.max(1, count))
    onAdd(n, { namePrefix, category, vendorUnitType })
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 space-y-3',
        compact ? 'p-2.5' : 'p-4 space-y-4'
      )}
    >
      <div className="flex items-start gap-2">
        <FlaskConical className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className={cn('font-semibold text-violet-900', compact ? 'text-xs' : 'text-sm')}>
            Test vendors
          </p>
          {!compact ? (
            <p className="text-xs text-violet-700 mt-0.5">
              Table vendors use your baseline table size (L × 2′ equipment on the 1′ grid). Tent vendors are
              10×10 ft and only available on outdoor row layouts.
            </p>
          ) : null}
        </div>
      </div>

      <div className={cn(compact ? 'flex flex-col gap-2' : 'flex flex-wrap gap-3 items-end')}>
        <div className="flex flex-col gap-1 w-full">
          <Label htmlFor="fake-count" className="text-xs text-violet-800">
            How many
          </Label>
          <Input
            id="fake-count"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            onDoubleClick={(e) => e.currentTarget.select()}
            className={cn('h-8 text-sm bg-white', compact ? 'w-full' : 'w-20')}
          />
        </div>
        <div className={cn('flex flex-col gap-1', compact ? 'w-full' : 'min-w-[140px]')}>
          <Label htmlFor="fake-prefix" className="text-xs text-violet-800">
            Name prefix
          </Label>
          <Input
            id="fake-prefix"
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
            placeholder="Test Vendor"
            className="h-8 text-sm bg-white w-full"
          />
        </div>
        <div className={cn('flex flex-col gap-1', compact ? 'w-full' : 'min-w-[160px]')}>
          <Label className="text-xs text-violet-800">Category</Label>
          <Select value={category} onValueChange={(v) => v != null && setCategory(v)}>
            <SelectTrigger className="h-8 text-sm bg-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEST_CATEGORY_PRESETS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={cn('flex flex-col gap-1', compact ? 'w-full' : 'min-w-[140px]')}>
          <Label className="text-xs text-violet-800">Unit type</Label>
          <Select
            value={vendorUnitType}
            onValueChange={(v) => v != null && setVendorUnitType(v as VendorUnitType)}
          >
            <SelectTrigger className="h-8 text-sm bg-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">Table vendor</SelectItem>
              <SelectItem value="tent" disabled={!allowsTentVendors}>
                Tent vendor (10×10)
              </SelectItem>
            </SelectContent>
          </Select>
          {!allowsTentVendors ? (
            <TooltipWrapper text={tentRestrictionTooltip}>
              <p className="text-[10px] text-muted-foreground cursor-default leading-snug">
                Indoor venues — tables only
              </p>
            </TooltipWrapper>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleAdd}
          className={cn('gap-1', compact && 'w-full')}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className={cn('flex gap-2', compact ? 'flex-col' : 'flex-wrap items-center')}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAutoFill}
          className={cn(
            'gap-1 border-violet-300 text-violet-900 hover:bg-violet-100',
            compact && 'w-full justify-start text-xs'
          )}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          Auto-fill to capacity (~{layoutCapacity})
        </Button>
        <TooltipWrapper text="Curated artisan mix (6′ tables, power vendors, multi-unit pairs) up to venue ceiling — then auto-plans.">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSeedDiverseToMax}
            disabled={
              seedFillRunning ||
              randomFillRunning ||
              maxBoothCapacity <= 0 ||
              !onSeedDiverseToMax
            }
            className={cn(
              'gap-1 border-violet-300 text-violet-900 hover:bg-violet-100',
              compact && 'w-full justify-start text-xs'
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            {seedFillRunning
              ? 'Seeding applications…'
              : `Seed diverse applications to max (${maxBoothCapacity})`}
          </Button>
        </TooltipWrapper>
        <TooltipWrapper text="Random 6′ table vendors matching maximum venue capacity.">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRandomFillToMax}
            disabled={randomFillRunning || maxBoothCapacity <= 0}
            className={cn(
              'gap-1 border-violet-300 text-violet-900 hover:bg-violet-100',
              compact && 'w-full justify-start text-xs'
            )}
          >
            <Shuffle className="h-4 w-4 shrink-0" />
            {randomFillRunning
              ? 'Filling & routing…'
              : `Fill Random to Max (${maxBoothCapacity})`}
          </Button>
        </TooltipWrapper>
        {fakeVendorCount > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
            className={cn('gap-1 text-violet-800', compact && 'w-full justify-start text-xs')}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Clear {fakeVendorCount} test vendor{fakeVendorCount === 1 ? '' : 's'}
          </Button>
        )}
      </div>

      {lastFillSummary && (
        <p className="text-xs text-violet-800 rounded-lg border border-violet-200 bg-white/80 px-3 py-2">
          {lastFillSummary}
        </p>
      )}
    </div>
  )
}
