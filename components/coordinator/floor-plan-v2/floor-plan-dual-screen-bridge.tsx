'use client'

import { useCallback, useEffect, useMemo } from 'react'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { useCanvasStore } from '@/components/coordinator/floor-plan-v2/state/use-canvas-store'
import {
  BOOTH_STATUS_THEME,
  type BoothPlacementStatus,
} from '@/lib/coordinator/booth-placement-status'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import {
  postFloorplanSync,
  subscribeFloorplanSync,
  type FloorplanMatrixSyncRow,
} from '@/lib/coordinator/floorplan-sync'

type FloorPlanStore = ReturnType<typeof useCanvasStore>

function boothMatrixRowsFromDoc(
  store: FloorPlanStore,
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
): FloorplanMatrixSyncRow[] {
  return store.doc.objects
    .filter(
      (o): o is BoothObject => o.kind === 'booth' && !isGuestTableBooth(o)
    )
    .map((booth) => {
      const status = boothPlacementStatusByObjectId?.get(booth.id) ?? 'unassigned'
      const theme = BOOTH_STATUS_THEME[status]
      return {
        id: booth.id,
        label:
          booth.label ||
          `Booth at ${Math.round(booth.x)}′, ${Math.round(booth.y)}′`,
        vendor: booth.vendorId ? (booth.label ?? 'Assigned vendor') : '—',
        category: booth.categoryName ?? '—',
        status,
        statusLabel: theme.label,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

/**
 * Publishes booth matrix sync for wizard / spatial layout editors so
 * Presenter and Wall Cast windows work outside the command center.
 */
export function FloorPlanDualScreenBridge({
  eventId,
  store,
  boothPlacementStatusByObjectId,
}: {
  eventId: string | null
  store: FloorPlanStore
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
}) {
  const rows = useMemo(
    () => boothMatrixRowsFromDoc(store, boothPlacementStatusByObjectId),
    [boothPlacementStatusByObjectId, store.doc.objects]
  )

  const selectedBoothId = useMemo(() => {
    for (const id of store.selectedIds) {
      if (rows.some((row) => row.id === id)) return id
    }
    return null
  }, [rows, store.selectedIds])

  const publishMatrix = useCallback(() => {
    postFloorplanSync({
      type: 'matrix_sync',
      source: 'canvas',
      eventId,
      rows,
      selectedBoothId,
    })
  }, [eventId, rows, selectedBoothId])

  useEffect(() => {
    publishMatrix()
  }, [publishMatrix])

  useEffect(() => {
    return subscribeFloorplanSync((message) => {
      if (message.source === 'canvas') return
      if (message.type === 'ledger_ready') {
        publishMatrix()
        return
      }
      if (message.type === 'focus_booth') {
        store.setSelection(new Set([message.boothId]))
      }
      if (message.type === 'selection' && message.boothId) {
        store.setSelection(new Set([message.boothId]))
      }
    })
  }, [publishMatrix, store])

  return null
}
