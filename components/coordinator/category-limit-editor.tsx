'use client'

import { useMemo, useState } from 'react'
import { compareCategoryNames } from '@/lib/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, HelpCircle, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Category } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import { TABLE_LENGTH_OPTIONS_FT } from '@/lib/booth-planner/table-space'
import { selectValueOrNull } from '@/lib/wizard/wizard-autosave'
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
  /** Default table length (ft) when market provides tables; booth size = (4' + L + 3') × 4'. */
  tableLengthFt?: number | null
}

interface CategoryLimitEditorProps {
  categories: Category[]
  value: CategoryLimit[]
  onChange: (limits: CategoryLimit[]) => void
  allowMlm?: boolean
  globalMlmCap?: number
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
}: CategoryLimitEditorProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [slots, setSlots] = useState(DEFAULT_NEW_SLOTS)
  const [priceDollars, setPriceDollars] = useState(0)
  const [tableLengthFt, setTableLengthFt] = useState<number | ''>('')

  const usedCategoryIds = new Set(value.map((v) => v.categoryId))
  const availableCategories = useMemo(
    () =>
      categories
        .filter((c) => !usedCategoryIds.has(c.id) && (allowMlm || !c.is_mlm))
        .sort((a, b) => compareCategoryNames(a.name, b.name)),
    [categories, value, allowMlm]
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
        pricePerBooth: Math.round(priceDollars * 100),
        tableLengthFt: tableLengthFt === '' ? null : tableLengthFt,
      },
    ])
    setSelectedCategoryId('')
    setSlots(DEFAULT_NEW_SLOTS)
    setPriceDollars(0)
    setTableLengthFt('')
  }

  function addOneOfEveryCategory() {
    const additions: CategoryLimit[] = availableCategories.map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      maxSlots: 1,
      pricePerBooth: 0,
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

  function updatePrice(categoryId: string, dollars: number) {
    commitLimits(
      value.map((v) =>
        v.categoryId === categoryId ? { ...v, pricePerBooth: Math.round(dollars * 100) } : v
      )
    )
  }

  function updateTableLength(categoryId: string, ft: number | null) {
    commitLimits(
      value.map((v) => (v.categoryId === categoryId ? { ...v, tableLengthFt: ft } : v))
    )
  }

  const totalSlots = value.reduce((sum, v) => sum + v.maxSlots, 0)
  const selectedCat = categories.find((c) => c.id === selectedCategoryId)
  const addingMlmLocked = Boolean(selectedCat && allowMlm && isMlmCategory(selectedCat))

  return (
    <div className="space-y-4">
      {availableCategories.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-canvas/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">Quick start:</strong> add one of every
            category at 1 slot each. Edit and increase any of them after.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={addOneOfEveryCategory}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Add one of every category ({availableCategories.length})
          </Button>
        </div>
      )}

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
                <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground w-28">
                  <span className="inline-flex items-center gap-1">
                    Table (ft)
                    <Tooltip>
                      <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Optional default table length L. Booth space is (4&apos; + L + 3&apos;) × 4&apos; wide.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </th>
                <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground w-32">
                  <span className="inline-flex items-center gap-1">
                    Booth Fee
                    <Tooltip>
                      <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">The amount vendors pay to book a booth in this category. Set to $0 for free events.</TooltipContent>
                    </Tooltip>
                  </span>
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedLimits.map((limit, index) => {
                const singleSlotLocked = allowMlm && isSingleSlotMlmLimit(limit, categories)
                return (
                <tr key={`${limit.categoryId}-${index}`} className="bg-card">
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="font-medium">
                      {limit.categoryName}
                    </Badge>
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
                  <td className="px-4 py-2.5 text-center">
                    <Select
                      value={limit.tableLengthFt != null ? String(limit.tableLengthFt) : 'none'}
                      onValueChange={(v) => {
                        const next = selectValueOrNull(v)
                        if (!next) return
                        updateTableLength(
                          limit.categoryId,
                          next === 'none' ? null : Number(next)
                        )
                      }}
                    >
                      <SelectTrigger className="h-8 w-[88px] mx-auto text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {TABLE_LENGTH_OPTIONS_FT.map((ft) => (
                          <SelectItem key={ft} value={String(ft)}>
                            {ft}&apos;
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="relative w-24 mx-auto">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={(limit.pricePerBooth / 100).toFixed(2)}
                        onChange={(e) => updatePrice(limit.categoryId, parseFloat(e.target.value) || 0)}
                        className="h-8 pl-6 text-right w-full"
                      />
                    </div>
                  </td>
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
                <td colSpan={3} />
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
            <div className="w-24 space-y-1">
              <Label className="text-xs">Table (ft)</Label>
              <Select
                value={tableLengthFt === '' ? 'none' : String(tableLengthFt)}
                onValueChange={(v) => {
                  const next = selectValueOrNull(v)
                  if (!next) return
                  setTableLengthFt(next === 'none' ? '' : Number(next))
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {TABLE_LENGTH_OPTIONS_FT.map((ft) => (
                    <SelectItem key={ft} value={String(ft)}>
                      {ft}&apos;
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button
              type="button"
              onClick={addLimit}
              disabled={!selectedCategoryId || slots <= 0}
              className="h-11 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {selectedCategoryId && priceDollars > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Vendors will pay {formatCents(Math.round(priceDollars * 100))} per booth.
            </p>
          )}
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
