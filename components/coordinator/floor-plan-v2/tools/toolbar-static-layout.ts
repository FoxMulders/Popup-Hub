/**
 * Dashboard (staticLayout) toolbar rows — order and collapsed state.
 */

import type { CanvasToolbarBlockId } from './toolbar-order'

export type CanvasToolbarStaticRowId = 'room' | 'patron' | 'vendor' | 'tools'

export const CANVAS_TOOLBAR_STATIC_ROW_IDS: readonly CanvasToolbarStaticRowId[] = [
  'room',
  'patron',
  'vendor',
  'tools',
] as const

export const STATIC_ROW_BLOCKS: Record<
  CanvasToolbarStaticRowId,
  readonly CanvasToolbarBlockId[]
> = {
  room: ['room'],
  patron: ['patron'],
  vendor: ['vendor'],
  tools: ['primitives', 'history-clipboard', 'view-align', 'utilities'],
}

export const DEFAULT_STATIC_ROW_ORDER: CanvasToolbarStaticRowId[] = [
  'room',
  'patron',
  'vendor',
  'tools',
]

export const STATIC_ROW_LABELS: Record<CanvasToolbarStaticRowId, string> = {
  room: 'Room',
  patron: 'Patron',
  vendor: 'Vendor',
  tools: 'Canvas tools',
}

const ORDER_STORAGE_KEY = 'popup-hub:floor-plan-v2:toolbar-static-order'
const COLLAPSED_STORAGE_KEY = 'popup-hub:floor-plan-v2:toolbar-static-collapsed'

const ROW_SET = new Set<string>(CANVAS_TOOLBAR_STATIC_ROW_IDS)

export function isCanvasToolbarStaticRowId(
  id: string
): id is CanvasToolbarStaticRowId {
  return ROW_SET.has(id)
}

export function getVisibleStaticToolbarRows(ctx: {
  needsRoomFirst: boolean
  showVendor: boolean
  showPatron: boolean
  showRoom: boolean
}): CanvasToolbarStaticRowId[] {
  if (ctx.needsRoomFirst && ctx.showRoom) {
    return ['room']
  }

  const ids: CanvasToolbarStaticRowId[] = []
  if (ctx.showRoom) ids.push('room')
  if (ctx.showPatron) ids.push('patron')
  if (ctx.showVendor) ids.push('vendor')
  ids.push('tools')
  return ids
}

export function normalizeStaticRowOrder(
  saved: readonly string[] | null | undefined,
  visible: readonly CanvasToolbarStaticRowId[]
): CanvasToolbarStaticRowId[] {
  const visibleSet = new Set(visible)
  const seen = new Set<CanvasToolbarStaticRowId>()
  const out: CanvasToolbarStaticRowId[] = []

  if (saved?.length) {
    for (const raw of saved) {
      if (!isCanvasToolbarStaticRowId(raw)) continue
      if (!visibleSet.has(raw) || seen.has(raw)) continue
      seen.add(raw)
      out.push(raw)
    }
  }

  for (const id of visible) {
    if (!seen.has(id)) out.push(id)
  }

  return out
}

export function loadStaticRowOrder(
  visible: readonly CanvasToolbarStaticRowId[]
): CanvasToolbarStaticRowId[] {
  if (typeof window === 'undefined') {
    return normalizeStaticRowOrder(DEFAULT_STATIC_ROW_ORDER, visible)
  }
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return normalizeStaticRowOrder(DEFAULT_STATIC_ROW_ORDER, visible)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return normalizeStaticRowOrder(DEFAULT_STATIC_ROW_ORDER, visible)
    }
    return normalizeStaticRowOrder(parsed as string[], visible)
  } catch {
    return normalizeStaticRowOrder(DEFAULT_STATIC_ROW_ORDER, visible)
  }
}

export function saveStaticRowOrder(
  order: readonly CanvasToolbarStaticRowId[]
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    // best-effort
  }
}

export function clearSavedStaticRowOrder(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ORDER_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export type StaticRowCollapsedState = Record<CanvasToolbarStaticRowId, boolean>

export function defaultStaticRowCollapsed(): StaticRowCollapsedState {
  return {
    room: false,
    patron: false,
    vendor: false,
    tools: false,
  }
}

export function loadStaticRowCollapsed(): StaticRowCollapsedState {
  const defaults = defaultStaticRowCollapsed()
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return defaults
    const record = parsed as Record<string, unknown>
    const out = { ...defaults }
    for (const id of CANVAS_TOOLBAR_STATIC_ROW_IDS) {
      if (typeof record[id] === 'boolean') {
        out[id] = record[id]
      }
    }
    return out
  } catch {
    return defaults
  }
}

export function saveStaticRowCollapsed(
  collapsed: StaticRowCollapsedState
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsed))
  } catch {
    // best-effort
  }
}

export function clearSavedStaticRowCollapsed(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(COLLAPSED_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function clearSavedStaticToolbarLayout(): void {
  clearSavedStaticRowOrder()
  clearSavedStaticRowCollapsed()
}
