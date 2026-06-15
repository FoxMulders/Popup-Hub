/**
 * Native dual-window sync for coordinator dashboard ↔ booth matrix ledger.
 * Uses BroadcastChannel when available (same origin, two browser windows).
 */

import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
import { coordinatorStudioLedgerHref } from '@/lib/coordinator/coordinator-routes'

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
  | {
      type: 'matrix_assign_vendor'
      source: FloorplanSyncSource
      boothId: string
      vendorId: string | null
    }

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

export type DualScreenMode = 'presenter' | 'wall-cast'

const DUAL_SCREEN_WINDOW_NAMES: Record<DualScreenMode, string> = {
  presenter: 'popuphub_dual_presenter',
  'wall-cast': 'popuphub_dual_wall_cast',
}

/** @deprecated Use `openDualScreenWindow` with an explicit mode. */
export function openDualScreenLedgerWindow(eventId: string | null): Window | null {
  return openDualScreenWindow(eventId, 'presenter')
}

export function openDualScreenWindow(
  eventId: string | null,
  mode: DualScreenMode
): Window | null {
  if (typeof window === 'undefined') return null
  const url = coordinatorStudioLedgerHref({
    ...(eventId ? { event: eventId } : {}),
    screen: mode,
  })
  const features =
    mode === 'wall-cast'
      ? 'noopener,noreferrer,width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'
      : 'noopener,noreferrer,width=1024,height=900,menubar=no,toolbar=no,location=no,status=no'
  return window.open(url, DUAL_SCREEN_WINDOW_NAMES[mode], features)
}
