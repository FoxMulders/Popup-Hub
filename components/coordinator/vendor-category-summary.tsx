'use client'

import type { CategoryVendorSummary } from '@/lib/booth-planner/vendor-category-summary'

interface VendorCategorySummaryProps {
  summaries: CategoryVendorSummary[]
  totalVendors: number
  className?: string
}

export function VendorCategorySummary({
  summaries,
  totalVendors,
  className = '',
}: VendorCategorySummaryProps) {
  if (summaries.length === 0) {
    return (
      <div className={`market-panel p-4 ${className}`}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Vendor types
        </p>
        <p className="text-xs text-muted-foreground">No vendors in this layout yet.</p>
      </div>
    )
  }

  return (
    <div className={`market-panel p-4 space-y-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Vendor types
        </p>
        <p className="text-xs text-muted-foreground">
          {totalVendors} in plan · {summaries.length} {summaries.length === 1 ? 'type' : 'types'}
        </p>
      </div>
      <ul className="space-y-1.5 max-h-72 overflow-y-auto">
        {summaries.map((row) => (
          <li
            key={row.categoryName}
            className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-2.5 py-2 bg-card/50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`shrink-0 h-3.5 w-3.5 rounded border ${row.categoryColor}`}
                aria-hidden
              />
              <span className="text-sm font-medium text-foreground truncate">{row.categoryName}</span>
            </div>
            <div className="shrink-0 text-right">
              <span
                className={`text-sm font-bold ${row.total === 0 ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                {row.total}
              </span>
              {(row.placed > 0 || row.unplaced > 0) && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {row.placed > 0 && `${row.placed} placed`}
                  {row.placed > 0 && row.unplaced > 0 && ' · '}
                  {row.unplaced > 0 && `${row.unplaced} unplaced`}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
