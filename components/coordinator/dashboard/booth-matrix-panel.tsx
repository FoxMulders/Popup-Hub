'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'
import { cn } from '@/lib/utils'
import { useMarketManagement } from './market-management-context'
import { useBoothMatrixRows } from './use-booth-matrix-rows'

export function BoothMatrixPanel() {
  const rows = useBoothMatrixRows()
  const { focusBooth, selectedBoothId } = useMarketManagement()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (rows.length === 0) return null

  return (
    <div className="dashboard-booth-matrix-panel border-t border-stone-200 bg-stone-50/90 px-3 py-2">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Booth matrix
      </h3>

      {/* Desktop / tablet — tabular layout */}
      <div className="hidden max-h-40 overflow-auto rounded-lg border border-stone-200 bg-white md:block">
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <caption className="sr-only">
            Floor plan booth assignments, categories, payment status, and coordinates
          </caption>
          <thead>
            <tr className="border-b border-stone-200 bg-stone-100/80">
              <th scope="col" className="px-2 py-1.5 font-semibold">
                Booth
              </th>
              <th scope="col" className="px-2 py-1.5 font-semibold">
                Vendor
              </th>
              <th scope="col" className="px-2 py-1.5 font-semibold">
                Category
              </th>
              <th scope="col" className="px-2 py-1.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-2 py-1.5 font-semibold">
                Coordinates (ft)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-stone-100 hover:bg-emerald-50/50 focus-within:bg-emerald-50/70"
                aria-current={selectedBoothId === row.id ? 'true' : undefined}
              >
                <th scope="row" className="px-2 py-1.5 font-medium">
                  <button
                    type="button"
                    className="rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    aria-label={`Focus booth ${row.label} on canvas — ${row.statusLabel}`}
                    onClick={() => focusBooth(row.id)}
                  >
                    {row.label}
                  </button>
                </th>
                <td className="px-2 py-1.5">{row.vendor}</td>
                <td className="px-2 py-1.5">{row.category}</td>
                <td className="px-2 py-1.5">
                  <StatusBadge status={row.status} label={row.statusLabel} />
                </td>
                <td className="px-2 py-1.5 tabular-nums">
                  {row.x}′ × {row.y}′
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — accordion rows */}
      <div className="flex flex-col gap-1 md:hidden">
        {rows.map((row) => {
          const expanded = expandedId === row.id
          return (
            <div
              key={row.id}
              className="overflow-hidden rounded-lg border border-stone-200 bg-white"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium"
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : row.id)}
              >
                <StatusBadge status={row.status} label={row.statusLabel} compact />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    expanded && 'rotate-180'
                  )}
                  aria-hidden
                />
              </button>
              {expanded ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-stone-100 px-3 py-2.5 text-xs">
                  <dt className="font-semibold text-muted-foreground">Vendor</dt>
                  <dd>{row.vendor}</dd>
                  <dt className="font-semibold text-muted-foreground">Category</dt>
                  <dd>{row.category}</dd>
                  <dt className="font-semibold text-muted-foreground">Status</dt>
                  <dd>{row.statusLabel}</dd>
                  <dt className="font-semibold text-muted-foreground">Coordinates</dt>
                  <dd className="tabular-nums">
                    {row.x}′ × {row.y}′
                  </dd>
                  <dt className="sr-only">Actions</dt>
                  <dd>
                    <button
                      type="button"
                      className="font-medium text-forest underline-offset-2 hover:underline"
                      onClick={() => focusBooth(row.id)}
                    >
                      Focus on canvas
                    </button>
                  </dd>
                </dl>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  label,
  compact,
}: {
  status: keyof typeof BOOTH_STATUS_THEME
  label: string
  compact?: boolean
}) {
  const theme = BOOTH_STATUS_THEME[status]
  return (
    <span className={cn('inline-flex items-center gap-1', compact && 'shrink-0')}>
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm border"
        style={{
          background: theme.fill,
          borderColor: theme.stroke,
        }}
        aria-hidden
      />
      {!compact ? label : null}
    </span>
  )
}
