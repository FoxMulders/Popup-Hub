'use client'

import { useEffect, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'
import { cn } from '@/lib/utils'
import { useMarketManagement } from './market-management-context'
import { useBoothMatrixRows } from './use-booth-matrix-rows'

const STATUS_PILL_CLASS: Record<
  keyof typeof BOOTH_STATUS_THEME,
  string
> = {
  unassigned: 'bg-stone-100 text-stone-800 border-stone-200',
  assigned_unpaid: 'bg-amber-100 text-amber-900 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  vip_hold: 'bg-violet-100 text-violet-900 border-violet-200',
}

const MATRIX_STORAGE_KEY = 'popup-hub:dashboard:booth-matrix-collapsed'

export function BoothMatrixPanel({
  headerAction,
}: {
  headerAction?: React.ReactNode
}) {
  const rows = useBoothMatrixRows()
  const { focusBooth, selectedBoothId } = useMarketManagement()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [selectionAnnouncement, setSelectionAnnouncement] = useState('')
  const captionId = useId()

  const selectedRow = rows.find((row) => row.id === selectedBoothId)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MATRIX_STORAGE_KEY)
      if (raw === '0') setPanelOpen(false)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(MATRIX_STORAGE_KEY, panelOpen ? '1' : '0')
    } catch {
      // ignore
    }
  }, [panelOpen])

  useEffect(() => {
    if (!selectedRow) return
    setSelectionAnnouncement(
      `Selected booth ${selectedRow.label}, ${selectedRow.statusLabel}, vendor ${selectedRow.vendor}`
    )
  }, [selectedRow])

  if (rows.length === 0) return null

  return (
    <section
      className="dashboard-booth-matrix-panel"
      aria-labelledby={captionId}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          id={captionId}
          className="dashboard-booth-matrix-panel__trigger min-w-0 flex-1"
          aria-expanded={panelOpen}
          aria-controls="booth-matrix-table-region"
          onClick={() => setPanelOpen((open) => !open)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-stone-600 transition-transform',
                !panelOpen && '-rotate-90'
              )}
              aria-hidden
            />
            <span className="truncate text-xs font-bold uppercase tracking-wide text-stone-800">
              Booth matrix
            </span>
            <span className="rounded-full bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-stone-700">
              {rows.length}
            </span>
          </span>
        </button>
        {headerAction ? (
          <div className="relative z-auto shrink-0">{headerAction}</div>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {selectionAnnouncement}
      </p>

      {panelOpen ? (
        <div id="booth-matrix-table-region" className="mt-1 space-y-1">
          {/* Desktop / tablet — single semantic table */}
          <div className="dashboard-booth-matrix-panel__table-wrap hidden md:block">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">
                Floor plan booth assignments, categories, payment status, and coordinates
              </caption>
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100/90">
                  <th scope="col" className="w-[14%] px-2 font-semibold">
                    Booth
                  </th>
                  <th scope="col" className="w-[22%] px-2 font-semibold">
                    Vendor
                  </th>
                  <th scope="col" className="w-[16%] px-2 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="w-[24%] px-2 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="w-[24%] px-2 font-semibold">
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
                    <th scope="row" className="px-2 font-medium">
                      <button
                        type="button"
                        className="rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                        aria-label={`Focus booth ${row.label} on canvas — ${row.statusLabel}`}
                        onClick={() => focusBooth(row.id)}
                      >
                        {row.label}
                      </button>
                    </th>
                    <td className="truncate px-2">{row.vendor}</td>
                    <td className="truncate px-2">{row.category}</td>
                    <td className="px-2">
                      <StatusBadge status={row.status} label={row.statusLabel} />
                    </td>
                    <td className="whitespace-nowrap px-2 tabular-nums text-stone-800">
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
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
                      <dd>
                        <StatusBadge status={row.status} label={row.statusLabel} />
                      </dd>
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
      ) : null}
    </section>
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
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight',
        STATUS_PILL_CLASS[status],
        compact && 'shrink-0 px-1.5'
      )}
    >
      {compact ? label.split(' ')[0] : label}
    </span>
  )
}
