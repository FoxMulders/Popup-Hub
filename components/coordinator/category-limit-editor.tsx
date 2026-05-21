'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import type { Category } from '@/types/database'
import { formatCents } from '@/lib/square/client'

export interface CategoryLimit {
  categoryId: string
  categoryName: string
  maxSlots: number
  pricePerBooth: number
}

interface CategoryLimitEditorProps {
  categories: Category[]
  value: CategoryLimit[]
  onChange: (limits: CategoryLimit[]) => void
  allowMlm?: boolean
}

export function CategoryLimitEditor({ categories, value, onChange, allowMlm = false }: CategoryLimitEditorProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [slots, setSlots] = useState(3)
  const [priceDollars, setPriceDollars] = useState(0)

  const usedCategoryIds = new Set(value.map((v) => v.categoryId))
  const availableCategories = categories.filter(
    (c) => !usedCategoryIds.has(c.id) && (allowMlm || !c.is_mlm)
  )

  function addLimit() {
    const cat = categories.find((c) => c.id === selectedCategoryId)
    if (!cat || slots <= 0) return

    onChange([
      ...value,
      {
        categoryId: cat.id,
        categoryName: cat.name,
        maxSlots: slots,
        pricePerBooth: Math.round(priceDollars * 100),
      },
    ])
    setSelectedCategoryId('')
    setSlots(3)
    setPriceDollars(0)
  }

  function removeLimit(categoryId: string) {
    onChange(value.filter((v) => v.categoryId !== categoryId))
  }

  function updateSlots(categoryId: string, newSlots: number) {
    onChange(value.map((v) => (v.categoryId === categoryId ? { ...v, maxSlots: newSlots } : v)))
  }

  function updatePrice(categoryId: string, dollars: number) {
    onChange(
      value.map((v) =>
        v.categoryId === categoryId ? { ...v, pricePerBooth: Math.round(dollars * 100) } : v
      )
    )
  }

  const totalSlots = value.reduce((sum, v) => sum + v.maxSlots, 0)

  return (
    <div className="space-y-4">
      {/* Existing limits table */}
      {value.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Category</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-600 w-28">Max Slots</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-600 w-32">Booth Fee</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {value.map((limit) => (
                <tr key={limit.categoryId} className="bg-white">
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="font-medium">
                      {limit.categoryName}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={limit.maxSlots}
                      onChange={(e) => updateSlots(limit.categoryId, parseInt(e.target.value) || 1)}
                      className="h-8 text-center w-20 mx-auto"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="relative w-24 mx-auto">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
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
                      className="h-7 w-7 text-gray-400 hover:text-red-500"
                      onClick={() => removeLimit(limit.categoryId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td className="px-4 py-2.5 text-xs text-gray-500 font-medium">
                  {value.length} {value.length === 1 ? 'category' : 'categories'}
                </td>
                <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-700">
                  {totalSlots} total
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add new limit */}
      {availableCategories.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Add Category Slot
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-40 space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={selectedCategoryId} onValueChange={(v) => setSelectedCategoryId(v ?? '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
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
                max={100}
                value={slots}
                onChange={(e) => setSlots(parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs">Fee (USD)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
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
              className="h-9 bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {selectedCategoryId && priceDollars > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Vendors will pay {formatCents(Math.round(priceDollars * 100))} per booth.
            </p>
          )}
        </div>
      )}

      {value.length === 0 && availableCategories.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          All categories have been added.
        </p>
      )}
    </div>
  )
}
