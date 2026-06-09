'use client'

import { useMemo, useState } from 'react'
import { compareCategoryNames } from '@/lib/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, HelpCircle, Sparkles, ChevronDown } from 'lucide-react'
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
import {
  classifyCategory,
  type DistributionBucketKey,
} from '@/lib/booth-planner/smart-populate-booth-caps'

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
  /** Group configured limits into collapsible broad-type sections. */
  grouped?: boolean
}

const DEFAULT_NEW_SLOTS = 1

const ACCORDION_BUCKETS: { key: DistributionBucketKey; label: string }[] = [
  { key: 'makers', label: 'Makers & Crafts' },
  { key: 'art', label: 'Art & Prints' },
  { key: 'food', label: 'Food & Beverage' },
  { key: 'apparel', label: 'Apparel' },
  { key: 'commercial', label: 'Commercial / MLMs' },
]

function resolveCategoryName(limit: CategoryLimit, categories: Category[]): string {
  const trimmed = limit.categoryName?.trim()
  if (trimmed) return trimmed
  const cat = categories.find((c) => c.id === limit.categoryId)
  return cat?.name ?? 'Unnamed category'
}

function limitRowGridClass(useUnifiedFee: boolean) {
  return cn(
    'grid items-center gap-x-3 gap-y-1 px-3 py-2',
    useUnifiedFee
      ? 'grid-cols-[minmax(0,1fr)_5.5rem_2rem]'
      : 'grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_2rem]'
  )
}

export function CategoryLimitEditor({
  categories,
  value,
  onChange,
  allowMlm = false,
  globalMlmCap = DEFAULT_GLOBAL_MLM_CAP,
  unifiedBoothFeeCents,
  grouped = false,
}: CategoryLimitEditorProps) {
  const useUnifiedFee = unifiedBoothFeeCents !== undefined
  const unifiedCents = Math.max(0, Math.round(unifiedBoothFeeCents ?? 0))
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [slots, setSlots] = useState(DEFAULT_NEW_SLOTS)
  const [priceDollars, setPriceDollars] = useState(0)
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

  const groupedLimits = useMemo(() => {
    if (!grouped) return null

    const byBucket = new Map<DistributionBucketKey, typeof sortedLimits>()
    for (const bucket of ACCORDION_BUCKETS) {
      byBucket.set(bucket.key, [])
    }

    for (const limit of sortedLimits) {
      const cat = categories.find((c) => c.id === limit.categoryId)
      const key = classifyCategory(
        cat ?? {
          name: limit.categoryName,
          is_mlm: mlmCategoryIds.has(limit.categoryId),
        },
        allowMlm
      )
      byBucket.get(key)?.push(limit)
    }

    return ACCORDION_BUCKETS.map((bucket) => {
      const limits = byBucket.get(bucket.key) ?? []
      const slotSum = limits.reduce((sum, l) => sum + l.maxSlots, 0)
      return { ...bucket, limits, slotSum }
    }).filter((g) => g.limits.length > 0)
  }, [grouped, sortedLimits, categories, allowMlm, mlmCategoryIds])

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
    const nextSlots =
      limit && isSingleSlotMlmLimit(limit, categories)
        ? 1
        : cat && allowMlm && isMlmCategory(cat)
          ? clampMlmMaxSlots(cat.name, cat, newSlots)
          : Math.max(1, newSlots)

    commitLimits(value.map((v) => (v.categoryId === categoryId ? { ...v, maxSlots: nextSlots } : v)))
  }

  function updatePriceDollars(categoryId: string, dollars: number) {
    const cents = Math.max(0, Math.round((Number.isFinite(dollars) ? dollars : 0) * 100))
    commitLimits(
      value.map((v) => (v.categoryId === categoryId ? { ...v, pricePerBooth: cents } : v))
    )
  }

  const totalSlots = value.reduce((sum, v) => sum + v.maxSlots, 0)
  const selectedCat = categories.find((c) => c.id === selectedCategoryId)
  const addingMlmLocked = Boolean(selectedCat && allowMlm && isMlmCategory(selectedCat))

  function renderLimitRow(limit: (typeof sortedLimits)[number], index: number) {
    const singleSlotLocked = allowMlm && isSingleSlotMlmLimit(limit, categories)
    const isMlmRow = mlmCategoryIds.has(limit.categoryId)

    return (
      <div
        key={`${limit.categoryId}-${index}`}
        className={cn(
          limitRowGridClass(useUnifiedFee),
          index % 2 === 0 ? 'bg-card' : 'bg-canvas/40'
        )}
      >
        <div className="min-w-0">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="max-w-full truncate font-medium">
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
                  Multi-Level Marketing brand — booth approval is capped globally to keep the market
                  diverse.
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
                  Niche cap — sub-limit on top of broad slots. Vendor primaries don&apos;t consume
                  this directly.
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        </div>
        <Input
          type="number"
          min={singleSlotLocked ? 1 : 0}
          max={singleSlotLocked ? 1 : 100}
          value={limit.maxSlots}
          disabled={singleSlotLocked}
          readOnly={singleSlotLocked}
          onChange={(e) => updateSlots(limit.categoryId, parseInt(e.target.value) || 1)}
          className={cn(
            'h-8 w-full text-center tabular-nums',
            singleSlotLocked && 'cursor-not-allowed bg-muted text-muted-foreground opacity-70'
          )}
          title={singleSlotLocked ? 'MLM brands are locked to 1 slot each' : undefined}
          aria-label={`Max slots for ${limit.categoryName}`}
        />
        {useUnifiedFee ? null : (
          <div className="relative w-full">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={limit.pricePerBooth > 0 ? (limit.pricePerBooth / 100).toFixed(2) : ''}
              key={`${limit.categoryId}-${limit.pricePerBooth}`}
              onBlur={(e) => updatePriceDollars(limit.categoryId, parseFloat(e.target.value))}
              className="h-8 w-full pl-5 text-right tabular-nums"
              aria-label={`Booth fee for ${limit.categoryName}`}
            />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 justify-self-end text-muted-foreground hover:text-red-500"
          onClick={() => removeLimit(limit.categoryId)}
          aria-label={`Remove ${limit.categoryName}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  function renderLimitsHeader() {
    return (
      <div
        className={cn(
          limitRowGridClass(useUnifiedFee),
          'border-b-2 border-stone-200 bg-canvas px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'
        )}
      >
        <span>Category</span>
        <span className="text-center">
          <span className="inline-flex items-center justify-center gap-1">
            Max slots
            <Tooltip>
              <TooltipTrigger type="button">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                The maximum number of vendors allowed in this category at this event.
              </TooltipContent>
            </Tooltip>
          </span>
        </span>
        {useUnifiedFee ? null : (
          <span className="text-center">
            <span className="inline-flex items-center justify-center gap-1">
              Booth fee
              <Tooltip>
                <TooltipTrigger type="button">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Per-booth fee charged to the vendor. Required before publishing — leave at $0 for
                  free booths, but every category must have an explicit value.
                </TooltipContent>
              </Tooltip>
            </span>
          </span>
        )}
        <span className="sr-only">Remove</span>
      </div>
    )
  }

  function renderLimitsBody() {
    if (value.length === 0) return null

    if (grouped && groupedLimits) {
      return (
        <div className="space-y-2">
          {groupedLimits.map((group) => (
            <details
              key={group.key}
              className="group overflow-hidden rounded-xl border border-stone-200 bg-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none hover:bg-canvas/50 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                  <span className="truncate text-sm font-semibold text-foreground">{group.label}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {group.slotSum} / {group.slotSum} slots assigned
                  <span className="hidden sm:inline">
                    {' '}
                    · {group.limits.length} categor{group.limits.length === 1 ? 'y' : 'ies'}
                  </span>
                </span>
              </summary>
              <div className="border-t border-stone-200/80">
                {renderLimitsHeader()}
                <div className="divide-y divide-stone-200/60">
                  {group.limits.map((limit, index) => renderLimitRow(limit, index))}
                </div>
              </div>
            </details>
          ))}
          <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-canvas px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {value.length} {value.length === 1 ? 'category' : 'categories'}
            </span>
            <span className="font-bold tabular-nums text-foreground">{totalSlots} total slots</span>
          </div>
        </div>
      )
    }

    return (
      <div className="overflow-hidden rounded-xl border border-stone-200">
        {renderLimitsHeader()}
        <div className="divide-y divide-stone-200/60">
          {sortedLimits.map((limit, index) => renderLimitRow(limit, index))}
        </div>
        <div
          className={cn(
            limitRowGridClass(useUnifiedFee),
            'border-t-2 border-stone-200 bg-canvas text-xs'
          )}
        >
          <span className="font-medium text-muted-foreground">
            {value.length} {value.length === 1 ? 'category' : 'categories'}
          </span>
          <span className="text-center font-bold tabular-nums text-foreground">{totalSlots} total</span>
          <span className={useUnifiedFee ? 'hidden' : undefined} />
          <span />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {broadCategories.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-canvas/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">Quick start:</strong> add one of every
            broad category at 1 slot each.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 gap-1.5"
            onClick={addOneOfEveryCategory}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Add all broad ({broadCategories.length})
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-stone-200 bg-card px-3 py-2">
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

      {renderLimitsBody()}

      {availableCategories.length > 0 ? (
        <div className="rounded-xl border-2 border-dashed border-stone-200 bg-canvas p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add category slot
            </p>
            <Tooltip>
              <TooltipTrigger type="button">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Add categories to control which types of vendors can apply and how many spots are
                available for each.
              </TooltipContent>
            </Tooltip>
          </div>
          <div
            className={cn(
              'grid items-end gap-3',
              useUnifiedFee
                ? 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto]'
                : 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_auto]'
            )}
          >
            <div className="min-w-0 space-y-1">
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
                        {cat.is_mlm ? (
                          <span className="rounded bg-purple-100 px-1 text-[10px] font-medium text-purple-700">
                            MLM
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max slots</Label>
              <Input
                type="number"
                min={1}
                max={addingMlmLocked ? 1 : 100}
                value={addingMlmLocked ? 1 : slots}
                disabled={addingMlmLocked}
                readOnly={addingMlmLocked}
                onChange={(e) => setSlots(parseInt(e.target.value) || 1)}
                className={cn(
                  'h-9 tabular-nums',
                  addingMlmLocked && 'cursor-not-allowed bg-muted text-muted-foreground opacity-70'
                )}
                title={addingMlmLocked ? 'MLM brands are locked to 1 slot each' : undefined}
              />
            </div>
            {useUnifiedFee ? null : (
              <div className="space-y-1">
                <Label className="text-xs">Fee (USD)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(parseFloat(e.target.value) || 0)}
                    className="h-9 pl-6 tabular-nums"
                  />
                </div>
              </div>
            )}
            <Button
              type="button"
              onClick={addLimit}
              disabled={!selectedCategoryId || slots <= 0}
              className={cn(WIZARD_BTN_PRIMARY, 'h-9 w-full sm:w-auto')}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {selectedCategoryId && !useUnifiedFee && priceDollars > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Vendors will pay {formatCents(Math.round(priceDollars * 100))} per booth.
            </p>
          ) : null}
          {selectedCategoryId && useUnifiedFee && unifiedCents > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Vendors will pay {formatCents(unifiedCents)} per table (market-wide fee).
            </p>
          ) : null}
        </div>
      ) : null}

      {value.length === 0 && availableCategories.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">All categories have been added.</p>
      ) : null}
    </div>
  )
}
