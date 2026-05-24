'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  getCategoryAvailability,
  type CategoryCapacityRow,
} from '@/lib/coordinator/category-capacity-rows'

interface CategoryCapacityMatrixProps {
  rows: CategoryCapacityRow[]
}

const TONE_STYLES = {
  open: {
    card: 'border-emerald-200 bg-emerald-50/40',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    bar: 'bg-emerald-500',
    name: 'text-foreground',
  },
  low: {
    card: 'border-harvest-200 bg-harvest-50/50',
    pill: 'border-harvest-200 bg-harvest-50 text-harvest-700',
    bar: 'bg-harvest-500',
    name: 'text-foreground',
  },
  full: {
    card: 'border-stone-200 bg-canvas/80',
    pill: 'border-stone-200 bg-stone-100 text-muted-foreground',
    bar: 'bg-stone-300',
    name: 'text-muted-foreground line-through',
  },
} as const

function formatBoothPrice(cents: number): string {
  if (cents <= 0) return 'Free'
  return `$${(cents / 100).toFixed(2)}`
}

function CategoryCapacityCard({ row }: { row: CategoryCapacityRow }) {
  const availability = getCategoryAvailability(row.approvedCount, row.maxSlots)
  const styles = TONE_STYLES[availability.tone]

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md',
        styles.card
      )}
    >
      <div className="mb-2 min-h-[2.5rem]">
        <h3 className={cn('text-sm font-semibold leading-snug', styles.name)}>{row.categoryName}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatBoothPrice(row.pricePerBooth)}</p>
      </div>

      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div
          className={cn('h-full rounded-full transition-all', styles.bar)}
          style={{ width: `${availability.fillPercent}%` }}
          role="progressbar"
          aria-valuenow={row.approvedCount}
          aria-valuemin={0}
          aria-valuemax={row.maxSlots}
          aria-label={`${row.categoryName} capacity`}
        />
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{row.approvedCount}</span>
          <span className="text-muted-foreground"> / {row.maxSlots} filled</span>
        </p>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            styles.pill
          )}
        >
          {availability.label}
        </span>
      </div>
    </article>
  )
}

export function CategoryCapacityMatrix({ rows }: CategoryCapacityMatrixProps) {
  const [query, setQuery] = useState('')

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) => row.categoryName.toLowerCase().includes(normalized))
  }, [query, rows])

  if (rows.length === 0) return null

  const totalSlots = rows.reduce((sum, row) => sum + row.maxSlots, 0)
  const totalApproved = rows.reduce((sum, row) => sum + row.approvedCount, 0)
  const totalAvailable = rows.reduce(
    (sum, row) => sum + getCategoryAvailability(row.approvedCount, row.maxSlots).available,
    0
  )

  return (
    <section className="my-4 space-y-3" aria-label="Category capacity">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Booth capacity by category
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalApproved} of {totalSlots} booths filled · {totalAvailable} open across{' '}
            {rows.length} {rows.length === 1 ? 'category' : 'categories'}
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories..."
            className="h-9 pl-9 text-sm"
            aria-label="Search categories"
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-canvas/50 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No categories match &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredRows.map((row) => (
            <CategoryCapacityCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  )
}
