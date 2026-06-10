/**
 * Native dual-window sync for coordinator dashboard ↔ booth matrix ledger.
 * Uses BroadcastChannel when available (same origin, two browser windows).
 */

import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'

export const FLOORPLAN_SYNC_CHANNEL = 'floorplan_sync'

export interface FloorplanMatrixSyncRow {
  id: string
  label: string
  vendor: string
  category: string
  status: BoothPlacementStatus
  statusLabel: string
}

export type FloorplanSyncSource = 'canvas' | 'ledger'

export type FloorplanSyncMessage =
  | { type: 'ledger_ready'; source: 'ledger' }
  | { type: 'matrix_sync'; source: FloorplanSyncSource; eventId: string | null; rows: FloorplanMatrixSyncRow[]; selectedBoothId: string | null }
  | { type: 'selection'; source: FloorplanSyncSource; boothId: string | null }
  | { type: 'focus_booth'; source: FloorplanSyncSource; boothId: string }

export function createFloorplanSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null
  }
  try {
    return new BroadcastChannel(FLOORPLAN_SYNC_CHANNEL)
  } catch {
    return null
  }
}

export function postFloorplanSync(message: FloorplanSyncMessage): void {
  const channel = createFloorplanSyncChannel()
  if (!channel) return
  try {
    channel.postMessage(message)
  } finally {
    channel.close()
  }
}

export function subscribeFloorplanSync(
  handler: (message: FloorplanSyncMessage) => void
): () => void {
  const channel = createFloorplanSyncChannel()
  if (!channel) return () => {}

  const onMessage = (event: MessageEvent<FloorplanSyncMessage>) => {
    if (!event.data || typeof event.data !== 'object') return
    handler(event.data)
  }

  channel.addEventListener('message', onMessage)
  return () => {
    channel.removeEventListener('message', onMessage)
    channel.close()
  }
}

export function openDualScreenLedgerWindow(eventId: string | null): Window | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams()
  if (eventId) params.set('event', eventId)
  const url = `/coordinator/dashboard/ledger${params.toString() ? `?${params}` : ''}`
  return window.open(
    url,
    'popuphub_floorplan_ledger',
    'noopener,noreferrer,width=1024,height=900,menubar=no,toolbar=no,location=no,status=no'
  )
}
