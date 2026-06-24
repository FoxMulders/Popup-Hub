'use client'

import { useMemo } from 'react'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  clearanceBand,
  minVendorBoothClearanceFt,
  type BoothClearanceBand,
} from '@/lib/coordinator/booth-clearance-visual'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'
import { isGuestTableBooth, isTentBooth } from '@/lib/booth-planner/table-shape'
import { vendorUnitLabel } from '@/lib/booth-planner/vendor-unit-types'
import { useMarketManagement } from './market-management-context'

/** Unified reactive booth ledger row — single source for canvas labels and Booth Matrix. */
export interface BoothEntity {
  id: string
  label: string
  width: number
  height: number
  x: number
  y: number
  clearanceState: BoothClearanceBand
  vendorName: string
  productCategory: string
  paymentStatus: keyof typeof BOOTH_STATUS_THEME
  statusLabel: string
  vendorId: string | null
  applicationId: string | null
  unitLabel: string
}

export function useBoothEntities(): BoothEntity[] {
  const {
    floorPlanStore,
    boothStatusByObjectId,
    approvedPool,
  } = useMarketManagement()

  return useMemo(() => {
    if (!floorPlanStore) return []
    const doc = floorPlanStore.doc
    const rooms = doc.rooms ?? []

    return doc.objects
      .filter(
        (o): o is BoothObject => o.kind === 'booth' && !isGuestTableBooth(o)
      )
      .map((booth) => {
        const status = boothStatusByObjectId.get(booth.id) ?? 'unassigned'
        const theme = BOOTH_STATUS_THEME[status]
        const app = booth.vendorId
          ? approvedPool.find((a) => a.vendor_id === booth.vendorId)
          : null
        const vendorName =
          app?.vendorName ?? (booth.vendorId ? 'Assigned vendor' : '—')
        const productCategory = booth.vendorId
          ? (app?.categoryName ?? booth.categoryName ?? '—')
          : 'Unassigned'
        const minFt = minVendorBoothClearanceFt(
          booth,
          doc.objects,
          rooms,
          doc.objectRoom
        )
        const unitLabel = vendorUnitLabel(
          booth.vendorUnitType,
          booth.tableLengthFt,
          null,
          booth.tableShape,
          booth.tablePurpose
        )
        const baseLabel =
          booth.label ||
          `Booth at ${Math.round(booth.x)}′, ${Math.round(booth.y)}′`
        const label =
          isTentBooth(booth) && !baseLabel.toLowerCase().includes('tent')
            ? `${baseLabel} · ${unitLabel}`
            : baseLabel

        return {
          id: booth.id,
          label,
          width: booth.width,
          height: booth.height,
          x: Math.round(booth.x),
          y: Math.round(booth.y),
          clearanceState: clearanceBand(minFt),
          vendorName,
          productCategory,
          paymentStatus: status,
          statusLabel: theme.label,
          vendorId: booth.vendorId ?? null,
          applicationId: app?.id ?? null,
          unitLabel,
        }
      })
      .sort((a, b) => a.y - b.y || a.x - b.x)
  }, [approvedPool, boothStatusByObjectId, floorPlanStore])
}
