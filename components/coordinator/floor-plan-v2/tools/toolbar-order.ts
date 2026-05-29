/**
 * Draggable canvas toolbar block ids and persisted order.
 */

export type CanvasToolbarBlockId =
  | 'primitives'
  | 'history-clipboard'
  | 'view-align'
  | 'arrangement'
  | 'table-size'
  | 'rooms'
  | 'utilities'

export const CANVAS_TOOLBAR_BLOCK_IDS: readonly CanvasToolbarBlockId[] = [
  'primitives',
  'history-clipboard',
  'view-align',
  'arrangement',
  'table-size',
  'rooms',
  'utilities',
] as const

export const DEFAULT_CANVAS_TOOLBAR_ORDER: CanvasToolbarBlockId[] = [
  ...CANVAS_TOOLBAR_BLOCK_IDS,
]

const STORAGE_KEY = 'popup-hub:floor-plan-v2:toolbar-order'

const BLOCK_SET = new Set<string>(CANVAS_TOOLBAR_BLOCK_IDS)

export function isCanvasToolbarBlockId(id: string): id is CanvasToolbarBlockId {
  return BLOCK_SET.has(id)
}

/** Merge saved order with defaults so new blocks appear without breaking layout. */
export function normalizeToolbarOrder(
  saved: readonly string[] | null | undefined
): CanvasToolbarBlockId[] {
  if (!saved?.length) return [...DEFAULT_CANVAS_TOOLBAR_ORDER]

  const seen = new Set<CanvasToolbarBlockId>()
  const out: CanvasToolbarBlockId[] = []

  for (const raw of saved) {
    if (!isCanvasToolbarBlockId(raw) || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
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
