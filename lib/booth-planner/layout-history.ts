import type { LayoutRoom } from '@/types/database'
import type { FakeVendorInput } from '@/lib/booth-planner/fake-vendors'
import type { TableOrientation } from '@/lib/booth-planner/table-orientation'

export interface PlannerSnapshot {
  rooms: LayoutRoom[]
  activeRoomId: string
  fakeVendors: FakeVendorInput[]
  vendorTableLengths: Record<string, number>
  vendorTableOrientations: Record<string, TableOrientation>
}

export interface LayoutHistoryState {
  past: PlannerSnapshot[]
  future: PlannerSnapshot[]
}

export const MAX_LAYOUT_HISTORY = 50

export function cloneSnapshot(snapshot: PlannerSnapshot): PlannerSnapshot {
  return structuredClone(snapshot)
}

export function pushHistory(
  history: LayoutHistoryState,
  snapshot: PlannerSnapshot
): LayoutHistoryState {
  const past = [...history.past, cloneSnapshot(snapshot)]
  if (past.length > MAX_LAYOUT_HISTORY) past.shift()
  return { past, future: [] }
}

export function undoHistory(
  history: LayoutHistoryState,
  current: PlannerSnapshot
): { history: LayoutHistoryState; snapshot: PlannerSnapshot | null } {
  if (history.past.length === 0) return { history, snapshot: null }
  const previous = history.past[history.past.length - 1]
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [cloneSnapshot(current), ...history.future],
    },
    snapshot: cloneSnapshot(previous),
  }
}

export function redoHistory(
  history: LayoutHistoryState,
  current: PlannerSnapshot
): { history: LayoutHistoryState; snapshot: PlannerSnapshot | null } {
  if (history.future.length === 0) return { history, snapshot: null }
  const next = history.future[0]
  return {
    history: {
      past: [...history.past, cloneSnapshot(current)],
      future: history.future.slice(1),
    },
    snapshot: cloneSnapshot(next),
  }
}
