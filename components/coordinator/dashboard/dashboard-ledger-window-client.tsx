'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'
import {
  postFloorplanSync,
  subscribeFloorplanSync,
  type FloorplanMatrixSyncRow,
} from '@/lib/coordinator/floorplan-sync'
import { cn } from '@/lib/utils'

const STATUS_PILL_CLASS: Record<
  keyof typeof BOOTH_STATUS_THEME,
  string
> = {
  unassigned: 'bg-stone-100 text-stone-800 border-stone-200',
  assigned_unpaid: 'bg-amber-100 text-amber-900 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  vip_hold: 'bg-violet-100 text-violet-900 border-violet-200',
}

/**
 * Standalone booth matrix view for native dual-screen mode (secondary window).
 */
export function DashboardLedgerWindowClient() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event')
  const [rows, setRows] = useState<FloorplanMatrixSyncRow[]>([])
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [selectionAnnouncement, setSelectionAnnouncement] = useState('')

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
    const row = rows.find((r) => r.id === selectedBoothId)
    if (!row) return
    setSelectionAnnouncement(
      `Selected booth ${row.label}, ${row.statusLabel}, vendor ${row.vendor}`
    )
  }, [rows, selectedBoothId])

  const handleFocusBooth = useCallback((boothId: string) => {
    setSelectedBoothId(boothId)
    postFloorplanSync({ type: 'focus_booth', source: 'ledger', boothId })
    postFloorplanSync({ type: 'selection', source: 'ledger', boothId })
  }, [])

  return (
    <div className="dashboard-ledger-window flex h-full min-h-0 flex-col bg-stone-50">
      <header className="shrink-0 border-b border-stone-200 bg-white px-3 py-2">
        <h1 className="font-heading text-base font-semibold text-stone-900">
          Booth Matrix — Dual-Screen Mode
        </h1>
        <p className="text-xs text-stone-600">
          {connected
            ? 'Synced with Blueprint Studio canvas'
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
                  className="border-b border-stone-100 hover:bg-emerald-50/50"
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
