'use client'

import { useMemo } from 'react'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { useMarketManagement } from './market-management-context'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'

export function BoothMatrixA11yTable() {
  const {
    floorPlanStore,
    boothStatusByObjectId,
    approvedPool,
    focusBooth,
    selectedBoothId,
  } = useMarketManagement()

  const rows = useMemo(() => {
    if (!floorPlanStore) return []
    return floorPlanStore.doc.objects
      .filter((o): o is BoothObject => o.kind === 'booth')
      .map((booth) => {
        const status = boothStatusByObjectId.get(booth.id) ?? 'unassigned'
        const theme = BOOTH_STATUS_THEME[status]
        const app = booth.vendorId
          ? approvedPool.find((a) => a.vendor_id === booth.vendorId)
          : null
        return {
          id: booth.id,
          label: booth.label || `Booth at ${Math.round(booth.x)}′, ${Math.round(booth.y)}′`,
          vendor: app?.vendorName ?? (booth.vendorId ? 'Assigned vendor' : '—'),
          category: booth.categoryName ?? app?.categoryName ?? '—',
          status,
          statusLabel: theme.label,
          x: Math.round(booth.x),
          y: Math.round(booth.y),
        }
      })
      .sort((a, b) => a.y - b.y || a.x - b.x)
  }, [approvedPool, boothStatusByObjectId, floorPlanStore])

  if (rows.length === 0) return null

  return (
    <div className="dashboard-booth-matrix-panel border-t border-stone-200 bg-stone-50/90 px-3 py-2 sr-only">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Booth matrix (screen reader)
      </h3>
      <div className="max-h-40 overflow-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <caption className="sr-only">
            Tabular fallback for floor plan booth assignments and payment status
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
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm border"
                      style={{
                        background: BOOTH_STATUS_THEME[row.status].fill,
                        borderColor: BOOTH_STATUS_THEME[row.status].stroke,
                      }}
                      aria-hidden
                    />
                    {row.statusLabel}
                  </span>
                </td>
                <td className="px-2 py-1.5 tabular-nums">
                  {row.x}′ × {row.y}′
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
