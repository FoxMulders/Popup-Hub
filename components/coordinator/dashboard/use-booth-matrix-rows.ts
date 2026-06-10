'use client'

import { useMemo } from 'react'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import { useMarketManagement } from './market-management-context'

export interface BoothMatrixRow {
  id: string
  label: string
  vendor: string
  category: string
  status: keyof typeof BOOTH_STATUS_THEME
  statusLabel: string
  x: number
  y: number
}

export function useBoothMatrixRows(): BoothMatrixRow[] {
  const {
    floorPlanStore,
    boothStatusByObjectId,
    approvedPool,
  } = useMarketManagement()

  return useMemo(() => {
    if (!floorPlanStore) return []
    return floorPlanStore.doc.objects
      .filter(
        (o): o is BoothObject => o.kind === 'booth' && !isGuestTableBooth(o)
      )
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
}
