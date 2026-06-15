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
    right: ['primitives', 'history-clipboard', 'utilities'],
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
  | 'view-setup'
  | 'dual-screen'
  | 'hall-management'
  | 'room-canvas'
  | 'shapes-booths'
  | 'vendor-booths'
  | 'patron-tables'
  | 'alignment-spacing'
  | 'floor-plan-optimize'
  | 'room-controls'
  | 'designer-tools'
  | 'patron-layout'

/** Dashboard toolbar section titles. */
export const LAYOUT_EDITOR_SIDEBAR_HEADERS: Record<
  | 'view-setup'
  | 'dual-screen'
  | 'hall-management'
  | 'shapes-booths'
  | 'vendor-booths'
  | 'patron-tables'
  | 'alignment-spacing',
  string
> = {
  'view-setup': 'VIEW & SETUP',
  'dual-screen': 'DUAL-SCREEN',
  'hall-management': 'HALL MANAGEMENT',
  'shapes-booths': 'SHAPES',
  'vendor-booths': 'VENDOR BOOTHS',
  'patron-tables': 'PATRON TABLES',
  'alignment-spacing': 'ALIGNMENT & SPACING',
}

/** Header row 1 + top strip row 2 section groupings. */
export const DASHBOARD_HEADER_SECTION_IDS: readonly SidebarSectionId[] = [
  'view-setup',
  'dual-screen',
  'hall-management',
] as const

export const DASHBOARD_TOOLSTRIP_SECTION_IDS: readonly SidebarSectionId[] = [
  'vendor-booths',
  'patron-tables',
  'shapes-booths',
  'alignment-spacing',
] as const

export interface SidebarSectionDef {
  id: SidebarSectionId
  header: string
  blocks: readonly CanvasToolbarBlockId[]
}

export interface SidebarSectionsFilter {
  /** When set, only these section ids are returned (in canonical order). */
  includeOnly?: readonly SidebarSectionId[]
  /** Omit these section ids from the result. */
  exclude?: readonly SidebarSectionId[]
}

/** Full-width sidebar blocks — stacked top-to-bottom (no split columns). */
export function getVisibleSidebarSections(
  ctx: {
    needsRoomFirst: boolean
    showRoom: boolean
    showPatron: boolean
    showVendor: boolean
  },
  filter?: SidebarSectionsFilter
): SidebarSectionDef[] {
  const sections: SidebarSectionDef[] = []

  if (ctx.showRoom) {
    sections.push({
      id: 'view-setup',
      header: LAYOUT_EDITOR_SIDEBAR_HEADERS['view-setup'],
      blocks: ['utilities'],
    })
    sections.push({
      id: 'dual-screen',
      header: LAYOUT_EDITOR_SIDEBAR_HEADERS['dual-screen'],
      blocks: ['dual-screen'],
    })
    sections.push({
      id: 'hall-management',
      header: LAYOUT_EDITOR_SIDEBAR_HEADERS['hall-management'],
      blocks: ['room', 'history-clipboard'],
    })
  }

  if (ctx.needsRoomFirst) {
    return applySidebarSectionsFilter(sections, filter)
  }

  if (ctx.showVendor) {
    sections.push({
      id: 'vendor-booths',
      header: LAYOUT_EDITOR_SIDEBAR_HEADERS['vendor-booths'],
      blocks: ['vendor', 'vendor-sizes'],
    })
  }

  if (ctx.showPatron) {
    sections.push({
      id: 'patron-tables',
      header: LAYOUT_EDITOR_SIDEBAR_HEADERS['patron-tables'],
      blocks: ['patron'],
    })
  }

  sections.push({
    id: 'shapes-booths',
    header: LAYOUT_EDITOR_SIDEBAR_HEADERS['shapes-booths'],
    blocks: ['primitives'],
  })

  const alignmentBlocks: CanvasToolbarBlockId[] = [
    'view-align',
    'optimize',
    'test-suite',
  ]
  sections.push({
    id: 'alignment-spacing',
    header: LAYOUT_EDITOR_SIDEBAR_HEADERS['alignment-spacing'],
    blocks: alignmentBlocks,
  })

  return applySidebarSectionsFilter(sections, filter)
}

function applySidebarSectionsFilter(
  sections: SidebarSectionDef[],
  filter?: SidebarSectionsFilter
): SidebarSectionDef[] {
  if (!filter) return sections
  if (filter.includeOnly?.length) {
    const allowed = new Set(filter.includeOnly)
    return sections.filter((s) => allowed.has(s.id))
  }
  if (filter.exclude?.length) {
    const blocked = new Set(filter.exclude)
    return sections.filter((s) => !blocked.has(s.id))
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
    if (section.id === 'floor-plan-optimize') {
      return { ...section, header: 'FLOOR PLAN' }
    }
    return section
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
