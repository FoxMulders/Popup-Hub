'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'
import {
  postFloorplanSync,
  subscribeFloorplanSync,
  type FloorplanMatrixSyncRow,
} from '@/lib/coordinator/floorplan-sync'
import { cn } from '@/lib/utils'
import { DashboardLedgerViewportGuard } from './dashboard-ledger-viewport-guard'

const STATUS_PILL_CLASS: Record<
  keyof typeof BOOTH_STATUS_THEME,
  string
> = {
  unassigned: 'bg-stone-100 text-stone-800 border-stone-200',
  assigned_unpaid: 'bg-amber-100 text-amber-900 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  vip_hold: 'bg-violet-100 text-violet-900 border-violet-200',
}

const WALL_CAST_ROW_CLASS: Record<
  keyof typeof BOOTH_STATUS_THEME,
  string
> = {
  unassigned: 'bg-stone-800 text-stone-100',
  assigned_unpaid: 'bg-amber-900 text-amber-50',
  paid: 'bg-emerald-900 text-emerald-50',
  vip_hold: 'bg-violet-900 text-violet-50',
}

/**
 * Standalone booth matrix view for native dual-screen mode (secondary window).
 * Presenter — interactive; click a booth to focus it on the canvas.
 * Wall cast — read-only, high-contrast layout for projection on a second display.
 */
export function DashboardLedgerWindowClient() {
  return (
    <DashboardLedgerViewportGuard>
      <DashboardLedgerWindowClientInner />
    </DashboardLedgerViewportGuard>
  )
}

function DashboardLedgerWindowClientInner() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event')
  const screenMode = searchParams.get('screen') === 'wall-cast' ? 'wall-cast' : 'presenter'
  const isWallCast = screenMode === 'wall-cast'
  const [rows, setRows] = useState<FloorplanMatrixSyncRow[]>([])
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedBoothId),
    [rows, selectedBoothId]
  )
  const selectionAnnouncement = selectedRow
    ? `Selected booth ${selectedRow.label}, ${selectedRow.statusLabel}, vendor ${selectedRow.vendor}`
    : ''

  useEffect(() => {
    document.title = isWallCast
      ? 'Wall Cast — Booth Matrix — Popup Hub'
      : 'Presenter — Booth Matrix — Popup Hub'
  }, [isWallCast])

  useEffect(() => {
    postFloorplanSync({ type: 'ledger_ready', source: 'ledger' })
    return subscribeFloorplanSync((message) => {
      if (message.source === 'ledger') return
      if (message.type === 'matrix_sync') {
        if (eventId && message.eventId && message.eventId !== eventId) return
        setRows(message.rows)
        setSelectedBoothId(message.selectedBoothId)
        setConnected(true)
      }
      if (message.type === 'selection') {
        setSelectedBoothId(message.boothId)
      }
    })
  }, [eventId])

  useEffect(() => {
    if (!isWallCast || !selectedRowRef.current) return
    selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isWallCast, selectedBoothId, rows.length])

  const handleFocusBooth = useCallback((boothId: string) => {
    setSelectedBoothId(boothId)
    postFloorplanSync({ type: 'focus_booth', source: 'ledger', boothId })
    postFloorplanSync({ type: 'selection', source: 'ledger', boothId })
  }, [])

  if (isWallCast) {
    return (
      <div
        className="dashboard-ledger-window dashboard-ledger-window--wall-cast flex h-full min-h-0 flex-col bg-stone-950 text-stone-50"
        data-dual-screen-mode="wall-cast"
      >
        <header className="shrink-0 border-b border-stone-700 bg-stone-900 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Booth assignments
            </h1>
            <p className="text-sm font-medium text-stone-400">
              {connected ? 'Live · read-only wall display' : 'Waiting for HubGrid…'}
            </p>
          </div>
        </header>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {selectionAnnouncement}
        </p>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-lg text-stone-400">
              No booths yet. Place booths on the canvas to populate this display.
            </p>
          ) : (
            <table className="w-full table-fixed border-collapse text-left text-base sm:text-lg">
              <caption className="sr-only">
                Floor plan booth assignments for wall display
              </caption>
              <thead className="sticky top-0 z-10">
                <tr className="border-b-2 border-stone-600 bg-stone-900 text-stone-300">
                  <th scope="col" className="w-[18%] px-3 py-2 font-bold uppercase tracking-wide">
                    Booth
                  </th>
                  <th scope="col" className="w-[34%] px-3 py-2 font-bold uppercase tracking-wide">
                    Vendor
                  </th>
                  <th scope="col" className="w-[28%] px-3 py-2 font-bold uppercase tracking-wide">
                    Category
                  </th>
                  <th scope="col" className="w-[20%] px-3 py-2 font-bold uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const selected = selectedBoothId === row.id
                  return (
                    <tr
                      key={row.id}
                      ref={selected ? selectedRowRef : undefined}
                      className={cn(
                        'border-b border-stone-800/80',
                        WALL_CAST_ROW_CLASS[row.status],
                        selected && 'ring-2 ring-inset ring-white/90'
                      )}
                      aria-current={selected ? 'true' : undefined}
                    >
                      <th scope="row" className="px-3 py-2.5 text-xl font-bold tabular-nums sm:text-2xl">
                        {row.label}
                      </th>
                      <td className="truncate px-3 py-2.5 font-medium">{row.vendor}</td>
                      <td className="truncate px-3 py-2.5">{row.category}</td>
                      <td className="px-3 py-2.5 font-semibold">{row.statusLabel}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="dashboard-ledger-window dashboard-ledger-window--presenter flex h-full min-h-0 flex-col bg-stone-50"
      data-dual-screen-mode="presenter"
    >
      <header className="shrink-0 border-b border-stone-200 bg-white px-3 py-2">
        <h1 className="font-heading text-base font-semibold text-stone-900">
          Booth Matrix — Presenter
        </h1>
        <p className="text-xs text-stone-600">
          {connected
            ? 'Click a booth to focus it on the HubGrid canvas'
            : 'Waiting for canvas window…'}
        </p>
      </header>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {selectionAnnouncement}
      </p>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-600">
            No booths yet. Place booths on the canvas window to populate this ledger.
          </p>
        ) : (
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">
              Floor plan booth assignments, categories, and payment status
            </caption>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-stone-200 bg-stone-100/95">
                <th scope="col" className="w-1/4 px-2 py-1.5 font-semibold">
                  Booth
                </th>
                <th scope="col" className="w-1/4 px-2 py-1.5 font-semibold">
                  Vendor
                </th>
                <th scope="col" className="w-1/4 px-2 py-1.5 font-semibold">
                  Category
                </th>
                <th scope="col" className="w-1/4 px-2 py-1.5 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-stone-100 hover:bg-emerald-50/50',
                    selectedBoothId === row.id && 'bg-emerald-50/80'
                  )}
                  aria-current={selectedBoothId === row.id ? 'true' : undefined}
                >
                  <th scope="row" className="px-2 py-1 font-medium">
                    <button
                      type="button"
                      className="rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      onClick={() => handleFocusBooth(row.id)}
                    >
                      {row.label}
                    </button>
                  </th>
                  <td className="truncate px-2 py-1">{row.vendor}</td>
                  <td className="truncate px-2 py-1">{row.category}</td>
                  <td className="px-2 py-1">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                        STATUS_PILL_CLASS[row.status]
                      )}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
