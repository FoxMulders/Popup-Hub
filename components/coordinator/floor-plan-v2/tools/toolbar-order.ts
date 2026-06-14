/**
 * Draggable canvas toolbar block ids and persisted order.
 */

export type CanvasToolbarBlockId =
  | 'test-suite'
  | 'optimize'
  | 'arrange-layout'
  | 'primitives'
  | 'history-clipboard'
  | 'view-align'
  | 'vendor'
  | 'vendor-sizes'
  | 'patron'
  | 'room'
  | 'utilities'
  | 'dual-screen'

export const CANVAS_TOOLBAR_BLOCK_IDS: readonly CanvasToolbarBlockId[] = [
  'test-suite',
  'optimize',
  'arrange-layout',
  'primitives',
  'history-clipboard',
  'view-align',
  'vendor',
  'vendor-sizes',
  'patron',
  'room',
  'utilities',
  'dual-screen',
] as const

export const DEFAULT_CANVAS_TOOLBAR_ORDER: CanvasToolbarBlockId[] = [
  'room',
  'patron',
  'vendor',
  'utilities',
  'primitives',
  'history-clipboard',
  'view-align',
  'dual-screen',
]

const STORAGE_KEY = 'popup-hub:floor-plan-v2:toolbar-order'

const BLOCK_SET = new Set<string>(CANVAS_TOOLBAR_BLOCK_IDS)

/** Legacy block ids from pre-split toolbar — expanded on load. */
const LEGACY_BLOCK_EXPANSION: Record<string, readonly CanvasToolbarBlockId[]> = {
  'room-transform': ['room'],
  arrangement: ['vendor', 'patron'],
  'table-size': ['vendor', 'patron'],
}

export function isCanvasToolbarBlockId(id: string): id is CanvasToolbarBlockId {
  return BLOCK_SET.has(id)
}

function expandLegacyBlockId(raw: string): CanvasToolbarBlockId[] {
  if (isCanvasToolbarBlockId(raw)) return [raw]
  return [...(LEGACY_BLOCK_EXPANSION[raw] ?? [])]
}

/** Merge saved order with defaults so new blocks appear without breaking layout. */
export function normalizeToolbarOrder(
  saved: readonly string[] | null | undefined
): CanvasToolbarBlockId[] {
  if (!saved?.length) return [...DEFAULT_CANVAS_TOOLBAR_ORDER]

  const seen = new Set<CanvasToolbarBlockId>()
  const out: CanvasToolbarBlockId[] = []

  for (const raw of saved) {
    for (const id of expandLegacyBlockId(raw)) {
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
  }

  for (const id of DEFAULT_CANVAS_TOOLBAR_ORDER) {
    if (!seen.has(id)) out.push(id)
  }

  return out
}

export function loadToolbarOrder(): CanvasToolbarBlockId[] {
  if (typeof window === 'undefined') return [...DEFAULT_CANVAS_TOOLBAR_ORDER]
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_CANVAS_TOOLBAR_ORDER]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_CANVAS_TOOLBAR_ORDER]
    return normalizeToolbarOrder(parsed as string[])
  } catch {
    return [...DEFAULT_CANVAS_TOOLBAR_ORDER]
  }
}

export function saveToolbarOrder(order: readonly CanvasToolbarBlockId[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // best-effort
  }
}

export function clearSavedToolbarOrder(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
