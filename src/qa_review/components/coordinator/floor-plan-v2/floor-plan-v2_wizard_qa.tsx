'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  DEFAULT_TABLE_SIZE,
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { createClient } from '@/lib/supabase/client'
import { persistLayoutDraft } from '@/lib/wizard/wizard-autosave'
import { layoutPayloadFromRooms } from '@/lib/booth-planner/layout-rooms'
import { cn } from '@/lib/utils'
import { LayoutCanvasWizardQa } from '@/src/qa_review/components/coordinator/floor-plan-v2/canvas/floor-plan-canvas-wizard_qa'
import { canvasGridSpacingForTableFt } from '@/components/coordinator/floor-plan-v2/canvas/canvas-grid-spacing'
import { CanvasLegend } from '@/components/coordinator/floor-plan-v2/canvas/canvas-legend'
import { unionActiveRoomBounds } from '@/components/coordinator/floor-plan-v2/canvas/canvas-engine'
import { focusFloorPlanCanvas } from '@/components/coordinator/floor-plan-v2/canvas/canvas-focus'
import { DiagnosticSidebar } from '@/components/coordinator/floor-plan-v2/debug/diagnostic-sidebar'
import { PlacesApiStatusProvider } from '@/components/coordinator/floor-plan-v2/debug/places-api-status-context'
import { FullscreenLayout } from '@/components/coordinator/floor-plan-v2/canvas/fullscreen-layout'
import { DebugLogProvider, useDebugLog } from '@/components/coordinator/floor-plan-v2/debug/debug-log-context'
import { serializeRooms } from '@/components/coordinator/floor-plan-v2/debug/format-geometry-log'
import type { ViewportApi } from '@/components/coordinator/floor-plan-v2/canvas/use-viewport'
import { PropertyInspector } from '@/components/coordinator/floor-plan-v2/inspector/property-inspector'
import { CanvasCommandBar } from '@/components/coordinator/floor-plan-v2/tools/canvas-command-bar'
import { DEFAULT_TOOL_STATE, type DrawShape, type ToolId } from '@/components/coordinator/floor-plan-v2/tools/types'
import { autoArrangeInRoom, type AutoArrangeMode } from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import { legacyRoomsFromDoc } from '@/components/coordinator/floor-plan-v2/state/legacy-bridge'
import { hydrateFloorPlanDocForWizardQa } from '@/src/qa_review/lib/floor-plan/layout-hydration-wizard_qa'
import { reconcileCanvasExtents } from '@/components/coordinator/floor-plan-v2/state/room-canvas'
import {
  clearMultiRoomDraft,
  saveMultiRoomDraft,
} from '@/components/coordinator/floor-plan-v2/state/local-draft'
import {
  docNeedsGeometrySanitize,
  forceRecomputeGeometry,
} from '@/components/coordinator/floor-plan-v2/state/geometry-sanitize'
import { useCanvasStoreWizardQa } from '@/src/qa_review/components/coordinator/floor-plan-v2/use-canvas-store-wizard_qa'
import { CanvasRootErrorBoundary } from '@/components/coordinator/floor-plan-v2/canvas/canvas-root-error-boundary'
import {
  DEFAULT_TOUCH_EPSILON_FT,
  isJoinableObject,
  mixedNeighborsOf,
  objectFrameOverlapsOrTouches,
  roomIdsFormConnectedComponent,
} from '@/components/coordinator/floor-plan-v2/state/room-joins'
import { isMergeUnionEligible } from '@/components/coordinator/floor-plan-v2/state/merge-selection-union'
import { vendorTableMetaFromApplications } from '@/lib/booth-planner/table-booth-consolidation'
import { planTableSizeChange } from '@/components/coordinator/floor-plan-v2/state/table-size-selection'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from '@/components/coordinator/floor-plan-v2/state/types'
import { nextCategoryName } from '@/components/coordinator/floor-plan-v2/canvas/category-palette'
import {
  aabbFitsCanvas,
  alignSelectionPatches,
  canvasClampDelta,
  detectPlacedObjectOverlaps,
  groupCanvasClampDelta,
  groupRotatedAabb,
  rotatedAabb,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import type { BoothLayout, LayoutRoom } from '@/types/database'
import type { LayoutRoomPresetId } from '@/lib/booth-planner/layout-room-presets'
import type { FloorPlanDocStore } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
import { useCommandCenterFullscreen } from '@/components/coordinator/dashboard/command-center-fullscreen-context'

/** Step (in degrees) per click of the rotate +/- toolbar buttons. */
const ROTATE_STEP_DEG = 15

function joinableObjectsOverlapAnyRoom(
  objects: ReadonlyArray<PlacedObject>,
  frames: ReadonlyArray<RoomFrame>
): boolean {
  for (const obj of objects) {
    if (!isJoinableObject(obj)) continue
    for (const frame of frames) {
      if (objectFrameOverlapsOrTouches(obj, frame)) return true
    }
  }
  return false
}

/**
 * Clipboard entry — every selected object is captured as a kind-typed
 * deep clone of all its properties *except* `id`. The id is regenerated
 * fresh on every paste so duplicates don't collide with the original
 * (or with each other on multi-paste).
 *
 * `originX/originY` are the bounding-box top-left of the entire
 * selection at copy-time. `relX/relY` are this object's offset from
 * that origin. Together they let us paste a multi-object selection as
 * a group, preserving the relative geometry. `roomId` is captured so
 * pasted objects land back in the same parent `LayoutRoom` they came
 * from on the unified canvas.
 */
type ClipboardEntry = {
  template: Omit<PlacedObject, 'id'>
  relX: number
  relY: number
  roomId: string | null
}

interface ClipboardSnapshot {
  entries: ClipboardEntry[]
  originX: number
  originY: number
  /** How many times we've already pasted this snapshot. */
  pasteCount: number
}

/** Step (in feet) added to each successive paste so duplicates don't stack. */
const PASTE_OFFSET_FT = 2

export interface FloorPlanV2Props {
  eventId: string | null | undefined
  /** Active LayoutRoom from the wizard. Used as a save seam only. */
  layoutRooms: LayoutRoom[]
  layoutActiveRoomId: string
  onLayoutRoomsChange: (rooms: LayoutRoom[], activeRoomId: string) => void
  /**
   * Wizard-owned save callback ref. Step 3 "Save & Continue" calls
   * `saveLayoutRef.current()`; we install a v2-aware projection that
   * writes the doc through `persistLayoutDraft`.
   */
  saveLayoutRef?: MutableRefObject<(() => Promise<boolean>) | null>
  /**
   * Sorted list of category names defined on this event (Step 2 of
   * the wizard). Forwarded to the booth property inspector so the
   * Category field renders as a dropdown of these names instead of
   * free-form text.
   */
  eventCategoryNames?: string[]
  /**
   * Wizard-owned room mutation callbacks. Forwarded to the in-canvas
   * Rooms sidebar so coordinators can add / rename / delete rooms
   * without leaving the floor-plan workspace. The rooms bar that used
   * to live above the canvas was retired in favour of this sidebar.
   */
  onAddRoom?: (presetId?: LayoutRoomPresetId) => void
  onRenameRoom?: (roomId: string, name: string) => void
  onDeleteRoom?: (roomId: string) => void
  /**
   * Wizard-owned baseline table length for the active room (one
   * size per hall). The toolbar pill above the canvas binds to this
   * — when omitted, the pill hides and live booth rescaling is
   * skipped. Forwarding both fields keeps Step 3 the single source
   * of truth for table sizing now that the Step 2 selector has been
   * retired.
   */
  baselineTableLengthFt?: LayoutBaselineTableLengthFt
  onBaselineTableLengthChange?: (ft: LayoutBaselineTableLengthFt) => void
  /**
   * Hard structural booth ceiling from Step 2 — already accounts
   * for walking aisles and emergency fire paths via the
   * `WALKING_AISLE_RESERVE_RATIO` deduction in
   * `calculateNetUsableFloorSpace`. Forwarded to Auto-Arrange so it
   * never lays out more booths than the venue can safely host.
   */
  layoutCapacity?: number
  /**
   * Approved vendor applications — used to read `table_count` when
   * consolidating multi-table booths during Auto-Arrange.
   */
  applications?: ReadonlyArray<{
    id: string
    vendor_id?: string
    table_count?: number
    status?: string
  }>
  className?: string
  /** Notifies the host when the layout has unresolved object overlaps. */
  onOverlapChange?: (hasOverlap: boolean) => void
  /** Wizard Step 3 — triggers save + deploy from the top ribbon. */
  onSaveMarket?: () => void
  saveMarketDisabled?: boolean
  saveMarketLoading?: boolean
  /** Dashboard embed — compact chrome, telemetry-driven booth fills. */
  variant?: 'wizard' | 'dashboard'
  /**
   * When `embedded`, the parent layout shell owns top chrome and the
   * room rail — hide the internal "Layout tools" header and keep rooms
   * out of the command bar.
   */
  chrome?: 'default' | 'embedded'
  /** Fired when the number of placed canvas objects changes. */
  onPlacedCountChange?: (count: number) => void
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
  onStoreReady?: (store: FloorPlanDocStore | null) => void
  onSelectionChange?: (store: FloorPlanDocStore) => void
  onVendorDrop?: (applicationId: string, canvasX: number, canvasY: number) => void
  /**
   * Floating geometry debug console (rooms, merges, placement).
   * Side geometry diagnostic panel — off by default.
   */
  debugGeometry?: boolean
  /**
   * Standalone layout route — hydrate from server/project rooms only and
   * clear the multi-room localStorage draft (avoids stale merged_zone masks).
   */
  preferServerLayout?: boolean
  /** Wizard QA — when editing a market with saved layout geometry on server. */
  existingLayout?: BoothLayout | null
}

/**
 * Floor Plan v2 — the unified multi-room canvas surface.
 *
 * Architecture:
 *   - Every `LayoutRoom` from the wizard is projected onto a single
 *     `FloorPlanDoc` whose `objects` array carries every booth /
 *     wall / door / stage / label across every room, all in
 *     *global* canvas coordinates. Each object is tagged via
 *     `doc.objectRoom[id] → roomId` so saves can split the unified
 *     edit back into per-room cells + venue elements.
 *   - Room frames live in `doc.rooms` and render below the objects
 *     on the canvas. Clicking a frame's perimeter stroke selects the
 *     room and drags translate the frame *and* every child object
 *     atomically (single history step).
 *   - Adjacent perimeter walls auto-merge: when two rooms touch
 *     within 0.5 ft, the shared wall segment is suppressed at render
 *     time so the rooms read as a single combined interior.
 */
/** Wizard Step 3 floor plan — blank load, no stale draft, no auto Main Hall seed. */
export function FloorPlanV2WizardQa(props: FloorPlanV2Props) {
  const debugGeometry = props.debugGeometry ?? false
  return (
    <DebugLogProvider>
      <PlacesApiStatusProvider>
        <FloorPlanV2Workspace {...props} debugGeometry={debugGeometry} />
      </PlacesApiStatusProvider>
    </DebugLogProvider>
  )
}

/** @deprecated Use FloorPlanV2WizardQa — alias for drop-in wiring. */
export const FloorPlanV2 = FloorPlanV2WizardQa

function FloorPlanV2Workspace({
  eventId,
  layoutRooms,
  layoutActiveRoomId,
  onLayoutRoomsChange,
  saveLayoutRef,
  eventCategoryNames,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  baselineTableLengthFt,
  onBaselineTableLengthChange,
  layoutCapacity,
  applications,
  className,
  onOverlapChange,
  onSaveMarket,
  saveMarketDisabled,
  saveMarketLoading,
  variant = 'wizard',
  chrome = 'default',
  onPlacedCountChange,
  boothPlacementStatusByObjectId,
  onStoreReady,
  onSelectionChange,
  onVendorDrop,
  debugGeometry = false,
  existingLayout = null,
}: FloorPlanV2Props) {
  const isWizardVariant = variant === 'wizard'
  const initialDoc = useMemo<FloorPlanDoc>(
    () =>
      hydrateFloorPlanDocForWizardQa(eventId, layoutRooms, {
        existingLayout: isWizardVariant ? existingLayout : null,
        hydrateSavedObjects: isWizardVariant && Boolean(existingLayout),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const store = useCanvasStoreWizardQa(initialDoc, eventId ?? undefined)
  const { addLog, logState } = useDebugLog()

  const docRoomsKey = useMemo(
    () => serializeRooms(store.doc),
    [store.doc.rooms]
  )
  const prevDocRoomsKeyRef = useRef(docRoomsKey)
  useEffect(() => {
    if (prevDocRoomsKeyRef.current === docRoomsKey) return
    prevDocRoomsKeyRef.current = docRoomsKey
    addLog(
      `doc.rooms updated (${store.doc.rooms?.length ?? 0} frames): ${docRoomsKey}`
    )
  }, [addLog, docRoomsKey, store.doc.rooms?.length])

  useEffect(() => {
    addLog('Geometry debug console ready.')
  }, [addLog])
  const isDashboard = variant === 'dashboard'
  const isEmbedded = chrome === 'embedded'
  const commandCenterFullscreen = useCommandCenterFullscreen()

  // Wizard Step 3: drop stale multi-room localStorage on mount (hydration also clears).
  useEffect(() => {
    if (eventId) clearMultiRoomDraft(eventId)
  }, [eventId])

  useEffect(() => {
    onStoreReady?.(store)
    return () => onStoreReady?.(null)
  }, [onStoreReady, store])

  useEffect(() => {
    onSelectionChange?.(store)
  }, [onSelectionChange, store, store.selectedIds])
  const layoutOverlaps = useMemo(
    () =>
      detectPlacedObjectOverlaps(store.doc.objects, {
        rooms: store.doc.rooms ?? [],
      }),
    [store.doc.objects, store.doc.rooms]
  )
  useEffect(() => {
    onOverlapChange?.(layoutOverlaps.size > 0)
  }, [layoutOverlaps.size, onOverlapChange])
  const [tool, setTool] = useState<ToolId>(DEFAULT_TOOL_STATE.tool)
  const [drawShape, setDrawShape] = useState<DrawShape>(
    DEFAULT_TOOL_STATE.drawShape
  )
  const [autoArrangeMode, setAutoArrangeMode] = useState<AutoArrangeMode>(
    isDashboard ? 'perimeter-only' : 'grid'
  )
  const [rightInspectorOpen, setRightInspectorOpen] = useState(!isDashboard)
  const [showLabels, setShowLabels] = useState(true)

  // Wizard Step 3 QA: do not project sidebar `layoutRooms` onto the canvas
  // doc on mount — that injected structural room outlines and blocked open-grid
  // placement when room polygons did not match the interactive surface.

  // The "active room" follows the wizard's `layoutActiveRoomId` so
  // sidebar selections in the parent flow keep working. Selection of
  // a room *frame* on the canvas (the new "click the wall to drag
  // the room" gesture) is a separate piece of state — we only mark
  // a frame as the canvas selection while the user is interacting
  // with it.
  const activeRoomId = layoutActiveRoomId
  const [rawSelectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(
    () => new Set()
  )
  // Drop the canvas-side room selection if the underlying room was
  // deleted by the sidebar — otherwise the chrome would point at a
  // ghost. Derived inline (rather than synced via useEffect) so we
  // don't trigger an extra render on every rooms-list change.
  const selectedRoomId = useMemo(() => {
    if (!rawSelectedRoomId) return null
    return layoutRooms.some((r) => r.id === rawSelectedRoomId)
      ? rawSelectedRoomId
      : null
  }, [layoutRooms, rawSelectedRoomId])

  const layoutRoomIdsKey = useMemo(
    () => layoutRooms.map((r) => r.id).join('|'),
    [layoutRooms]
  )
  const prevActiveRoomRef = useRef(activeRoomId)
  const prevLayoutRoomIdsRef = useRef(layoutRoomIdsKey)
  const viewportApiRef = useRef<ViewportApi | null>(null)

  const recoverCanvasFocus = useCallback(() => {
    focusFloorPlanCanvas()
  }, [])

  const resetCanvasViewport = useCallback(() => {
    viewportApiRef.current?.resetViewport()
    focusFloorPlanCanvas()
  }, [])
  // New rooms become the active room in the sidebar but did not set
  // canvas selection — without this, resize handles never appear.
  useEffect(() => {
    const activeChanged = prevActiveRoomRef.current !== activeRoomId
    const idsChanged = prevLayoutRoomIdsRef.current !== layoutRoomIdsKey
    prevActiveRoomRef.current = activeRoomId
    prevLayoutRoomIdsRef.current = layoutRoomIdsKey
    if (!activeChanged && !idsChanged) return
    if (!activeRoomId) return
    if (!layoutRooms.some((r) => r.id === activeRoomId)) return
    setSelectedRoomId(activeRoomId)
    setSelectedRoomIds(new Set([activeRoomId]))
  }, [activeRoomId, layoutRoomIdsKey, layoutRooms])

  const hardResetCanvas = useCallback(() => {
    if (eventId) clearMultiRoomDraft(eventId)
    store.resetState()
    setSelectedRoomIds(new Set())
    setSelectedRoomId(null)
    resetCanvasViewport()
    logState('hardResetCanvas(): blank canvas — auto Main Hall disabled for session')
  }, [eventId, logState, resetCanvasViewport, store])

  useEffect(() => {
    if (!docNeedsGeometrySanitize(store.doc)) return
    const sanitized = forceRecomputeGeometry(store.doc)
    store.patchDoc({ rooms: sanitized.rooms }, { pushHistory: false })
    store.replaceObjects(sanitized.objects, { pushHistory: false })
    logState('forceRecomputeGeometry(): sanitized malformed room/merged_zone paths')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wizard Step 3: no auto Main Hall seed — coordinator adds rooms or uses Step 1 frames.

  const highlightedRoomId = selectedRoomId ?? activeRoomId
  const highlightedRoomMetrics = useMemo(() => {
    const frame = (store.doc.rooms ?? []).find((r) => r.id === highlightedRoomId)
    if (!frame) return null
    return {
      name: frame.name,
      widthFt: frame.widthFt,
      lengthFt: frame.lengthFt,
    }
  }, [store.doc.rooms, highlightedRoomId])

  // Validated copy of the wizard-owned baseline table length. The
  // command-bar pill binds to this; upstream the value comes from
  // `activeRoom.baseline_table_length_ft` so the ribbon always
  // reflects the active room's size. Unrecognised lengths fall back
  // to the default rather than blowing up the selector. When the
  // wizard hasn't supplied a value at all we still pre-select 6′
  // so the pill is operational on first paint and any drag-time
  // booth math has a real footprint to scale against — coordinators
  // never see an empty / undefined baseline.
  const safeTableSizeFt = useMemo<LayoutBaselineTableLengthFt>(() => {
    if (baselineTableLengthFt != null && isLayoutBaselineTableLengthFt(baselineTableLengthFt)) {
      return baselineTableLengthFt
    }
    return DEFAULT_TABLE_SIZE
  }, [baselineTableLengthFt])

  // Footprint for the next booth draw — synced to venue baseline (Section 2).
  const [defaultPlacementSizeFt, setDefaultPlacementSizeFt] =
    useState<LayoutBaselineTableLengthFt>(safeTableSizeFt)

  useEffect(() => {
    setDefaultPlacementSizeFt(safeTableSizeFt)
    const grid = canvasGridSpacingForTableFt(safeTableSizeFt)
    store.patchDoc(
      { gridSpacingFt: grid.minorFt, snapFt: grid.minorFt },
      { pushHistory: false }
    )
  }, [safeTableSizeFt, store])

  const tableSizePillValue = useMemo<LayoutBaselineTableLengthFt>(() => {
    const selected = Array.from(store.selectedIds)
    if (selected.length !== 1) return defaultPlacementSizeFt
    const obj = store.doc.objects.find((o) => o.id === selected[0])
    if (obj?.kind !== 'booth') return defaultPlacementSizeFt
    const booth = obj as BoothObject
    if (
      booth.tableLengthFt != null &&
      isLayoutBaselineTableLengthFt(booth.tableLengthFt)
    ) {
      return booth.tableLengthFt
    }
    const longEdge = Math.max(booth.width, booth.height)
    if (isLayoutBaselineTableLengthFt(longEdge)) return longEdge
    return defaultPlacementSizeFt
  }, [store.selectedIds, store.doc.objects, defaultPlacementSizeFt])

  const handleTableSizeChange = useCallback(
    (ft: LayoutBaselineTableLengthFt) => {
      const { objectPatches, nextDefaultPlacementSizeFt } = planTableSizeChange({
        objects: store.doc.objects,
        selectedIds: store.selectedIds,
        ft,
      })
      if (objectPatches.length > 0) {
        store.updateObjects(objectPatches)
        return
      }
      if (nextDefaultPlacementSizeFt != null) {
        setDefaultPlacementSizeFt(nextDefaultPlacementSizeFt)
        onBaselineTableLengthChange?.(nextDefaultPlacementSizeFt)
        const grid = canvasGridSpacingForTableFt(nextDefaultPlacementSizeFt)
        store.patchDoc(
          { gridSpacingFt: grid.minorFt, snapFt: grid.minorFt },
          { pushHistory: false }
        )
      }
    },
    [store, onBaselineTableLengthChange]
  )

  // Crash-recovery autosave: every doc commit lands a serialized
  // snapshot of the unified multi-room doc in localStorage. Debounced
  // to 250ms so a continuous gesture doesn't hammer storage; cleared
  // whenever the wizard's server save succeeds (see saveLayoutRef
  // wiring below).
  useEffect(() => {
    if (!eventId) return
    const id = window.setTimeout(() => {
      saveMultiRoomDraft(eventId, store.doc)
    }, 250)
    return () => window.clearTimeout(id)
  }, [eventId, store.doc])

  const handleToolChange = useCallback((next: ToolId) => {
    setTool(next)
  }, [])

  const handleDrawShapeChange = useCallback((next: DrawShape) => {
    setDrawShape(next)
  }, [])

  const handleClearAll = useCallback(() => {
    hardResetCanvas()
    toast.success('Canvas cleared — draw or add a room to continue')
  }, [hardResetCanvas])

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(store.selectedIds)
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const selectedObjects = store.doc.objects.filter((o) => idSet.has(o.id))
    if (selectedObjects.length === 0) return
    const lockedSelected = selectedObjects.filter((o) => o.locked === true)
    const removable = selectedObjects.filter((o) => o.locked !== true)
    if (removable.length === 0) {
      if (lockedSelected.length > 0) {
        toast.message(
          'Selection is locked. Unlock to delete.',
          { duration: 1500 }
        )
      }
      return
    }
    store.removeObjects(removable.map((o) => o.id))
    if (lockedSelected.length > 0) {
      toast.message(
        `Locked fixtures retained (${lockedSelected.length}).`,
        { duration: 1500 }
      )
    }
  }, [store])

  /**
   * Clipboard for copy/paste. Lives in a ref because nothing visual
   * depends on it directly — the value just needs to survive between
   * Ctrl+C and Ctrl+V. Survives undo/redo (paste lands as a new
   * history step but doesn't repopulate the clipboard).
   */
  const clipboardRef = useRef<ClipboardSnapshot | null>(null)
  const [clipboardHasContents, setClipboardHasContents] = useState(false)

  const handleCopy = useCallback(() => {
    const ids = store.selectedIds
    if (ids.size === 0) return false
    const selected = store.doc.objects.filter((o) => ids.has(o.id))
    if (selected.length === 0) return false

    let originX = Number.POSITIVE_INFINITY
    let originY = Number.POSITIVE_INFINITY
    for (const o of selected) {
      if (o.x < originX) originX = o.x
      if (o.y < originY) originY = o.y
    }

    const objectRoom = store.doc.objectRoom ?? {}
    const entries: ClipboardEntry[] = selected.map((o) => {
      const { id: _id, ...rest } = o
      void _id
      const clone = JSON.parse(JSON.stringify(rest)) as Omit<
        PlacedObject,
        'id'
      >
      return {
        template: clone,
        relX: o.x - originX,
        relY: o.y - originY,
        roomId: objectRoom[o.id] ?? null,
      }
    })

    clipboardRef.current = {
      entries,
      originX,
      originY,
      pasteCount: 0,
    }
    setClipboardHasContents(true)
    toast.message(
      `Copied ${selected.length} object${selected.length === 1 ? '' : 's'}`,
      { duration: 1500 }
    )
    return true
  }, [store.doc.objects, store.doc.objectRoom, store.selectedIds])

  const handlePaste = useCallback(() => {
    const clip = clipboardRef.current
    if (!clip || clip.entries.length === 0) return false

    const step = clip.pasteCount + 1
    const offset = PASTE_OFFSET_FT * step
    const baseX = clip.originX + offset
    const baseY = clip.originY + offset

    const cw = store.doc.canvasWidthFt
    const cl = store.doc.canvasLengthFt

    // Group entries by destination room so each batch lands with the
    // right room association in a single commit. Entries without a
    // recorded room id default to the active room.
    //
    // Booth category cycling: every paste advances the booth's
    // category to the next entry in `eventCategoryNames`, wrapping
    // back to index 0. The cycle index is the per-entry paste count
    // so successive pastes from the same clipboard land on a
    // different category each time. Non-booth kinds and clipboards
    // that pre-date the cycling rule are passed through untouched.
    const cycleSteps = clip.pasteCount
    const buckets = new Map<string, PlacedObject[]>()
    for (const entry of clip.entries) {
      const roomId = entry.roomId ?? activeRoomId
      let template = entry.template as Omit<PlacedObject, 'id'>
      if (
        template.kind === 'booth' &&
        eventCategoryNames &&
        eventCategoryNames.length > 0
      ) {
        const sourceBooth = template as Omit<BoothObject, 'id'>
        let nextCat: string | null = sourceBooth.categoryName ?? null
        // Advance one step per accumulated paste so paste #1 → next,
        // paste #2 → next-next, etc., wrapping around.
        for (let i = 0; i <= cycleSteps; i++) {
          nextCat = nextCategoryName(nextCat, eventCategoryNames)
        }
        if (nextCat) {
          template = {
            ...template,
            kind: 'booth',
            categoryName: nextCat,
            // Drop any explicit accent override so the pasted booth
            // reads in the new category's palette color.
            accentColor: null,
          } as Omit<BoothObject, 'id'>
        }
      }
      const candidate = {
        ...template,
        id: `obj-${crypto.randomUUID()}`,
        x: baseX + entry.relX,
        y: baseY + entry.relY,
      } as PlacedObject
      const { dx, dy } = canvasClampDelta(candidate, cw, cl)
      const positioned = {
        ...candidate,
        x: candidate.x + dx,
        y: candidate.y + dy,
      } as PlacedObject
      if (!buckets.has(roomId)) buckets.set(roomId, [])
      buckets.get(roomId)!.push(positioned)
    }

    let allIds: string[] = []
    let isFirstBatch = true
    for (const [roomId, batch] of buckets) {
      const ids = store.addObjects(batch, {
        select: false,
        // Push history once for the whole paste; subsequent batches
        // are folded onto the same step.
        pushHistory: isFirstBatch,
        roomId,
      })
      allIds = allIds.concat(ids)
      isFirstBatch = false
    }
    if (allIds.length > 0) store.setSelection(allIds)

    clipboardRef.current = { ...clip, pasteCount: step }
    setTool('select')
    toast.success(
      `Pasted ${allIds.length} object${allIds.length === 1 ? '' : 's'}`,
      { duration: 1500 }
    )
    return true
  }, [activeRoomId, store, eventCategoryNames])

  /** See use-canvas-pointer.ts for the rotate semantics. */
  const handleRotateBy = useCallback(
    (delta: number) => {
      const ids = Array.from(store.selectedIds)
      if (ids.length === 0) return false
      const cw = store.doc.canvasWidthFt
      const cl = store.doc.canvasLengthFt
      const idSet = new Set(ids)
      const proposed: Array<{ obj: PlacedObject; nextRotation: number }> = []
      for (const obj of store.doc.objects) {
        if (!idSet.has(obj.id)) continue
        if (obj.locked) continue
        let next = ((obj.rotation || 0) + delta) % 360
        if (next > 180) next -= 360
        if (next <= -180) next += 360
        proposed.push({ obj, nextRotation: next })
      }
      if (proposed.length === 0) return false

      const probes: PlacedObject[] = proposed.map((p) => ({
        ...p.obj,
        rotation: p.nextRotation,
      }))
      const unionDelta = groupCanvasClampDelta(probes, cw, cl)

      type PatchEntry = {
        id: string
        patch: { rotation: number; x: number; y: number }
        finalProbe: PlacedObject
      }
      const entries: PatchEntry[] = []
      if (unionDelta) {
        for (const p of proposed) {
          const nx = p.obj.x + unionDelta.dx
          const ny = p.obj.y + unionDelta.dy
          entries.push({
            id: p.obj.id,
            patch: { rotation: p.nextRotation, x: nx, y: ny },
            finalProbe: {
              ...p.obj,
              rotation: p.nextRotation,
              x: nx,
              y: ny,
            },
          })
        }
      } else {
        for (const p of proposed) {
          const probe: PlacedObject = { ...p.obj, rotation: p.nextRotation }
          const { dx, dy } = canvasClampDelta(probe, cw, cl)
          const nx = p.obj.x + dx
          const ny = p.obj.y + dy
          entries.push({
            id: p.obj.id,
            patch: { rotation: p.nextRotation, x: nx, y: ny },
            finalProbe: {
              ...p.obj,
              rotation: p.nextRotation,
              x: nx,
              y: ny,
            },
          })
        }
      }

      for (const entry of entries) {
        const aabb = rotatedAabb(entry.finalProbe)
        if (!aabbFitsCanvas(aabb, cw, cl)) {
          toast.message(
            'Rotation blocked — selection would not fit inside the canvas.'
          )
          return false
        }
      }

      store.updateObjects(entries.map((e) => ({ id: e.id, patch: e.patch })))
      recoverCanvasFocus()
      return true
    },
    [recoverCanvasFocus, store]
  )

  /**
   * Align Vertical / Align Horizontal — snap the geometric centers of
   * the current selection to the *median* center on a single axis.
   *
   *   - "vertical"   = snap each center's x to the median x. Objects
   *                    stack into a single vertical column. Y-coords
   *                    are untouched, preserving relative top/bottom
   *                    spacing.
   *   - "horizontal" = snap each center's y to the median y. Objects
   *                    line up across a single horizontal row.
   *
   * We use median (not mean) so a single far-away outlier can't drag
   * the whole group across the canvas — the line lands on a value
   * already present in the selection, so visible motion stays bounded.
   * Locked objects contribute to the median but never move.
   * Patches are applied via `updateObjects` so undo rolls back the
   * entire group atomically.
   *
   * Defined here (above the keyboard-shortcut effect) so the effect
   * can list these callbacks in its deps without hitting a TDZ
   * "used before declaration" error from the const bindings below.
   */
  const handleAlignSelection = useCallback(
    (orientation: 'vertical' | 'horizontal') => {
      const ids = store.selectedIds
      if (ids.size < 2) {
        toast.message('Select two or more objects to align.')
        return false
      }
      const selected = store.doc.objects.filter((o) => ids.has(o.id))
      if (selected.length < 2) return false
      const axis: 'x' | 'y' = orientation === 'vertical' ? 'x' : 'y'
      const patches = alignSelectionPatches(
        selected,
        axis,
        store.doc.canvasWidthFt,
        store.doc.canvasLengthFt
      )
      if (patches.length === 0) {
        toast.message('Already aligned.')
        return false
      }
      store.updateObjects(patches)
      toast.success(
        orientation === 'vertical'
          ? `Aligned ${patches.length} object${patches.length === 1 ? '' : 's'} to vertical axis.`
          : `Aligned ${patches.length} object${patches.length === 1 ? '' : 's'} to horizontal axis.`,
        { duration: 1500 }
      )
      return true
    },
    [store]
  )

  const handleAlignVertical = useCallback(
    () => handleAlignSelection('vertical'),
    [handleAlignSelection]
  )
  const handleAlignHorizontal = useCallback(
    () => handleAlignSelection('horizontal'),
    [handleAlignSelection]
  )

  const [wizardCanvasFullscreen, setWizardCanvasFullscreen] = useState(false)
  const canvasFullscreen = isDashboard
    ? commandCenterFullscreen.fullscreen
    : wizardCanvasFullscreen
  const setCanvasFullscreen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      if (isDashboard) {
        const next =
          typeof value === 'function'
            ? value(commandCenterFullscreen.fullscreen)
            : value
        commandCenterFullscreen.setFullscreen(next)
        return
      }
      setWizardCanvasFullscreen(value)
    },
    [commandCenterFullscreen, isDashboard]
  )

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return
      }
      const cmd = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (cmd && !e.shiftKey && key === 'z') {
        e.preventDefault()
        store.undo()
        return
      }
      if (cmd && ((e.shiftKey && key === 'z') || key === 'y')) {
        e.preventDefault()
        store.redo()
        return
      }

      if (cmd && key === 'c') {
        if (handleCopy()) e.preventDefault()
        return
      }
      if (cmd && key === 'v') {
        if (handlePaste()) e.preventDefault()
        return
      }
      if (cmd && key === 'd') {
        if (handleCopy() && handlePaste()) e.preventDefault()
        return
      }
      if (cmd && key === 'a') {
        const all = store.doc.objects.map((o) => o.id)
        if (all.length > 0) {
          e.preventDefault()
          store.setSelection(all)
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.size > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
        return
      }

      if (!cmd && key === 'r') {
        if (store.selectedIds.size > 0) {
          e.preventDefault()
          handleRotateBy(e.shiftKey ? -ROTATE_STEP_DEG : ROTATE_STEP_DEG)
        }
        return
      }

      // Alignment shortcuts — Shift+H aligns selected objects'
      // horizontal centers (snaps every center's y to the median y)
      // and Shift+V aligns vertical centers (snaps x to the median).
      // Plain `h` / `v` are reserved for Hand / Select tool toggles
      // below; the case-sensitive checks here ensure the modifier
      // form takes priority and never collides with the tool keys.
      if (!cmd && e.shiftKey && key === 'h') {
        if (store.selectedIds.size >= 2) {
          e.preventDefault()
          handleAlignHorizontal()
        }
        return
      }
      if (!cmd && e.shiftKey && key === 'v') {
        if (store.selectedIds.size >= 2) {
          e.preventDefault()
          handleAlignVertical()
        }
        return
      }

      if (!cmd && e.key === '[') {
        return
      }
      if (!cmd && e.key === ']') {
        e.preventDefault()
        setRightInspectorOpen((open) => !open)
        return
      }

      if (e.key === 'h') setTool('hand')
      else if (e.key === 'v') setTool('select')
      else if (e.key === 'd') setTool('draw')
      else if (e.key === 'Escape') {
        if (canvasFullscreen) {
          e.preventDefault()
          setCanvasFullscreen(false)
          return
        }
        setTool('select')
        store.clearSelection()
        setSelectedRoomId(null)
        setSelectedRoomIds(new Set())
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    handleAlignHorizontal,
    handleAlignVertical,
    handleCopy,
    handleDeleteSelected,
    handlePaste,
    handleRotateBy,
    canvasFullscreen,
    store,
  ])

  // Wire the wizard save ref to a v2-aware persistence function that
  // splits the unified doc back into per-room rows.
  useEffect(() => {
    if (!saveLayoutRef) return
    saveLayoutRef.current = async () => {
      if (!eventId) {
        toast.error('Save event details before saving the layout')
        return false
      }
      if (layoutRooms.length === 0) return false

      const projectedRooms = legacyRoomsFromDoc(layoutRooms, store.doc)
      onLayoutRoomsChange(projectedRooms, activeRoomId)

      const supabase = createClient()
      const payload = layoutPayloadFromRooms(
        eventId,
        projectedRooms,
        activeRoomId
      )
      const { error } = await persistLayoutDraft(supabase, eventId, payload)
      if (error) {
        toast.error(`Save failed — ${error.message}`)
        return false
      }
      // Server is now the source of truth — drop the unified
      // crash-recovery draft so a future refresh loads from Supabase.
      clearMultiRoomDraft(eventId)
      toast.success('Floor plan saved')
      return true
    }
    return () => {
      if (saveLayoutRef.current) saveLayoutRef.current = null
    }
  }, [
    activeRoomId,
    eventId,
    layoutRooms,
    onLayoutRoomsChange,
    saveLayoutRef,
    store.doc,
  ])

  const placedCount = store.doc.objects.length
  const selectedCount = store.selectedIds.size

  useEffect(() => {
    onPlacedCountChange?.(placedCount)
  }, [onPlacedCountChange, placedCount])

  const handleRotateLeft = useCallback(() => {
    handleRotateBy(-ROTATE_STEP_DEG)
  }, [handleRotateBy])
  const handleRotateRight = useCallback(() => {
    handleRotateBy(ROTATE_STEP_DEG)
  }, [handleRotateBy])

  const rotateTargetRoomId = selectedRoomId ?? activeRoomId

  const syncLayoutRoomsFromDoc = useCallback(
    (doc: FloorPlanDoc) => {
      if (layoutRooms.length === 0) return
      const projected = legacyRoomsFromDoc(layoutRooms, doc)
      onLayoutRoomsChange(projected, activeRoomId)
    },
    [activeRoomId, layoutRooms, onLayoutRoomsChange]
  )

  const handleRoomGeometryCommit = useCallback(() => {
    syncLayoutRoomsFromDoc(store.doc)
  }, [store.doc, syncLayoutRoomsFromDoc])

  const handleRotateRoomLeft = useCallback(() => {
    if (!rotateTargetRoomId) {
      toast.message('Click the room perimeter on the canvas, then rotate.')
      return
    }
    const nextDoc = store.rotateRoomFrame(rotateTargetRoomId, 'ccw')
    if (!nextDoc) return
    syncLayoutRoomsFromDoc(nextDoc)
    recoverCanvasFocus()
  }, [recoverCanvasFocus, rotateTargetRoomId, store, syncLayoutRoomsFromDoc])

  const handleRotateRoomRight = useCallback(() => {
    if (!rotateTargetRoomId) {
      toast.message('Click the room perimeter on the canvas, then rotate.')
      return
    }
    const nextDoc = store.rotateRoomFrame(rotateTargetRoomId, 'cw')
    if (!nextDoc) return
    syncLayoutRoomsFromDoc(nextDoc)
    recoverCanvasFocus()
  }, [recoverCanvasFocus, rotateTargetRoomId, store, syncLayoutRoomsFromDoc])

  const [currentZoom, setCurrentZoom] = useState(1)

  const handleViewportReady = useCallback((api: ViewportApi | null) => {
    viewportApiRef.current = api
  }, [])
  const handleZoomIn = useCallback(() => {
    viewportApiRef.current?.zoomIn()
  }, [])
  const handleZoomOut = useCallback(() => {
    viewportApiRef.current?.zoomOut()
  }, [])
  const handleZoomReset = useCallback(() => {
    viewportApiRef.current?.resetZoom()
    recoverCanvasFocus()
  }, [recoverCanvasFocus])
  /**
   * "Center View" — the toolbar button that recovers framing.
   *
   * Behaviour:
   *   1. If the doc has at least one object, compute the union of
   *      every placed object's *rotated* AABB and frame that rectangle
   *      with ~10% padding on each side. This both pans (the bbox
   *      centroid lands at the viewport centre) and zooms (the
   *      largest factor in [0.25, 3] that still fits the bbox) — so
   *      one click always makes "everything you've drawn" visible
   *      regardless of where the user has panned or how far they've
   *      zoomed in.
   *   2. With nothing placed, fall back to `centerView()` — re-centres
   *      on the active room midpoint at zoom 1.0 so an empty canvas
   *      reads cleanly.
   */
  const handleCenterView = useCallback(() => {
    const api = viewportApiRef.current
    if (!api) return
    addLog('Center view: fitting camera to content bounds')
    const objectBbox = groupRotatedAabb(store.doc.objects)
    if (objectBbox) {
      api.fitToBounds(
        {
          minX: objectBbox.x,
          minY: objectBbox.y,
          maxX: objectBbox.x + objectBbox.width,
          maxY: objectBbox.y + objectBbox.height,
        },
        { padding: 0.1 }
      )
    } else {
      const roomBounds = unionActiveRoomBounds(store.doc)
      if (roomBounds) {
        api.fitToBounds(roomBounds, { padding: 0.12 })
      } else {
        api.resetViewport()
      }
    }
    recoverCanvasFocus()
  }, [addLog, recoverCanvasFocus, store.doc])


  /**
   * Auto-Arrange — scoped to the *active* room only on the unified
   * canvas. We translate that room's booths back to local coords,
   * run the v1 row-pack engine (which expects a single room sized
   * doc), then translate the result back to global coords and merge
   * into the unified doc with a single history step.
   */
  const boothCount = useMemo(() => {
    const objectRoom = store.doc.objectRoom ?? {}
    return store.doc.objects.filter(
      (o) => o.kind === 'booth' && objectRoom[o.id] === activeRoomId
    ).length
  }, [activeRoomId, store.doc.objects, store.doc.objectRoom])

  const vendorTableMetaByKey = useMemo(() => {
    if (!applications?.length) return undefined
    return vendorTableMetaFromApplications(applications, safeTableSizeFt)
  }, [applications, safeTableSizeFt])

  const handleAutoArrange = useCallback(() => {
    if (boothCount === 0) {
      toast.message('Nothing to arrange — draw at least one booth first.')
      return
    }
    const result = autoArrangeInRoom(store.doc, activeRoomId, {
      mode: autoArrangeMode,
      eventCategoryNames,
      baselineTableLengthFt: safeTableSizeFt,
      vendorTableMetaByKey,
      ...(typeof layoutCapacity === 'number' && layoutCapacity > 0
        ? { maxBooths: layoutCapacity }
        : {}),
    })
    if (!result) return
    if (result.perimeterCapacityError) {
      toast.error(result.perimeterCapacityError, { duration: 6000 })
      return
    }
    if (result.placedCount === 0) {
      toast.error('Auto-Arrange could not fit any booths inside the room.')
      return
    }
    store.replaceObjects(result.doc.objects)
    const spaceOverflow = result.overflowCount + result.droppedCount
    if (spaceOverflow > 0) {
      toast.warning(
        `Could not place ${spaceOverflow} booth${spaceOverflow === 1 ? '' : 's'} due to space restrictions.`,
        { duration: 5000 }
      )
    } else if (result.unsatisfiedCategoryCount > 0) {
      // The clearance pass succeeded but the same-category proximity
      // rule (< 5 cols AND < 2 rows) couldn't be honored for every
      // booth — surface the overflow so the coordinator knows their
      // canvas is too tight to disperse every category.
      toast.warning(
        `Auto-arrange complete. ${result.unsatisfiedCategoryCount} booth${result.unsatisfiedCategoryCount === 1 ? '' : 's'} could not meet the 5-space / 2-row separation rule due to space constraints.`,
        { duration: 4500 }
      )
    } else {
      toast.success(
        `Auto-arranged ${result.placedCount} booth${result.placedCount === 1 ? '' : 's'} with clearance.`
      )
    }
  }, [
    activeRoomId,
    autoArrangeMode,
    boothCount,
    eventCategoryNames,
    layoutCapacity,
    safeTableSizeFt,
    store,
    vendorTableMetaByKey,
  ])

  const handleSelectRoom = useCallback(
    (roomId: string) => {
      onLayoutRoomsChange(layoutRooms, roomId)
      setSelectedRoomId(roomId)
      setSelectedRoomIds(new Set([roomId]))
      store.clearSelection()
    },
    [layoutRooms, onLayoutRoomsChange, store]
  )

  const handleRoomFrameClick = useCallback(
    (roomId: string, options?: { additive?: boolean }) => {
      store.clearSelection()
      if (options?.additive) {
        setSelectedRoomIds((prev) => {
          const next = new Set(prev)
          if (next.has(roomId)) next.delete(roomId)
          else next.add(roomId)
          return next
        })
      } else {
        setSelectedRoomIds(new Set([roomId]))
      }
      setSelectedRoomId(roomId)
      if (roomId !== activeRoomId) {
        onLayoutRoomsChange(layoutRooms, roomId)
      }
    },
    [activeRoomId, layoutRooms, onLayoutRoomsChange, store]
  )

  /** Join eligibility: touching/overlapping rooms (~5 in tolerance) or stages. */
  const joinPlan = useMemo(() => {
    const frames = store.doc.rooms ?? []
    const objects = store.doc.objects ?? []
    const empty = {
      canJoin: false,
      joinRoomIds: [] as string[],
      joinObjectIds: [] as string[],
      candidateCount: 0,
      unjoinGroupId: null as string | null,
      blockedReason: null as string | null,
    }

    const selectedIdsArray = Array.from(store.selectedIds)
    const singleSelectedObj =
      selectedIdsArray.length === 1
        ? objects.find((o) => o.id === selectedIdsArray[0]!)
        : null

    // Case B: two+ rooms selected on canvas (Shift+click) for explicit join.
    const prunedRoomIds = Array.from(selectedRoomIds).filter((id) =>
      frames.some((f) => f.id === id)
    )
    if (prunedRoomIds.length >= 2) {
      const connected = roomIdsFormConnectedComponent(
        prunedRoomIds,
        frames,
        DEFAULT_TOUCH_EPSILON_FT
      )
      const groupId =
        frames.find((f) => prunedRoomIds.includes(f.id))?.joinGroupId ?? null
      return {
        canJoin: connected,
        joinRoomIds: prunedRoomIds,
        joinObjectIds: [] as string[],
        candidateCount: prunedRoomIds.length,
        unjoinGroupId: groupId,
        blockedReason: connected
          ? null
          : 'Selected rooms must touch or overlap to join',
      }
    }

    // Case A: a joinable `PlacedObject` (e.g. stage) is the initiator.
    if (singleSelectedObj && isJoinableObject(singleSelectedObj)) {
      const initiatorGroupId = singleSelectedObj.joinGroupId ?? null
      const neighbors = mixedNeighborsOf(
        { kind: 'object', id: singleSelectedObj.id },
        frames,
        objects,
        DEFAULT_TOUCH_EPSILON_FT
      )
      const joinRoomIds: string[] = []
      const joinObjectIds: string[] = [singleSelectedObj.id]
      for (const n of neighbors) {
        if (n.kind === 'room') {
          const f = frames.find((x) => x.id === n.id)
          if (!f) continue
          if (initiatorGroupId && f.joinGroupId === initiatorGroupId) continue
          joinRoomIds.push(n.id)
        } else {
          const o = objects.find((x) => x.id === n.id)
          if (!o) continue
          if (initiatorGroupId && o.joinGroupId === initiatorGroupId) continue
          joinObjectIds.push(n.id)
        }
      }
      const candidateCount = joinRoomIds.length + joinObjectIds.length - 1
      return {
        canJoin: candidateCount > 0,
        joinRoomIds,
        joinObjectIds,
        candidateCount,
        unjoinGroupId: initiatorGroupId,
        blockedReason: null as string | null,
      }
    }

    // Case C: selected/active room + geometric neighbours. When a booth
    // (or other non-joinable asset) is still selected, use the active room
    // from the sidebar — not a stale canvas room pick — so Join still works.
    const joinTargetRoomId =
      singleSelectedObj && !isJoinableObject(singleSelectedObj)
        ? activeRoomId
        : (selectedRoomId ?? activeRoomId)
    if (!joinTargetRoomId) {
      return empty
    }
    const target = frames.find((f) => f.id === joinTargetRoomId)
    if (!target) return empty

    const targetGroupId = target.joinGroupId ?? null
    const neighbors = mixedNeighborsOf(
      { kind: 'room', id: target.id },
      frames,
      objects,
      DEFAULT_TOUCH_EPSILON_FT
    )
    const joinRoomIds: string[] = [target.id]
    const joinObjectIds: string[] = []
    for (const n of neighbors) {
      if (n.kind === 'room') {
        const f = frames.find((x) => x.id === n.id)
        if (!f) continue
        if (targetGroupId && f.joinGroupId === targetGroupId) continue
        joinRoomIds.push(n.id)
      } else {
        const o = objects.find((x) => x.id === n.id)
        if (!o) continue
        if (targetGroupId && o.joinGroupId === targetGroupId) continue
        joinObjectIds.push(n.id)
      }
    }
    const candidateCount =
      joinRoomIds.length - 1 + joinObjectIds.length
    return {
      canJoin: candidateCount > 0,
      joinRoomIds,
      joinObjectIds,
      candidateCount,
      unjoinGroupId: targetGroupId,
      blockedReason:
        candidateCount > 0
          ? null
          : 'Move rooms flush together (within ~5 in), then Join',
    }
  }, [
    store.doc.rooms,
    store.doc.objects,
    store.selectedIds,
    selectedRoomId,
    selectedRoomIds,
    activeRoomId,
  ])

  const joinedZoneCount = useMemo(() => {
    const frames = store.doc.rooms ?? []
    const groupIds = new Set<string>()
    for (const f of frames) {
      if (f.joinGroupId) groupIds.add(f.joinGroupId)
    }
    let count = 0
    for (const gid of groupIds) {
      if (frames.filter((f) => f.joinGroupId === gid).length >= 2) count++
    }
    return count
  }, [store.doc.rooms])

  const destructiveMergePlan = useMemo(() => {
    const joinRoomIds = [...joinPlan.joinRoomIds]
    const joinObjectIds = [...joinPlan.joinObjectIds]

    if (joinRoomIds.length + joinObjectIds.length < 2) {
      const frames = store.doc.rooms ?? []
      const selected = Array.from(store.selectedIds)
      const joinableSelected = store.doc.objects.filter(
        (o) => selected.includes(o.id) && isJoinableObject(o)
      )
      if (joinableSelected.length >= 1 && frames.length >= 1) {
        for (const obj of joinableSelected) {
          for (const frame of frames) {
            if (frame.mergedIntoObjectId) continue
            if (!objectFrameOverlapsOrTouches(obj, frame)) continue
            if (!joinRoomIds.includes(frame.id)) joinRoomIds.push(frame.id)
            if (!joinObjectIds.includes(obj.id)) joinObjectIds.push(obj.id)
          }
        }
      }
    }

    const total = joinRoomIds.length + joinObjectIds.length
    return {
      canMerge: total >= 2,
      joinRoomIds,
      joinObjectIds,
      count: total,
    }
  }, [
    joinPlan.joinObjectIds,
    joinPlan.joinRoomIds,
    store.doc.objects,
    store.doc.rooms,
    store.selectedIds,
  ])

  const shapeMergePlan = useMemo(() => {
    const selected = Array.from(store.selectedIds)
    const eligible = store.doc.objects.filter(
      (o) => selected.includes(o.id) && isMergeUnionEligible(o)
    )
    const hasRoomParticipant = destructiveMergePlan.joinRoomIds.length > 0
    const objectOnly =
      eligible.length >= 2 &&
      !hasRoomParticipant &&
      !joinableObjectsOverlapAnyRoom(eligible, store.doc.rooms ?? [])
    return {
      canMergeShapes: objectOnly,
      objectIds: eligible.map((o) => o.id),
      count: eligible.length,
    }
  }, [
    destructiveMergePlan.joinRoomIds.length,
    store.doc.objects,
    store.doc.rooms,
    store.selectedIds,
  ])

  const canMerge =
    destructiveMergePlan.canMerge || shapeMergePlan.canMergeShapes

  const mergeBlockedReason = canMerge
    ? null
    : joinPlan.blockedReason ??
      'Overlap or touch a stage against a room (or select two fixtures), then Merge'

  const runDestructiveMerge = useCallback(() => {
    if (!destructiveMergePlan.canMerge) {
      if (mergeBlockedReason) {
        toast.message(mergeBlockedReason, { duration: 2200 })
      }
      return
    }
    addLog('Triggering destructive union merge...')
    addLog(
      `Merge input roomIds=${JSON.stringify(destructiveMergePlan.joinRoomIds)} objectIds=${JSON.stringify(destructiveMergePlan.joinObjectIds)}`
    )
    addLog(`doc.rooms before merge: ${serializeRooms(store.doc)}`)
    const result = store.destructiveMerge({
      roomIds: destructiveMergePlan.joinRoomIds,
      objectIds: destructiveMergePlan.joinObjectIds,
    })
    if (!result.mergedId) {
      if (result.reason) {
        addLog(`Merge failed: ${result.reason}`)
        toast.message(result.reason, { duration: 2200 })
      }
      return
    }
    const mergedFrame = store.doc.rooms?.find((r) => r.id === result.mergedId)
    const newRoomVertices = mergedFrame?.perimeterRing ?? []
    addLog(`Merge output vertices: ${JSON.stringify(newRoomVertices)}`)
    addLog(`doc.rooms after merge: ${serializeRooms(store.doc)}`)
    setSelectedRoomId(result.mergedId)
    setSelectedRoomIds(new Set([result.mergedId]))
    syncLayoutRoomsFromDoc(store.doc)
    recoverCanvasFocus()
    toast.success(
      'Merged into one hall — source rooms removed, union perimeter saved.',
      { duration: 2000 }
    )
  }, [
    addLog,
    destructiveMergePlan,
    mergeBlockedReason,
    recoverCanvasFocus,
    store,
    syncLayoutRoomsFromDoc,
  ])

  const handleMerge = useCallback(() => {
    if (destructiveMergePlan.canMerge) {
      runDestructiveMerge()
      return
    }
    if (shapeMergePlan.canMergeShapes) {
      addLog(
        `Triggering fixture union merge objectIds=${JSON.stringify(shapeMergePlan.objectIds)}`
      )
      const result = store.mergeUnionSelection(shapeMergePlan.objectIds)
      if (result.mergedId) {
        addLog(`Fixture merge created merged_zone id=${result.mergedId}`)
        setSelectedRoomIds(new Set())
        setSelectedRoomId(null)
        toast.success('Merged into one shape — shared edges removed.', {
          duration: 1800,
        })
        recoverCanvasFocus()
      } else if (result.reason) {
        addLog(`Fixture merge failed: ${result.reason}`)
        toast.message(result.reason, { duration: 2200 })
      }
      return
    }
    runDestructiveMerge()
  }, [
    addLog,
    destructiveMergePlan.canMerge,
    recoverCanvasFocus,
    runDestructiveMerge,
    shapeMergePlan,
    store,
  ])

  const selectedMergedZoneId = useMemo(() => {
    for (const id of store.selectedIds) {
      const o = store.doc.objects.find((x) => x.id === id)
      if (o?.kind === 'merged_zone') return id
    }
    const frames = store.doc.rooms ?? []
    for (const f of frames) {
      if (f.mergedIntoObjectId && store.selectedIds.has(f.id)) {
        return f.mergedIntoObjectId
      }
    }
    return null
  }, [store.doc.objects, store.doc.rooms, store.selectedIds])

  const canSplitMerge = selectedMergedZoneId !== null || joinPlan.unjoinGroupId !== null

  const handleUnjoinRoom = useCallback(() => {
    if (selectedMergedZoneId) {
      store.splitDestructiveMerge(selectedMergedZoneId)
      toast.message('Merge split — room outlines restored (use Undo to recover stages).', {
        duration: 2000,
      })
      return
    }
    const groupId = joinPlan.unjoinGroupId
    if (!groupId) return
    store.unjoinRooms(groupId)
    toast.message('Joined zone split — each member is standalone again.', {
      duration: 1500,
    })
  }, [joinPlan.unjoinGroupId, selectedMergedZoneId, store])

  const layoutHeader =
    !isDashboard && !isEmbedded ? (
      <header className="flex flex-wrap items-center gap-3 rounded-lg border-b border-stone-200/80 bg-card/60 px-2 py-2">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold tracking-tight text-forest sm:text-lg">
            Layout tools
          </h2>
          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              ]
            </kbd>{' '}
            toggle inspector ·{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              H
            </kbd>{' '}
            /{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              V
            </kbd>{' '}
            /{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              D
            </kbd>{' '}
            tools ·{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              Ctrl+Z
            </kbd>{' '}
            undo
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {joinedZoneCount > 0 ? (
            <span
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900"
              title="Number of dissolved (joined) zones on this canvas"
            >
              {joinedZoneCount} joined zone{joinedZoneCount === 1 ? '' : 's'}
            </span>
          ) : null}
          <div className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700">
            {placedCount} object{placedCount === 1 ? '' : 's'} placed
            {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
          </div>
        </div>
      </header>
    ) : null

  const fullscreenExitToolbar = (
    <button
      type="button"
      onClick={() => setCanvasFullscreen(false)}
      className="rounded-lg border border-stone-600 bg-stone-900/95 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg hover:bg-stone-800"
      aria-label="Exit fullscreen canvas editor"
    >
      Exit Fullscreen
    </button>
  )

  return (
    <div
      id="floor-plan-workspace"
      className={cn(
        'floor-plan-editor-root relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        debugGeometry && 'pr-[300px]',
        className
      )}
    >
      {debugGeometry ? (
        <DiagnosticSidebar doc={store.doc} onClearAndReset={hardResetCanvas} />
      ) : null}
      <FullscreenLayout
        active={canvasFullscreen}
        onActiveChange={(next) => setCanvasFullscreen(next)}
        header={layoutHeader}
        fullscreenToolbar={fullscreenExitToolbar}
        className="min-h-0 min-w-0 flex-1"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        {isDashboard ? (
          <CanvasCommandBar
            staticLayout
            className="shrink-0"
            toolState={{ tool, drawShape }}
            onToolChange={handleToolChange}
            onDrawShapeChange={handleDrawShapeChange}
            canUndo={store.canUndo}
            canRedo={store.canRedo}
            onUndo={store.undo}
            onRedo={store.redo}
            onClearAll={handleClearAll}
            selectedCount={selectedCount}
            onDeleteSelected={handleDeleteSelected}
            onCopy={handleCopy}
            onPaste={handlePaste}
            clipboardHasContents={clipboardHasContents}
            onRotateLeft={handleRotateLeft}
            onRotateRight={handleRotateRight}
            onRotateRoomLeft={handleRotateRoomLeft}
            onRotateRoomRight={handleRotateRoomRight}
            selectedRoomId={selectedRoomId}
            onAlignVertical={handleAlignVertical}
            onAlignHorizontal={handleAlignHorizontal}
            zoom={currentZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onCenterView={handleCenterView}
            onAutoArrange={handleAutoArrange}
            canAutoArrange={boothCount > 0}
            autoArrangeMode={autoArrangeMode}
            onAutoArrangeModeChange={setAutoArrangeMode}
            onJoinRooms={handleMerge}
            canJoinRooms={canMerge}
            joinCandidateCount={
              destructiveMergePlan.canMerge
                ? destructiveMergePlan.count
                : shapeMergePlan.canMergeShapes
                  ? shapeMergePlan.count
                  : undefined
            }
            joinBlockedReason={mergeBlockedReason}
            mergePrefersShapes={shapeMergePlan.canMergeShapes}
            onUnjoinRoom={handleUnjoinRoom}
            canUnjoinRoom={canSplitMerge}
            tableSizeFt={tableSizePillValue}
            onTableSizeChange={handleTableSizeChange}
            rooms={!isEmbedded && onAddRoom && onRenameRoom && onDeleteRoom ? layoutRooms : undefined}
            activeRoomId={selectedRoomId ?? activeRoomId}
            onSelectRoom={!isEmbedded ? handleSelectRoom : undefined}
            onAddRoom={!isEmbedded ? onAddRoom : undefined}
            onRenameRoom={!isEmbedded ? onRenameRoom : undefined}
            onDeleteRoom={!isEmbedded ? onDeleteRoom : undefined}
            highlightedRoomMetrics={highlightedRoomMetrics}
            showLabels={showLabels}
            onShowLabelsChange={setShowLabels}
            canvasFullscreen={canvasFullscreen}
            onToggleCanvasFullscreen={() => setCanvasFullscreen((v) => !v)}
            onSaveMarket={onSaveMarket}
            saveMarketDisabled={saveMarketDisabled}
            saveMarketLoading={saveMarketLoading}
          />
        ) : null}
        {!isDashboard ? (
          <CanvasCommandBar
            toolState={{ tool, drawShape }}
            onToolChange={handleToolChange}
            onDrawShapeChange={handleDrawShapeChange}
            canUndo={store.canUndo}
            canRedo={store.canRedo}
            onUndo={store.undo}
            onRedo={store.redo}
            onClearAll={handleClearAll}
            selectedCount={selectedCount}
            onDeleteSelected={handleDeleteSelected}
            onCopy={handleCopy}
            onPaste={handlePaste}
            clipboardHasContents={clipboardHasContents}
            onRotateLeft={handleRotateLeft}
            onRotateRight={handleRotateRight}
            onRotateRoomLeft={handleRotateRoomLeft}
            onRotateRoomRight={handleRotateRoomRight}
            selectedRoomId={selectedRoomId}
            onAlignVertical={handleAlignVertical}
            onAlignHorizontal={handleAlignHorizontal}
            zoom={currentZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onCenterView={handleCenterView}
            onAutoArrange={handleAutoArrange}
            canAutoArrange={boothCount > 0}
            autoArrangeMode={autoArrangeMode}
            onAutoArrangeModeChange={setAutoArrangeMode}
            onJoinRooms={handleMerge}
            canJoinRooms={canMerge}
            joinCandidateCount={
              destructiveMergePlan.canMerge
                ? destructiveMergePlan.count
                : shapeMergePlan.canMergeShapes
                  ? shapeMergePlan.count
                  : undefined
            }
            joinBlockedReason={mergeBlockedReason}
            mergePrefersShapes={shapeMergePlan.canMergeShapes}
            onUnjoinRoom={handleUnjoinRoom}
            canUnjoinRoom={canSplitMerge}
            tableSizeFt={tableSizePillValue}
            onTableSizeChange={handleTableSizeChange}
            rooms={!isEmbedded && onAddRoom && onRenameRoom && onDeleteRoom ? layoutRooms : undefined}
            activeRoomId={selectedRoomId ?? activeRoomId}
            onSelectRoom={!isEmbedded ? handleSelectRoom : undefined}
            onAddRoom={!isEmbedded ? onAddRoom : undefined}
            onRenameRoom={!isEmbedded ? onRenameRoom : undefined}
            onDeleteRoom={!isEmbedded ? onDeleteRoom : undefined}
            highlightedRoomMetrics={highlightedRoomMetrics}
            showLabels={showLabels}
            onShowLabelsChange={setShowLabels}
            canvasFullscreen={canvasFullscreen}
            onToggleCanvasFullscreen={() => setCanvasFullscreen((v) => !v)}
            onSaveMarket={onSaveMarket}
            saveMarketDisabled={saveMarketDisabled}
            saveMarketLoading={saveMarketLoading}
          />
        ) : null}

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 overflow-hidden',
            !isDashboard && 'gap-2'
          )}
        >
          <div
            className={cn(
              'floor-plan-canvas-host relative min-h-0 min-w-0 flex-1 overflow-hidden bg-stone-100',
              isDashboard
                ? 'h-full min-h-0 border-0'
                : 'min-h-[280px] h-full rounded-lg border border-stone-200'
            )}
          >
            <CanvasRootErrorBoundary
              onReset={() => {
                logState('Canvas error boundary: reset triggered')
                store.resetState()
              }}
              onError={(error) => {
                logState(`Canvas error: ${error.message}`)
              }}
            >
            <LayoutCanvasWizardQa
              className="absolute inset-0"
              commandCenterViewport={isDashboard}
              store={store}
              toolState={{ tool, drawShape }}
              defaultBoothTableLengthFt={safeTableSizeFt}
              tableSizeFt={tableSizePillValue}
              activeRoomId={activeRoomId}
              selectedRoomId={selectedRoomId}
              onRoomFrameClick={handleRoomFrameClick}
              onRoomGeometryCommit={handleRoomGeometryCommit}
              onViewportReady={handleViewportReady}
              onZoomChange={setCurrentZoom}
              eventCategoryNames={eventCategoryNames}
              boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
              onVendorDrop={onVendorDrop}
              autoArrangeMode={autoArrangeMode}
              onProximityViolation={(info) => {
                toast.error(
                  `Same-category booths must be at least 5 columns or 2 rows apart — "${info.category}" placement reverted.`,
                  { duration: 2400 }
                )
              }}
              onOverlapViolation={() => {
                toast.error(
                  'Objects cannot overlap — move the selection so it clears other fixtures, then try again.',
                  { duration: 2400 }
                )
              }}
              onRoomCanvasLimitBlocked={() => {
                toast.message(
                  'Canvas limit reached — drag the primary (largest) room smaller or move annex rooms closer.',
                  { duration: 2200 }
                )
              }}
              showLabels={showLabels}
            />
            </CanvasRootErrorBoundary>
            <CanvasLegend />
          </div>

          {!isDashboard ? (
            <div className="relative flex shrink-0">
              {!rightInspectorOpen ? (
                <button
                  type="button"
                  onClick={() => setRightInspectorOpen(true)}
                  title="Show inspector (])"
                  aria-label="Show inspector"
                  className="flex h-full w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="relative flex h-full max-h-full w-[min(100%,260px)] min-h-0 flex-col">
                  <button
                    type="button"
                    onClick={() => setRightInspectorOpen(false)}
                    title="Hide inspector (])"
                    aria-label="Hide inspector"
                    className="absolute -left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm hover:bg-stone-50"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  <PropertyInspector
                    store={store}
                    eventCategoryNames={eventCategoryNames}
                    className="min-h-0 flex-1 overflow-y-auto"
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
        </div>
      </FullscreenLayout>
    </div>
  )
}
