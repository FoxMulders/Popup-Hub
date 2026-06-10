'use client'

import { useEffect } from 'react'
import {
  postFloorplanSync,
  subscribeFloorplanSync,
  type FloorplanMatrixSyncRow,
} from '@/lib/coordinator/floorplan-sync'
import { useMarketManagement } from './market-management-context'
import { useBoothMatrixRows } from './use-booth-matrix-rows'

/**
 * Publishes booth matrix + selection to the dual-screen ledger window;
 * applies focus requests from the ledger back onto the canvas.
 */
export function FloorplanSyncBridge() {
  const rows = useBoothMatrixRows()
  const { selectedEventId, selectedBoothId, focusBooth } = useMarketManagement()

  useEffect(() => {
    const payload: FloorplanMatrixSyncRow[] = rows.map((row) => ({
      id: row.id,
      label: row.label,
      vendor: row.vendor,
      category: row.category,
      status: row.status,
      statusLabel: row.statusLabel,
    }))
    postFloorplanSync({
      type: 'matrix_sync',
      source: 'canvas',
      eventId: selectedEventId,
      rows: payload,
      selectedBoothId,
    })
  }, [rows, selectedBoothId, selectedEventId])

  useEffect(() => {
    return subscribeFloorplanSync((message) => {
      if (message.source === 'canvas') return
      if (message.type === 'focus_booth') {
        focusBooth(message.boothId)
      }
      if (message.type === 'selection' && message.boothId) {
        focusBooth(message.boothId)
      }
    })
  }, [focusBooth])

  return null
}
