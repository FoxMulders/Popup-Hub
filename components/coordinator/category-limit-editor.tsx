'use client'

import { useMemo, useState } from 'react'
import { compareCategoryNames } from '@/lib/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, HelpCircle, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import { selectValueOrNull } from '@/lib/wizard/wizard-autosave'
import { WIZARD_BTN_PRIMARY } from '@/lib/wizard/wizard-panel-styles'
import {
  applyMlmLimitRules,
  clampMlmMaxSlots,
  DEFAULT_GLOBAL_MLM_CAP,
  isMlmCategory,
  isSingleSlotMlmLimit,
} from '@/lib/categories/mlm-constraints'

export interface CategoryLimit {
  categoryId: string
  categoryName: string
  maxSlots: number
  pricePerBooth: number
  /** @deprecated Per-category table lengths — venue uses hall-wide baseline only. */
  tableLengthFt?: number | null
}

interface CategoryLimitEditorProps {
  categories: Category[]
  value: CategoryLimit[]
  onChange: (limits: CategoryLimit[]) => void
  allowMlm?: boolean
  globalMlmCap?: number
  /** When set, per-category fee inputs are hidden; all rows use this cents value. */
  unifiedBoothFeeCents?: number
}

const DEFAULT_NEW_SLOTS = 1

function resolveCategoryName(limit: CategoryLimit, categories: Category[]): string {
  const trimmed = limit.categoryName?.trim()
  if (trimmed) return trimmed
  const cat = categories.find((c) => c.id === limit.categoryId)
  return cat?.name ?? 'Unnamed category'
}

export function CategoryLimitEditor({
  categories,
  value,
  onChange,
  allowMlm = false,
  globalMlmCap = DEFAULT_GLOBAL_MLM_CAP,
  unifiedBoothFeeCents,
}: CategoryLimitEditorProps) {
  const useUnifiedFee = unifiedBoothFeeCents !== undefined
  const unifiedCents = Math.max(0, Math.round(unifiedBoothFeeCents ?? 0))
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [slots, setSlots] = useState(DEFAULT_NEW_SLOTS)
  const [priceDollars, setPriceDollars] = useState(0)
  const [tableLengthFt, setTableLengthFt] = useState<number | ''>('')
  const [showNicheCaps, setShowNicheCaps] = useState(() =>
    value.some((v) => {
      const cat = categories.find((c) => c.id === v.categoryId)
      return cat ? cat.is_broad !== true : false
    })
  )

  const usedCategoryIds = new Set(value.map((v) => v.categoryId))
  const availableCategories = useMemo(
    () =>
      categories
        .filter(
          (c) =>
            !usedCategoryIds.has(c.id) &&
            (allowMlm || !c.is_mlm) &&
            (showNicheCaps || c.is_broad === true)
        )
        .sort((a, b) => compareCategoryNames(a.name, b.name)),
    [categories, value, allowMlm, showNicheCaps]
  )

  const broadCategories = useMemo(
    () =>
      categories
        .filter(
          (c) => !usedCategoryIds.has(c.id) && (allowMlm || !c.is_mlm) && c.is_broad === true
        )
        .sort((a, b) => compareCategoryNames(a.name, b.name)),
    [categories, value, allowMlm]
  )

  const broadById = useMemo(
    () => new Map(categories.filter((c) => c.is_broad === true).map((c) => [c.id, c])),
    [categories]
  )

  /** Lookup: which category ids are flagged is_mlm for badging in the row. */
  const mlmCategoryIds = useMemo(
    () => new Set(categories.filter((c) => c.is_mlm).map((c) => c.id)),
    [categories]
  )

  const limitsWithNames = useMemo(
    () =>
      value.map((limit) => ({
        ...limit,
        categoryName: resolveCategoryName(limit, categories),
      })),
    [value, categories]
  )

  const sortedLimits = useMemo(
    () => [...limitsWithNames].sort((a, b) => compareCategoryNames(a.categoryName, b.categoryName)),
    [limitsWithNames]
  )

  function commitLimits(next: CategoryLimit[]) {
    onChange(allowMlm ? applyMlmLimitRules(next, categories, globalMlmCap) : next)
  }

  function addLimit() {
    const cat = categories.find((c) => c.id === selectedCategoryId)
    if (!cat || slots <= 0) return

    const nextSlots = allowMlm && isMlmCategory(cat) ? 1 : slots

    commitLimits([
      ...value,
      {
        categoryId: cat.id,
        categoryName: cat.name,
        maxSlots: nextSlots,
        pricePerBooth: useUnifiedFee ? unifiedCents : Math.round(priceDollars * 100),
        tableLengthFt: null,
      },
    ])
    setSelectedCategoryId('')
    setSlots(DEFAULT_NEW_SLOTS)
    setPriceDollars(0)
  }

  function addOneOfEveryCategory() {
    const additions: CategoryLimit[] = broadCategories.map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      maxSlots: 1,
      pricePerBooth: useUnifiedFee ? unifiedCents : 0,
      tableLengthFt: null,
    }))
    if (additions.length === 0) return
    commitLimits([...value, ...additions])
  }

  function removeLimit(categoryId: string) {
    commitLimits(value.filter((v) => v.categoryId !== categoryId))
  }

  function updateSlots(categoryId: string, newSlots: number) {
    const limit = value.find((v) => v.categoryId === categoryId)
    const cat = categories.find((c) => c.id === categoryId)
    const slots =
      limit && isSingleSlotMlmLimit(limit, categories)
        ? 1
        : cat && allowMlm && isMlmCategory(cat)
          ? clampMlmMaxSlots(cat.name, cat, newSlots)
          : Math.max(1, newSlots)

    commitLimits(value.map((v) => (v.categoryId === categoryId ? { ...v, maxSlots: slots } : v)))
  }

  /**
   * Update the per-row booth fee. We store cents internally but the
   * editor exposes dollars to keep coordinators sane — vendors are
   * NEVER asked to think in cents.
   */
  function updatePriceDollars(categoryId: string, dollars: number) {
    const cents = Math.max(0, Math.round((Number.isFinite(dollars) ? dollars : 0) * 100))
    commitLimits(
      value.map((v) => (v.categoryId === categoryId ? { ...v, pricePerBooth: cents } : v))
    )
  }

  const totalSlots = value.reduce((sum, v) => sum + v.maxSlots, 0)
  const selectedCat = categories.find((c) => c.id === selectedCategoryId)
  const addingMlmLocked = Boolean(selectedCat && allowMlm && isMlmCategory(selectedCat))

  return (
    <div className="space-y-4">
      {broadCategories.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-canvas/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">Quick start:</strong> add one of every
            broad category at 1 slot each. Edit and increase any of them after.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={addOneOfEveryCategory}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Add one of every broad category ({broadCategories.length})
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-stone-200 bg-card px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="show-niche-caps" className="text-xs font-medium text-foreground">
            Advanced: cap niche tags
          </Label>
          <Tooltip>
            <TooltipTrigger type="button">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              By default, slots match vendor primary categories (broad buckets). Turn this on to
              additionally cap a specific niche tag (e.g. only allow 1 Macrame inside Artisan
              Crafts). Niche caps act as sub-limits on top of broad slots.
            </TooltipContent>
          </Tooltip>
        </div>
        <Switch
          id="show-niche-caps"
          checked={showNicheCaps}
          onCheckedChange={setShowNicheCaps}
          aria-label="Show niche category caps"
        />
      </div>

      {/* Existing limits table */}
      {value.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-canvas border-b-2 border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="text-center px-4 py-3 font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-28">
                  <span className="inline-flex items-center gap-1">
                    Max Slots
                    <Tooltip>
                      <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">The maximum number of vendors allowed in this category at this event.</TooltipContent>
                    </Tooltip>
                  </span>
                </th>
                {useUnifiedFee ? null : (
                  <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground w-32">
                    <span className="inline-flex items-center gap-1">
                      Booth Fee
                      <Tooltip>
                        <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Per-booth fee charged to the vendor. Required before publishing — leave at $0
                          for free booths, but every category must have an explicit value.
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </th>
                )}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60">
              {sortedLimits.map((limit, index) => {
                const singleSlotLocked = allowMlm && isSingleSlotMlmLimit(limit, categories)
                const isMlmRow = mlmCategoryIds.has(limit.categoryId)
                return (
                <tr
                  key={`${limit.categoryId}-${index}`}
                  className={cn(
                    'transition-colors',
                    /* Editorial zebra striping — soft 4% canvas tint, no aggressive coloring */
                    index % 2 === 0 ? 'bg-card' : 'bg-canvas/40'
                  )}
                >
                  <td className="px-4 py-2.5">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-medium">
                        {limit.categoryName}
                      </Badge>
                      {isMlmRow ? (
                        <Tooltip>
                          <TooltipTrigger type="button">
                            <span
                              className="rounded bg-terracotta-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-terracotta-800 ring-1 ring-terracotta-200/80"
                              aria-label="Multi-Level Marketing category"
                            >
                              MLM
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Multi-Level Marketing brand — booth approval is capped globally to
                            keep the market diverse.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                      {broadById.has(limit.categoryId) ? null : (
                        <Tooltip>
                          <TooltipTrigger type="button">
                            <span className="rounded bg-stone-200 px-1 text-[10px] font-semibold uppercase tracking-wide text-stone-700">
                              Niche
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Niche cap — sub-limit on top of broad slots. Vendor primaries don&apos;t
                            consume this directly.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min={singleSlotLocked ? 1 : 0}
                      max={singleSlotLocked ? 1 : 100}
                      value={limit.maxSlots}
                      disabled={singleSlotLocked}
                      readOnly={singleSlotLocked}
                      onChange={(e) => updateSlots(limit.categoryId, parseInt(e.target.value) || 1)}
                      className={`h-8 text-center w-20 mx-auto ${singleSlotLocked ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : ''}`}
                      title={singleSlotLocked ? 'MLM brands are locked to 1 slot each' : undefined}
                    />
                  </td>
                  {useUnifiedFee ? null : (
                    <td className="px-4 py-2.5">
                      <div className="relative mx-auto w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={(limit.pricePerBooth / 100).toFixed(2)}
                          onChange={(e) => updatePriceDollars(limit.categoryId, parseFloat(e.target.value))}
                          className="h-8 pl-5 text-right tabular-nums"
                          aria-label={`Booth fee for ${limit.categoryName}`}
                        />
                      </div>
                    </td>
                  )}
                  <td className="px-2 py-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-500"
                      onClick={() => removeLimit(limit.categoryId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              )})}
            </tbody>
            <tfoot className="bg-canvas border-t-2 border-stone-200">
              <tr>
                <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">
                  {value.length} {value.length === 1 ? 'category' : 'categories'}
                </td>
                <td className="px-4 py-2.5 text-center text-xs font-bold text-foreground">
                  {totalSlots} total
                </td>
                <td colSpan={useUnifiedFee ? 1 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add new limit */}
      {availableCategories.length > 0 && (
        <div className="rounded-xl border-2 border-dashed border-stone-200 bg-canvas p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Add Category Slot
            </p>
            <Tooltip>
              <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Add categories to control which types of vendors can apply and how many spots are available for each.</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-40 space-y-1">
              <Label className="text-xs">Category</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={(v) => {
                  const next = selectValueOrNull(v)
                  if (!next) return
                  setSelectedCategoryId(next)
                  const cat = categories.find((c) => c.id === next)
                  if (cat && allowMlm && isMlmCategory(cat)) setSlots(1)
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…">
                    {(value) => {
                      if (!value) return 'Select…'
                      const cat = categories.find((c) => c.id === value)
                      return cat?.name ?? 'Select…'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} label={cat.name}>
                      <span className="flex items-center gap-2">
                        {cat.name}
                        {cat.is_mlm && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 rounded px-1 font-medium">MLM</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">Max Slots</Label>
              <Input
                type="number"
                min={1}
                max={addingMlmLocked ? 1 : 100}
                value={addingMlmLocked ? 1 : slots}
                disabled={addingMlmLocked}
                readOnly={addingMlmLocked}
                onChange={(e) => setSlots(parseInt(e.target.value) || 1)}
                className={`h-9 ${addingMlmLocked ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : ''}`}
                title={addingMlmLocked ? 'MLM brands are locked to 1 slot each' : undefined}
              />
            </div>
            {useUnifiedFee ? null : (
              <div className="w-28 space-y-1">
                <Label className="text-xs">Fee (USD)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(parseFloat(e.target.value) || 0)}
                    className="h-9 pl-6"
                  />
                </div>
              </div>
            )}
            <Button
              type="button"
              onClick={addLimit}
              disabled={!selectedCategoryId || slots <= 0}
              className={WIZARD_BTN_PRIMARY}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {selectedCategoryId && !useUnifiedFee && priceDollars > 0 ? (
            <p className="text-xs text-muted-foreground mt-2">
              Vendors will pay {formatCents(Math.round(priceDollars * 100))} per booth.
            </p>
          ) : null}
          {selectedCategoryId && useUnifiedFee && unifiedCents > 0 ? (
            <p className="text-xs text-muted-foreground mt-2">
              Vendors will pay {formatCents(unifiedCents)} per table (market-wide fee).
            </p>
          ) : null}
        </div>
      )}

      {value.length === 0 && availableCategories.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          All categories have been added.
        </p>
      )}
    </div>
  )
}
