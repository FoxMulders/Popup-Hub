/**
 * Dashboard (staticLayout) toolbar rows — order and collapsed state.
 * Two merged rows maximize canvas height: room+tools, patron+vendor.
 */

import type { CanvasToolbarBlockId } from './toolbar-order'

export type CanvasToolbarStaticRowId = 'room-tools' | 'placement'

/** @deprecated Legacy row ids — migrated on load from localStorage. */
export type LegacyCanvasToolbarStaticRowId =
  | 'room'
  | 'patron'
  | 'vendor'
  | 'tools'

export const CANVAS_TOOLBAR_STATIC_ROW_IDS: readonly CanvasToolbarStaticRowId[] = [
  'room-tools',
  'placement',
] as const

export interface StaticRowSegments {
  left: readonly CanvasToolbarBlockId[]
  right: readonly CanvasToolbarBlockId[]
}

export const STATIC_ROW_SEGMENTS: Record<
  CanvasToolbarStaticRowId,
  StaticRowSegments
> = {
  'room-tools': {
    left: ['room'],
    right: ['primitives', 'history-clipboard', 'view-align', 'utilities'],
  },
  placement: {
    left: ['patron'],
    right: ['vendor'],
  },
}

/** @deprecated Use STATIC_ROW_SEGMENTS — kept for callers that flatten blocks. */
export const STATIC_ROW_BLOCKS: Record<
  CanvasToolbarStaticRowId,
  readonly CanvasToolbarBlockId[]
> = {
  'room-tools': [
    ...STATIC_ROW_SEGMENTS['room-tools'].left,
    ...STATIC_ROW_SEGMENTS['room-tools'].right,
  ],
  placement: [
    ...STATIC_ROW_SEGMENTS.placement.left,
    ...STATIC_ROW_SEGMENTS.placement.right,
  ],
}

export const DEFAULT_STATIC_ROW_ORDER: CanvasToolbarStaticRowId[] = [
  'room-tools',
  'placement',
]

export const STATIC_ROW_LABELS: Record<CanvasToolbarStaticRowId, string> = {
  'room-tools': 'Room & tools',
  placement: 'Patron & vendor',
}

/** Split section titles for merged toolbar rows (sidebar + QA). */
export const STATIC_ROW_HEADERS: Record<
  CanvasToolbarStaticRowId,
  { left: string; right: string }
> = {
  'room-tools': { left: 'Room Controls', right: 'Designer Tools' },
  placement: { left: 'Patron Layout', right: 'Vendor Booths' },
}

export const STATIC_ROW_QA_HEADERS: Record<
  CanvasToolbarStaticRowId,
  { left: string; right: string }
> = {
  'room-tools': { left: 'ROOM CONTROLS', right: 'DESIGNER TOOLS' },
  placement: { left: 'PATRON LAYOUT', right: 'VENDOR BOOTHS' },
}

/** Left-rail sidebar — undo/redo with room; tools + zoom on the right. */
export const SIDEBAR_STATIC_ROW_SEGMENTS: Record<
  CanvasToolbarStaticRowId,
  StaticRowSegments
> = {
  'room-tools': {
    left: ['room'],
    right: ['primitives', 'utilities'],
  },
  placement: {
    left: ['patron'],
    right: ['vendor'],
  },
}

export function getStaticRowSegments(
  rowId: CanvasToolbarStaticRowId,
  sidebarLayout: boolean
): StaticRowSegments {
  return sidebarLayout ? SIDEBAR_STATIC_ROW_SEGMENTS[rowId] : STATIC_ROW_SEGMENTS[rowId]
}

export type SidebarSectionId =
  | 'floor-plan-optimize'
  | 'room-controls'
  | 'designer-tools'
  | 'patron-layout'
  | 'vendor-booths'
  | 'vendor-matches'

export interface SidebarSectionDef {
  id: SidebarSectionId
  header: string
  blocks: readonly CanvasToolbarBlockId[]
}

/** Full-width sidebar blocks — stacked top-to-bottom (no split columns). */
export function getVisibleSidebarSections(ctx: {
  needsRoomFirst: boolean
  showRoom: boolean
  showPatron: boolean
  showVendor: boolean
}): SidebarSectionDef[] {
  const sections: SidebarSectionDef[] = []

  if (ctx.showRoom) {
    sections.push({
      id: 'room-controls',
      header: STATIC_ROW_HEADERS['room-tools'].left,
      blocks: SIDEBAR_STATIC_ROW_SEGMENTS['room-tools'].left,
    })
  }

  if (ctx.needsRoomFirst) {
    return sections
  }

  if (ctx.showPatron || ctx.showVendor) {
    sections.push({
      id: 'floor-plan-optimize',
      header: 'Floor Plan',
      blocks: ['optimize'],
    })
  }

  sections.push({
    id: 'designer-tools',
    header: STATIC_ROW_HEADERS['room-tools'].right,
    blocks: SIDEBAR_STATIC_ROW_SEGMENTS['room-tools'].right,
  })

  if (ctx.showPatron) {
    sections.push({
      id: 'patron-layout',
      header: STATIC_ROW_HEADERS.placement.left,
      blocks: SIDEBAR_STATIC_ROW_SEGMENTS.placement.left,
    })
  }

  if (ctx.showVendor) {
    sections.push({
      id: 'vendor-booths',
      header: STATIC_ROW_HEADERS.placement.right,
      blocks: SIDEBAR_STATIC_ROW_SEGMENTS.placement.right,
    })
    sections.push({
      id: 'vendor-matches',
      header: 'Vendor Matches',
      blocks: [],
    })
  }

  return sections
}

/** QA dashboard — uppercase section titles for the left rail. */
export function getVisibleSidebarSectionsQa(ctx: {
  needsRoomFirst: boolean
  showRoom: boolean
  showPatron: boolean
  showVendor: boolean
}): SidebarSectionDef[] {
  return getVisibleSidebarSections(ctx).map((section) => {
    if (section.id === 'floor-plan-optimize' || section.id === 'vendor-matches') {
      return {
        ...section,
        header: section.id === 'vendor-matches' ? 'VENDOR MATCHES' : 'FLOOR PLAN',
      }
    }
    const headers =
      section.id === 'room-controls' || section.id === 'designer-tools'
        ? STATIC_ROW_QA_HEADERS['room-tools']
        : STATIC_ROW_QA_HEADERS.placement
    const header =
      section.id === 'room-controls' || section.id === 'patron-layout'
        ? headers.left
        : headers.right
    return { ...section, header }
  })
}

const ORDER_STORAGE_KEY = 'popup-hub:floor-plan-v2:toolbar-static-order'
const COLLAPSED_STORAGE_KEY = 'popup-hub:floor-plan-v2:toolbar-static-collapsed'

const ROW_SET = new Set<string>(CANVAS_TOOLBAR_STATIC_ROW_IDS)

export function isCanvasToolbarStaticRowId(
  id: string
): id is CanvasToolbarStaticRowId {
  return ROW_SET.has(id)
}

function migrateLegacyRowId(raw: string): CanvasToolbarStaticRowId | null {
  if (isCanvasToolbarStaticRowId(raw)) return raw
  if (raw === 'room' || raw === 'tools') return 'room-tools'
  if (raw === 'patron' || raw === 'vendor') return 'placement'
  return null
}

export function getStaticRowSegmentVisibility(
  rowId: CanvasToolbarStaticRowId,
  ctx: {
    needsRoomFirst: boolean
    showRoom: boolean
    showPatron: boolean
    showVendor: boolean
  }
): { left: boolean; right: boolean } {
  switch (rowId) {
    case 'room-tools':
      return {
        left: ctx.showRoom,
        right: !ctx.needsRoomFirst,
      }
    case 'placement':
      return {
        left: ctx.showPatron && !ctx.needsRoomFirst,
        right: ctx.showVendor && !ctx.needsRoomFirst,
      }
  }
}

export function getVisibleStaticToolbarRows(ctx: {
  needsRoomFirst: boolean
  showVendor: boolean
  showPatron: boolean
  showRoom: boolean
}): CanvasToolbarStaticRowId[] {
  if (ctx.needsRoomFirst && ctx.showRoom) {
    return ['room-tools']
  }

  const ids: CanvasToolbarStaticRowId[] = ['room-tools']
  if (ctx.showPatron || ctx.showVendor) {
    ids.push('placement')
  }
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
      const id = migrateLegacyRowId(raw)
      if (!id || !visibleSet.has(id) || seen.has(id)) continue
      seen.add(id)
      out.push(id)
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
    'room-tools': false,
    placement: false,
  }
}

function migrateLegacyCollapsed(
  record: Record<string, unknown>
): StaticRowCollapsedState {
  const defaults = defaultStaticRowCollapsed()
  const out = { ...defaults }

  if (typeof record['room-tools'] === 'boolean') {
    out['room-tools'] = record['room-tools']
  } else if (
    typeof record.room === 'boolean' ||
    typeof record.tools === 'boolean'
  ) {
    const room = typeof record.room === 'boolean' ? record.room : false
    const tools = typeof record.tools === 'boolean' ? record.tools : false
    out['room-tools'] = room && tools
  }

  if (typeof record.placement === 'boolean') {
    out.placement = record.placement
  } else if (
    typeof record.patron === 'boolean' ||
    typeof record.vendor === 'boolean'
  ) {
    const patron = typeof record.patron === 'boolean' ? record.patron : false
    const vendor = typeof record.vendor === 'boolean' ? record.vendor : false
    out.placement = patron && vendor
  }

  return out
}

export function loadStaticRowCollapsed(): StaticRowCollapsedState {
  const defaults = defaultStaticRowCollapsed()
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return defaults
    return migrateLegacyCollapsed(parsed as Record<string, unknown>)
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
