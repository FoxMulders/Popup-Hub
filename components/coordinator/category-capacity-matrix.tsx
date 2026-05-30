'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  getCategoryAvailability,
  type CategoryCapacityRow,
} from '@/lib/coordinator/category-capacity-rows'
import {
  rosterForCategory,
  type CategoryRosterApplication,
} from '@/lib/coordinator/category-roster'

interface CategoryCapacityMatrixProps {
  rows: CategoryCapacityRow[]
  applications?: ReadonlyArray<CategoryRosterApplication>
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

function CategoryCapacityCard({
  row,
  selected,
  onSelect,
}: {
  row: CategoryCapacityRow
  selected: boolean
  onSelect: () => void
}) {
  const availability = getCategoryAvailability(row.approvedCount, row.maxSlots)
  const styles = TONE_STYLES[availability.tone]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full flex-col rounded-xl border p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
        styles.card,
        selected && 'ring-2 ring-emerald-500/70'
      )}
    >
      <div className="mb-2 min-h-[2.5rem]">
        <h3
          className={cn(
            'text-[13px] font-semibold leading-snug break-words hyphens-auto sm:text-sm',
            styles.name
          )}
        >
          {row.categoryName}
        </h3>
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

      <div className="mt-auto flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{row.approvedCount}</span>
          <span className="text-muted-foreground"> / {row.maxSlots} filled</span>
        </p>
        <span
          className={cn(
            'shrink-0 self-start rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:self-auto',
            styles.pill
          )}
        >
          {availability.label}
        </span>
      </div>
    </button>
  )
}

function RosterList({
  title,
  people,
  emptyLabel,
}: {
  title: string
  people: { applicationId: string; vendorName: string; waitlistPosition: number | null }[]
  emptyLabel: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {people.map((person) => (
            <li
              key={person.applicationId}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
            >
              <span className="font-medium text-foreground">{person.vendorName}</span>
              {person.waitlistPosition != null ? (
                <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                  #{person.waitlistPosition}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CategoryCapacityMatrix({
  rows,
  applications = [],
}: CategoryCapacityMatrixProps) {
  const [query, setQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) => row.categoryName.toLowerCase().includes(normalized))
  }, [query, rows])

  const selectedRow = useMemo(
    () => rows.find((row) => row.categoryId === selectedCategoryId) ?? null,
    [rows, selectedCategoryId]
  )

  const selectedRoster = useMemo(
    () =>
      selectedCategoryId
        ? rosterForCategory(selectedCategoryId, applications)
        : { signedUp: [], waitlist: [] },
    [applications, selectedCategoryId]
  )

  function openCategory(row: CategoryCapacityRow) {
    setSelectedCategoryId(row.categoryId)
    setSheetOpen(true)
  }

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
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Click a category to see who is signed up and who is on the waitlist.
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
            <CategoryCapacityCard
              key={row.id}
              row={row}
              selected={selectedCategoryId === row.categoryId && sheetOpen}
              onSelect={() => openCategory(row)}
            />
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selectedRow ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedRow.categoryName}</SheetTitle>
                <SheetDescription>
                  {selectedRow.approvedCount} of {selectedRow.maxSlots} booth slots filled ·{' '}
                  {formatBoothPrice(selectedRow.pricePerBooth)} per booth
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <RosterList
                  title={`Signed up (${selectedRoster.signedUp.length})`}
                  people={selectedRoster.signedUp}
                  emptyLabel="No approved vendors in this category yet."
                />
                <RosterList
                  title={`Waitlist (${selectedRoster.waitlist.length})`}
                  people={selectedRoster.waitlist}
                  emptyLabel="No vendors on the waitlist for this category."
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}
