'use client'

import { useEffect, useMemo, useState } from 'react'
import { compareCategoryNames, compareCategoryNamesWithMlmBroadFirst } from '@/lib/categories'
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
import { toast } from 'sonner'
import {
  applyMlmLimitRules,
  clampMlmMaxSlots,
  coordinatorCategoryDisplayName,
  DEFAULT_GLOBAL_MLM_CAP,
  hasPerBrandDirectSalesLimits,
  isBroadDirectSalesCategory,
  isMlmCategory,
  isPerBrandMlmSlotLimit,
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
  /** Cap quick-start adds so total slots do not exceed floor capacity. */
  maxTotalSlots?: number
  /** Group configured limits into collapsible broad-type sections. */
  grouped?: boolean
  /** Quarter auctions use vendor-spot copy instead of booth/slot language. */
  variant?: 'market' | 'quarter_auction'
}

const DEFAULT_NEW_SLOTS = 1

const ACCORDION_BUCKETS: { key: DistributionBucketKey; label: string }[] = [
  { key: 'makers', label: 'Makers & Crafts' },
  { key: 'art', label: 'Art & Prints' },
  { key: 'food', label: 'Food & Beverage' },
  { key: 'apparel', label: 'Apparel' },
  { key: 'commercial', label: 'Direct sales' },
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

function SlotCountInput({
  value,
  disabled = false,
  readOnly = false,
  min,
  max,
  onCommit,
  className,
  title,
  'aria-label': ariaLabel,
}: {
  value: number
  disabled?: boolean
  readOnly?: boolean
  min?: number
  max?: number
  onCommit: (n: number) => void
  className?: string
  title?: string
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)

  useEffect(() => {
    setDraft(null)
  }, [value])

  const display = draft ?? String(value)

  function commit() {
    const parsed = parseInt(draft ?? String(value), 10)
    onCommit(Number.isFinite(parsed) ? parsed : value)
    setDraft(null)
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={display}
      disabled={disabled}
      readOnly={readOnly}
      onFocus={(e) => {
        if (disabled || readOnly) return
        setDraft(String(value))
        e.currentTarget.select()
      }}
      onChange={(e) => {
        if (disabled || readOnly) return
        setDraft(e.target.value)
      }}
      onBlur={() => {
        if (disabled || readOnly) return
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={className}
      title={title}
      aria-label={ariaLabel}
    />
  )
}

export function CategoryLimitEditor({
  categories,
  value,
  onChange,
  allowMlm = false,
  globalMlmCap = DEFAULT_GLOBAL_MLM_CAP,
  unifiedBoothFeeCents,
  maxTotalSlots,
  grouped = false,
  variant = 'market',
}: CategoryLimitEditorProps) {
  const isQuarterAuction = variant === 'quarter_auction'
  const slotsLabel = isQuarterAuction ? 'Vendor spots' : 'Max slots'
  const addCategoryLabel = isQuarterAuction ? 'Add vendor type' : 'Add category slot'
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
  const [showBrandCaps, setShowBrandCaps] = useState(() =>
    hasPerBrandDirectSalesLimits(value, categories)
  )

  const usedCategoryIds = new Set(value.map((v) => v.categoryId))
  const availableCategories = useMemo(
    () =>
      categories
        .filter(
          (c) =>
            !usedCategoryIds.has(c.id) &&
            (allowMlm || !c.is_mlm) &&
            !(allowMlm && isBroadDirectSalesCategory(c)) &&
            (showNicheCaps || c.is_broad === true || (allowMlm && c.is_mlm === true))
        )
        .sort((a, b) =>
          (allowMlm ? compareCategoryNamesWithMlmBroadFirst : compareCategoryNames)(a.name, b.name)
        ),
    [categories, value, allowMlm, showNicheCaps]
  )

  const broadCategories = useMemo(
    () =>
      categories
        .filter(
          (c) => !usedCategoryIds.has(c.id) && (allowMlm || !c.is_mlm) && c.is_broad === true
        )
        .sort((a, b) =>
          (allowMlm ? compareCategoryNamesWithMlmBroadFirst : compareCategoryNames)(a.name, b.name)
        ),
    [categories, value, allowMlm]
  )

  const broadById = useMemo(
    () => new Map(categories.filter((c) => c.is_broad === true).map((c) => [c.id, c])),
    [categories]
  )

  const mlmBrandCategories = useMemo(
    () =>
      categories
        .filter(
          (c) =>
            !usedCategoryIds.has(c.id) &&
            allowMlm &&
            isPerBrandMlmSlotLimit(c)
        )
        .sort((a, b) => compareCategoryNames(a.name, b.name)),
    [categories, value, allowMlm]
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

  const displayLimits = useMemo(() => {
    if (!allowMlm) return sortedLimits
    return sortedLimits.filter((limit) => {
      const cat = categories.find((c) => c.id === limit.categoryId)
      return !isBroadDirectSalesCategory(cat)
    })
  }, [sortedLimits, categories, allowMlm])

  const groupedLimits = useMemo(() => {
    if (!grouped) return null

    const byBucket = new Map<DistributionBucketKey, typeof sortedLimits>()
    for (const bucket of ACCORDION_BUCKETS) {
      byBucket.set(bucket.key, [])
    }

    for (const limit of displayLimits) {
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
      const rawLimits = byBucket.get(bucket.key) ?? []
      const limits =
        bucket.key === 'commercial' && allowMlm
          ? [...rawLimits].sort((a, b) =>
              compareCategoryNamesWithMlmBroadFirst(a.categoryName, b.categoryName)
            )
          : rawLimits
      const slotSum = limits.reduce((sum, l) => sum + l.maxSlots, 0)
      return { ...bucket, limits, slotSum }
    }).filter((g) => g.limits.length > 0)
  }, [grouped, displayLimits, categories, allowMlm, mlmCategoryIds])

  function commitLimits(next: CategoryLimit[]) {
    onChange(allowMlm ? applyMlmLimitRules(next, categories, globalMlmCap) : next)
  }

  function addLimit() {
    const cat = categories.find((c) => c.id === selectedCategoryId)
    if (!cat || slots <= 0) return

    const nextSlots = allowMlm && isPerBrandMlmSlotLimit(cat) ? 1 : slots

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
    const remainingCapacity =
      maxTotalSlots != null && maxTotalSlots > 0
        ? Math.max(0, maxTotalSlots - totalSlots)
        : broadCategories.length

    if (remainingCapacity <= 0) {
      toast.error(
        maxTotalSlots != null
          ? `Quick start would exceed the max booth capacity (${maxTotalSlots}). Remove caps or raise floor capacity first.`
          : 'All broad categories are already added.'
      )
      return
    }

    const additions: CategoryLimit[] = broadCategories.slice(0, remainingCapacity).map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      maxSlots: 1,
      pricePerBooth: useUnifiedFee ? unifiedCents : 0,
      tableLengthFt: null,
    }))
    if (additions.length === 0) return
    commitLimits([...value, ...additions])
  }

  function addAllMlmBrands() {
    if (mlmBrandCategories.length === 0) {
      toast.error('All direct-sales brands are already added')
      return
    }

    const remainingCapacity =
      maxTotalSlots != null && maxTotalSlots > 0
        ? Math.max(0, maxTotalSlots - totalSlots)
        : mlmBrandCategories.length

    if (remainingCapacity <= 0) {
      toast.error(
        maxTotalSlots != null
          ? `Cannot add direct-sales brands — total caps already at the floor maximum (${maxTotalSlots}).`
          : 'Cannot add more direct-sales brands.'
      )
      return
    }

    const additions: CategoryLimit[] = mlmBrandCategories.slice(0, remainingCapacity).map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      maxSlots: 1,
      pricePerBooth: useUnifiedFee ? unifiedCents : 0,
      tableLengthFt: null,
    }))
    commitLimits([...value, ...additions])
    setShowBrandCaps(true)
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
        : cat && allowMlm && isPerBrandMlmSlotLimit(cat)
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
  const addingMlmLocked = Boolean(selectedCat && allowMlm && isPerBrandMlmSlotLimit(selectedCat))
  const quickStartDisabled =
    broadCategories.length === 0 ||
    (maxTotalSlots != null && maxTotalSlots > 0 && totalSlots >= maxTotalSlots)

  function renderLimitRow(limit: (typeof displayLimits)[number], index: number) {
    const singleSlotLocked = allowMlm && isSingleSlotMlmLimit(limit, categories)
    const isMlmRow = mlmCategoryIds.has(limit.categoryId)
    const displayName = coordinatorCategoryDisplayName(limit.categoryName)

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
              {displayName}
            </Badge>
            {isMlmRow ? (
              <Tooltip>
                <TooltipTrigger type="button">
                  <span
                    className="rounded bg-terracotta-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-terracotta-800 ring-1 ring-terracotta-200/80"
                    aria-label="Direct sales brand"
                  >
                    Direct sales
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Multi-level marketing / catalog sales company — each brand is limited to one booth
                  slot unless you set a collective approval cap.
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
        <SlotCountInput
          min={singleSlotLocked ? 1 : 0}
          max={singleSlotLocked ? 1 : 100}
          value={limit.maxSlots}
          disabled={singleSlotLocked}
          readOnly={singleSlotLocked}
          onCommit={(n) => updateSlots(limit.categoryId, n)}
          className={cn(
            'h-8 w-full text-center tabular-nums',
            singleSlotLocked && 'cursor-not-allowed bg-muted text-muted-foreground opacity-70'
          )}
          title={singleSlotLocked ? 'Each direct-sales brand is limited to 1 booth slot' : undefined}
          aria-label={`${slotsLabel} for ${displayName}`}
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
              aria-label={`Booth fee for ${displayName}`}
            />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 justify-self-end text-muted-foreground hover:text-red-500"
          onClick={() => removeLimit(limit.categoryId)}
          aria-label={`Remove ${displayName}`}
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
            {slotsLabel}
            <Tooltip>
              <TooltipTrigger type="button">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {isQuarterAuction
                  ? 'How many vendors in this category can apply and bring donation items to auction.'
                  : 'The maximum number of vendors allowed in this category at this event.'}
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
    if (displayLimits.length === 0) return null

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
                  {group.slotSum} / {group.slotSum}{' '}
                  {isQuarterAuction ? 'spots' : 'slots'} assigned
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
              {displayLimits.length} {displayLimits.length === 1 ? 'category' : 'categories'}
            </span>
            <span className="font-bold tabular-nums text-foreground">
              {totalSlots} total {isQuarterAuction ? 'spots' : 'slots'}
            </span>
          </div>
        </div>
      )
    }

    return (
      <div className="overflow-hidden rounded-xl border border-stone-200">
        {renderLimitsHeader()}
        <div className="divide-y divide-stone-200/60">
          {displayLimits.map((limit, index) => renderLimitRow(limit, index))}
        </div>
        <div
          className={cn(
            limitRowGridClass(useUnifiedFee),
            'border-t-2 border-stone-200 bg-canvas text-xs'
          )}
        >
          <span className="font-medium text-muted-foreground">
            {displayLimits.length} {displayLimits.length === 1 ? 'category' : 'categories'}
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
            broad category at 1 slot each
            {maxTotalSlots != null && maxTotalSlots > 0
              ? ` (max ${maxTotalSlots} total on this floor)`
              : ''}
            .
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 gap-1.5"
            onClick={addOneOfEveryCategory}
            disabled={quickStartDisabled}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Add all broad ({Math.min(broadCategories.length, Math.max(0, (maxTotalSlots ?? broadCategories.length) - totalSlots))})
          </Button>
        </div>
      ) : null}

      {allowMlm ? (
        <details
          className="group overflow-hidden rounded-lg border border-dashed border-purple-200/80 bg-card"
          open={showBrandCaps}
          onToggle={(e) => setShowBrandCaps((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 marker:content-none hover:bg-canvas/50 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
              <Label className="cursor-pointer text-xs font-medium text-foreground">
                Advanced: cap specific brands
              </Label>
              <Tooltip>
                <TooltipTrigger type="button">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Limit individual catalog-sales brands (e.g. only one Scentsy booth). Each brand is
                  capped at one slot. Use the direct sales booths control above for a generic count
                  across any brand.
                </TooltipContent>
              </Tooltip>
            </span>
          </summary>
          {mlmBrandCategories.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-purple-200/60 bg-purple-50/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                <strong className="font-semibold text-foreground">Specific brands:</strong> add each
                direct-sales brand at 1 booth slot.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 border-purple-300"
                onClick={addAllMlmBrands}
                disabled={
                  maxTotalSlots != null && maxTotalSlots > 0 && totalSlots >= maxTotalSlots
                }
              >
                <Sparkles className="h-3.5 w-3.5" />
                Add all brands ({mlmBrandCategories.length})
              </Button>
            </div>
          ) : (
            <p className="border-t border-purple-200/60 px-3 py-2 text-xs text-muted-foreground">
              All direct-sales brands are already listed below, or add them one at a time in the
              category slot form.
            </p>
          )}
        </details>
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
              {addCategoryLabel}
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
                  if (cat && allowMlm && isPerBrandMlmSlotLimit(cat)) setSlots(1)
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…">
                    {(value) => {
                      if (!value) return 'Select…'
                      const cat = categories.find((c) => c.id === value)
                      return cat ? coordinatorCategoryDisplayName(cat.name) : 'Select…'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem
                      key={cat.id}
                      value={cat.id}
                      label={coordinatorCategoryDisplayName(cat.name)}
                    >
                      <span className="flex items-center gap-2">
                        {coordinatorCategoryDisplayName(cat.name)}
                        {cat.is_mlm ? (
                          <span className="rounded bg-purple-100 px-1 text-[10px] font-medium text-purple-700">
                            Direct sales
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{slotsLabel}</Label>
              <SlotCountInput
                min={1}
                max={addingMlmLocked ? 1 : 100}
                value={addingMlmLocked ? 1 : slots}
                disabled={addingMlmLocked}
                readOnly={addingMlmLocked}
                onCommit={setSlots}
                className={cn(
                  'h-9 tabular-nums',
                  addingMlmLocked && 'cursor-not-allowed bg-muted text-muted-foreground opacity-70'
                )}
                title={addingMlmLocked ? 'Each direct-sales brand is limited to 1 booth slot' : undefined}
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
