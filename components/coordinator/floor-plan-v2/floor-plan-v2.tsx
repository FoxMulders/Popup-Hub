'use client'

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { createPortal } from 'react-dom'
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
import {
  isGuestTableBooth,
  guestRectTableSpec,
  guestRoundTableSpec,
  normalizeTableSizeSpec,
  vendorTableSpec,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'
import { createClient } from '@/lib/supabase/client'
import { persistLayoutDraft } from '@/lib/wizard/wizard-autosave'
import { layoutPayloadFromRooms } from '@/lib/booth-planner/layout-rooms'
import { cn } from '@/lib/utils'
import { openDualScreenWindow, type DualScreenMode } from '@/lib/coordinator/floorplan-sync'
import type { BoothMapLabelMode } from '@/lib/coordinator/booth-map-label'
import { summarizeDocClearanceIssues } from '@/lib/coordinator/booth-clearance-summary'
import {
  runWizardInitialLayout,
  shouldRunWizardInitialLayout,
} from '@/lib/floor-plan/wizard-initial-layout'
import {
  estimateRoomFillCapacity,
  fillRoomWithTables,
} from '@/lib/floor-plan/fill-room-with-tables'
import {
  readClearanceWarningsEnabled,
  writeClearanceWarningsEnabled,
} from '@/lib/coordinator/booth-clearance-warnings-pref'
import { LayoutCanvas } from './canvas/floor-plan-canvas'
import { canvasGridDocPatch } from './canvas/canvas-grid-spacing'
import { CanvasLegend } from './canvas/canvas-legend'
import { CanvasLedger } from './canvas/canvas-ledger'
import { focusFloorPlanCanvas } from './canvas/canvas-focus'
import {
  fitViewportToContent,
  VIEWPORT_FIT_PADDING,
} from './canvas/use-layout-viewport'
import { DiagnosticSidebar } from './debug/diagnostic-sidebar'
import { PlacesApiStatusProvider } from './debug/places-api-status-context'
import { FullscreenLayout } from './canvas/fullscreen-layout'
import { DebugLogProvider, useDebugLog } from './debug/debug-log-context'
import { serializeRooms } from './debug/format-geometry-log'
import type { ViewportApi } from './canvas/use-viewport'
import { PropertyInspector } from './inspector/property-inspector'
import { CanvasCommandBar } from './tools/canvas-command-bar'
import { LayoutEditorHelpBanner, LayoutEditorHelpHost } from './tools/layout-editor-help'
import { DEFAULT_TOOL_STATE, type DrawShape, type ToolId } from './tools/types'
import type { AutoArrangeMode } from './engine/auto-arrange'
import { autoArrangeInRoom } from './engine/auto-arrange'
import { runAutoArrangeWithAi } from '@/lib/floor-plan/request-ai-auto-arrange'
import {
  AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP,
  evaluateTrafficFlowPrerequisites,
} from './engine/traffic-flow-prerequisites'
import {
  applyPackedBoothsToDoc,
  PackBooths,
  vendorBoothsInRoom,
} from './engine/BoothArrangementEngine'
import type { UnifiedSolverMeta } from './engine/UnifiedLayoutSolver'
import { CalculateOptimalPath } from './engine/PathfindingService'
import { usePathfinding } from './hooks/use-pathfinding'
import { usePatronAisleOverlay } from './hooks/use-patron-aisle-overlay'
import {
  layoutSpringTargetsFromBooths,
  useLayoutSpringAnimation,
} from './hooks/use-layout-spring'
import { legacyRoomsFromDoc } from './state/legacy-bridge'
import { hydrateFloorPlanDoc } from './state/layout-hydration'
import {
  activeRoomFramingBounds,
  reconcileCanvasExtents,
  unionCanvasContentBounds,
} from './state/room-canvas'
import {
  clearMultiRoomDraft,
  saveMultiRoomDraft,
} from './state/local-draft'
import { setSuppressAutoMainHall } from './state/canvas-session-guards'
import {
  docNeedsGeometrySanitize,
  forceRecomputeGeometry,
} from './state/geometry-sanitize'
import { useCanvasStore } from './state/use-canvas-store'
import { CanvasRootErrorBoundary } from './canvas/canvas-root-error-boundary'
import { vendorTableMetaFromApplications } from '@/lib/booth-planner/table-booth-consolidation'
import { planTableSizeChange } from './state/table-size-selection'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
  RoomFrame,
} from './state/types'
import { nextCategoryName } from './canvas/category-palette'
import {
  aabbFitsCanvas,
  alignSelectionPatches,
  distributeSelectionPatches,
  canvasClampDelta,
  detectPlacedObjectOverlaps,
  groupCanvasClampDelta,
  groupRotatedAabb,
  rotatedAabb,
} from './interactions/geometry'
import { formatObjectDimensions } from './interactions/object-resize'
import { useTableSizeUnits } from '@/lib/booth-planner/table-size-units'
import type { LayoutRoom } from '@/types/database'
import type { FloorPlanDocStore } from './state/use-floor-plan-doc'
import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
import {
  CommandCenterExitButton,
  resolveDesignerExitHref,
  resolveDesignerExitLabel,
} from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from '@/components/coordinator/dashboard/command-center-fullscreen-context'
import { useDashboardToolbarPortal } from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { useDashboardLayoutSave } from '@/components/coordinator/dashboard/dashboard-layout-save-context'

/** Step (in degrees) per click of the rotate +/- toolbar buttons. */
const ROTATE_STEP_DEG = 15

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
  /** Read-only projection of the current floor plan for saved-layout templates. */
  layoutSnapshotRef?: MutableRefObject<
    (() => { rooms: import('@/types/database').LayoutRoom[]; activeRoomId: string } | null) | null
  >
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
  onAddRoom?: (options?: import('@/lib/coordinator/add-layout-room').AddLayoutRoomOptions) => void
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
   * Step 2 category caps — when the canvas is blank on first Step 3
   * entry, generic vendor booths are seeded and grid-packed once.
   */
  configuredCategorySlots?: ReadonlyArray<{
    categoryId: string
    categoryName: string
    maxSlots: number
  }>
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
  /** Persist layout JSON without publishing the market. */
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  saveDraftLoading?: boolean
  /** Toggle patron traffic path overlay on the canvas. */
  patronPathEnabled?: boolean
  onPatronPathToggle?: () => void
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
  /** Wizard — fired after the one-time Step 3 auto seed + grid pack. */
  onWizardInitialLayoutComplete?: (result: { placedCount: number }) => void
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
  boothMapLabelByObjectId?: ReadonlyMap<
    string,
    { vendorName: string; category: string }
  >
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
  /** Persistent escape hatch — routes out of the canvas designer. */
  designerExitHref?: string | null
  designerExitLabel?: string
  designerExitEventStatus?: string | null
  designerExitEventName?: string | null
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
export function FloorPlanV2(props: FloorPlanV2Props) {
  const debugGeometry = props.debugGeometry ?? false
  return (
    <DebugLogProvider>
      <PlacesApiStatusProvider>
        <FloorPlanV2Workspace {...props} debugGeometry={debugGeometry} />
      </PlacesApiStatusProvider>
    </DebugLogProvider>
  )
}

function FloorPlanV2Workspace({
  eventId,
  layoutRooms,
  layoutActiveRoomId,
  onLayoutRoomsChange,
  saveLayoutRef,
  layoutSnapshotRef,
  eventCategoryNames,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  baselineTableLengthFt,
  onBaselineTableLengthChange,
  layoutCapacity,
  configuredCategorySlots,
  applications,
  className,
  onOverlapChange,
  onSaveMarket,
  saveMarketDisabled,
  saveMarketLoading,
  onSaveDraft,
  saveDraftDisabled,
  saveDraftLoading,
  variant = 'wizard',
  chrome = 'default',
  onPlacedCountChange,
  onWizardInitialLayoutComplete,
  boothPlacementStatusByObjectId,
  boothMapLabelByObjectId,
  onStoreReady,
  onSelectionChange,
  onVendorDrop,
  debugGeometry = false,
  preferServerLayout = false,
  designerExitHref,
  designerExitLabel,
  designerExitEventStatus,
  designerExitEventName,
}: FloorPlanV2Props) {
  const initialDoc = useMemo<FloorPlanDoc>(
    () => hydrateFloorPlanDoc(eventId, layoutRooms, { preferServerLayout }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const disableAutoMainHall = true
  const store = useCanvasStore(initialDoc, {
    disableAutoMainHall,
    eventId: eventId ?? undefined,
  })
  const { addLog, logState, logError } = useDebugLog()

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
  const roomHandlersReady =
    Boolean(onAddRoom) && Boolean(onRenameRoom) && Boolean(onDeleteRoom)
  const showToolbarRoomControls =
    roomHandlersReady && (!isEmbedded || layoutRooms.length === 0)
  const commandCenterFullscreen = useCommandCenterFullscreen()
  const dashboardPreview = isDashboard && commandCenterFullscreen.previewMode
  const toolbarPortal = useDashboardToolbarPortal()
  const layoutSave = useDashboardLayoutSave()

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
        objectRoom: store.doc.objectRoom,
        doc: store.doc,
      }),
    [store.doc]
  )
  useEffect(() => {
    onOverlapChange?.(layoutOverlaps.size > 0)
  }, [layoutOverlaps.size, onOverlapChange])
  const [tool, setTool] = useState<ToolId>(DEFAULT_TOOL_STATE.tool)
  const [drawShape, setDrawShape] = useState<DrawShape>(
    DEFAULT_TOOL_STATE.drawShape
  )
  const [autoArrangeMode, setAutoArrangeMode] =
    useState<AutoArrangeMode>(isDashboard ? 'perimeter-only' : 'grid')
  const [rightInspectorOpen, setRightInspectorOpen] = useState(!isDashboard)
  const [showLabels, setShowLabels] = useState(true)
  const [boothMapLabelMode, setBoothMapLabelMode] = useState<BoothMapLabelMode>(
    () => {
      if (!isDashboard || typeof window === 'undefined') return 'vendor'
      try {
        const raw = window.localStorage.getItem('popup-hub:booth-map-label-mode')
        if (raw === 'category' || raw === 'boothId' || raw === 'vendor') return raw
      } catch {
        // ignore
      }
      return 'vendor'
    }
  )
  const [patronPathEnabled, setPatronPathEnabled] = useState(false)
  const [showClearanceWarnings, setShowClearanceWarnings] = useState(() =>
    readClearanceWarningsEnabled()
  )
  const clearanceIssueToastRef = useRef(false)
  const [unifiedLayoutOverlay, setUnifiedLayoutOverlay] = useState<{
    spinePath: ReadonlyArray<{ x: number; y: number }>
    clearanceField: UnifiedSolverMeta['clearanceField']
  } | null>(null)

  useEffect(() => {
    if (!isDashboard) return
    try {
      window.localStorage.setItem('popup-hub:booth-map-label-mode', boothMapLabelMode)
    } catch {
      // ignore
    }
  }, [boothMapLabelMode, isDashboard])
  const clearanceSummary = useMemo(
    () => summarizeDocClearanceIssues(store.doc),
    [store.doc]
  )

  useEffect(() => {
    if (!showClearanceWarnings) {
      clearanceIssueToastRef.current = false
      return
    }
    const hasIssues =
      clearanceSummary.criticalCount + clearanceSummary.tightCount > 0
    if (!hasIssues) {
      clearanceIssueToastRef.current = false
      return
    }
    if (clearanceIssueToastRef.current) return
    clearanceIssueToastRef.current = true
    const neighborTargets = 'another vendor, table, wall, or fixture'
    const parts: string[] = []
    if (clearanceSummary.tightCount > 0) {
      parts.push(
        `${clearanceSummary.tightCount} yellow (may be too close to ${neighborTargets})`
      )
    }
    if (clearanceSummary.criticalCount > 0) {
      parts.push(
        `${clearanceSummary.criticalCount} red (too close to ${neighborTargets})`
      )
    }
    toast.warning(
      `Booth boundary clearance: ${parts.join('; ')}. See the legend panel — hide warnings with the triangle icon in the header.`,
      { duration: 6000 }
    )
  }, [
    clearanceSummary.criticalCount,
    clearanceSummary.tightCount,
    showClearanceWarnings,
  ])

  useEffect(() => {
    writeClearanceWarningsEnabled(showClearanceWarnings)
  }, [showClearanceWarnings])

  const {
    layoutSpringPoses,
    startLayoutSpring,
  } = useLayoutSpringAnimation()

  const prevLayoutRoomCountRef = useRef(layoutRooms.length)
  useEffect(() => {
    const prevCount = prevLayoutRoomCountRef.current
    const nextCount = layoutRooms.length
    prevLayoutRoomCountRef.current = nextCount
    if (nextCount === 0 && tool !== 'hand') {
      setTool('hand')
      return
    }
    // Blank start forces Hand until a room exists; switch to Select so
    // resize handles appear and perimeter/interior drags work immediately.
    if (prevCount === 0 && nextCount > 0 && tool === 'hand') {
      setTool('select')
    }
  }, [layoutRooms.length, tool])

  // The wizard's room list is the canonical source of (rooms, names,
  // dims). The unified doc's `rooms` field is updated whenever the
  // wizard list changes — but we DON'T blow away in-progress object
  // edits, only re-sync the room frame metadata. This preserves the
  // user's draws and drags across add-room / rename-room flows.
  const lastRoomIdsKeyRef = useRef<string | null>(null)

  const syncLayoutRoomsToDoc = useCallback(() => {
    const idsKey = layoutRooms.map((r) => r.id).join('|')
    const isFirstSync = lastRoomIdsKeyRef.current === null
    lastRoomIdsKeyRef.current = idsKey

    // Build fresh frame data from the wizard rooms.
    const wizardFrames: RoomFrame[] = layoutRooms.map((r) => ({
      id: r.id,
      name: r.name,
      originX: Math.max(0, r.canvas_origin_x ?? 0),
      originY: Math.max(0, r.canvas_origin_y ?? 0),
      widthFt: r.venue_width || 50,
      lengthFt: r.venue_length || 50,
    }))
    const docFrames = store.doc.rooms ?? []
    const docFrameById = new Map(docFrames.map((f) => [f.id, f]))

    // Reconcile: keep doc-side origin (so a freshly-dragged room
    // doesn't snap back to the wizard's stored origin until save),
    // but pull through any name / size changes from the wizard.
    const merged: RoomFrame[] = wizardFrames.map((wf) => {
      const existing = docFrameById.get(wf.id)
      if (!existing) return wf
      // Keep canvas geometry (drag, resize, rotate). Wizard only
      // updates the display name while the editor is open.
      return {
        ...existing,
        name: wf.name,
      }
    })

    const sameFrames =
      merged.length === docFrames.length &&
      merged.every((m) => {
        const d = docFrameById.get(m.id)
        return (
          d &&
          d.name === m.name &&
          d.widthFt === m.widthFt &&
          d.lengthFt === m.lengthFt &&
          d.originX === m.originX &&
          d.originY === m.originY
        )
      })

    // First sync after mount: when wizard and doc already agree on the
    // same room ids, only reconcile canvas extents (crash-recovery
    // drafts can undersize the workspace vs room union). When the
    // wizard has rooms the doc doesn't know about yet, fall through
    // and merge normally so secondary rooms aren't trapped inside the
    // primary hall bounds.
    if (isFirstSync && docFrames.length > 0) {
      const wizardIdSet = new Set(wizardFrames.map((f) => f.id))
      const sameRoomSet =
        wizardIdSet.size === docFrames.length &&
        docFrames.every((f) => wizardIdSet.has(f.id))
      if (sameRoomSet) {
        const extents = reconcileCanvasExtents(merged)
        if (
          store.doc.canvasWidthFt !== extents.canvasWidthFt ||
          store.doc.canvasLengthFt !== extents.canvasLengthFt ||
          !sameFrames
        ) {
          store.patchDoc(
            {
              rooms: merged,
              canvasWidthFt: extents.canvasWidthFt,
              canvasLengthFt: extents.canvasLengthFt,
            },
            { pushHistory: false }
          )
        }
        return
      }
    }

    if (sameFrames) return

    const extents = reconcileCanvasExtents(merged)
    store.patchDoc(
      {
        rooms: merged,
        canvasWidthFt: extents.canvasWidthFt,
        canvasLengthFt: extents.canvasLengthFt,
      },
      { pushHistory: false }
    )
    // Note: any objects that belonged to a now-deleted room get left
    // in the doc orphaned; the save bridge folds them into the first
    // surviving room as a safety net.
  }, [layoutRooms, store])

  // Run before paint so a newly added wizard room is placeable immediately.
  useLayoutEffect(() => {
    syncLayoutRoomsToDoc()
  }, [syncLayoutRoomsToDoc])

  // The "active room" follows the wizard's `layoutActiveRoomId` so
  // sidebar selections in the parent flow keep working. Selection of
  // a room *frame* on the canvas (the new "click the wall to drag
  // the room" gesture) is a separate piece of state — we only mark
  // a frame as the canvas selection while the user is interacting
  // with it.
  const activeRoomId = layoutActiveRoomId
  const patronPathfinding = usePathfinding(store.doc, activeRoomId, {
    enabled: patronPathEnabled,
    cellFt: store.doc.snapFt,
  })
  const patronTrafficPath = patronPathfinding.path
  const pathfindingBottleneckIds = useMemo(
    () => new Set(patronPathfinding.bottleneckBoothIds),
    [patronPathfinding.bottleneckBoothIds]
  )
  const patronAisleCorridors = usePatronAisleOverlay(
    store.doc,
    activeRoomId,
    patronPathEnabled
  )
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
    fitViewportToContent(
      viewportApiRef.current,
      store.doc,
      activeRoomId
    )
    focusFloorPlanCanvas()
  }, [activeRoomId, store.doc])

  useEffect(() => {
    setPatronPathEnabled(false)
    setUnifiedLayoutOverlay(null)
  }, [activeRoomId])

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

  useEffect(() => {
    if (layoutRooms.length > 0) return
    if (eventId) clearMultiRoomDraft(eventId)
    setSuppressAutoMainHall(true, eventId ?? undefined)
    store.resetState()
    setSelectedRoomIds(new Set())
    setSelectedRoomId(null)
    logState('layoutRooms empty: blank canvas (no room frames or fixtures)')
  }, [eventId, layoutRoomIdsKey, layoutRooms.length, logState, store])

  const highlightedRoomId = selectedRoomId ?? activeRoomId
  const [tableSizeUnits] = useTableSizeUnits()
  const highlightedRoomMetrics = useMemo(() => {
    const frame = (store.doc.rooms ?? []).find((r) => r.id === highlightedRoomId)
    if (!frame) return null
    return {
      name: frame.name,
      widthFt: frame.widthFt,
      lengthFt: frame.lengthFt,
    }
  }, [store.doc.rooms, highlightedRoomId])

  const highlightedSelectionMetrics = useMemo(() => {
    if (store.selectedIds.size !== 1) return null
    const obj = store.doc.objects.find((o) => store.selectedIds.has(o.id))
    if (!obj) return null
    return formatObjectDimensions(obj, tableSizeUnits)
  }, [store.selectedIds, store.doc.objects, tableSizeUnits])

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
  const [defaultPlacementSpec, setDefaultPlacementSpec] = useState<TableSizeSpec>(() =>
    vendorTableSpec(safeTableSizeFt)
  )
  const defaultPlacementSpecRef = useRef(defaultPlacementSpec)

  const syncPlacementTemplate = useCallback((spec: TableSizeSpec) => {
    defaultPlacementSpecRef.current = spec
    setDefaultPlacementSpec(spec)
  }, [])

  const applyDefaultPlacementSpec = useCallback(
    (
      nextDefaultPlacement: TableSizeSpec,
      options?: { activateDraw?: boolean }
    ) => {
      syncPlacementTemplate(nextDefaultPlacement)
      if (options?.activateDraw ?? nextDefaultPlacement.purpose === 'guest') {
        setTool('draw')
        setDrawShape('booth')
      }
      if (
        nextDefaultPlacement.purpose === 'vendor' &&
        nextDefaultPlacement.shape === 'rectangular'
      ) {
        onBaselineTableLengthChange?.(
          nextDefaultPlacement.ft as LayoutBaselineTableLengthFt
        )
        const grid = canvasGridDocPatch()
        store.patchDoc(grid, { pushHistory: false })
      }
    },
    [onBaselineTableLengthChange, store, syncPlacementTemplate]
  )

  // Sync only when the wizard-owned baseline changes — not on every doc
  // mutation (store identity changes whenever `doc` updates).
  useEffect(() => {
    setDefaultPlacementSpec((prev) => {
      if (prev.purpose !== 'vendor') return prev
      const next = vendorTableSpec(safeTableSizeFt)
      defaultPlacementSpecRef.current = next
      return next
    })
    store.patchDoc(canvasGridDocPatch(), { pushHistory: false })
  }, [safeTableSizeFt, store.patchDoc])

  /** Toolbar pill reflects the next-placement template — not the selection. */
  const tableSizePillValue = defaultPlacementSpec

  const handleTableSizeChange = useCallback(
    (selection: TableSizeSpec) => {
      const normalized = normalizeTableSizeSpec(selection, safeTableSizeFt)
      // Left-panel size controls only update the draw template; placed objects
      // keep the dimensions copied at drop time.
      applyDefaultPlacementSpec(normalized)
      store.setSelection([])
    },
    [store, safeTableSizeFt, applyDefaultPlacementSpec]
  )

  const handlePrepareTableDraw = useCallback(
    (selection: TableSizeSpec) => {
      const normalized = normalizeTableSizeSpec(selection, safeTableSizeFt)
      const { nextDefaultPlacement } = planTableSizeChange({
        objects: store.doc.objects,
        selectedIds: store.selectedIds,
        selection: normalized,
        templateOnly: true,
      })
      if (nextDefaultPlacement != null) {
        applyDefaultPlacementSpec(nextDefaultPlacement, { activateDraw: true })
        store.setSelection([])
      } else {
        setTool('draw')
        setDrawShape('booth')
      }
    },
    [store, safeTableSizeFt, applyDefaultPlacementSpec]
  )

  const scheduleLayoutAutosave = useCallback(() => {
    if (!eventId) return
    if (
      layoutRooms.length === 0 &&
      (store.doc.rooms?.length ?? 0) === 0 &&
      store.doc.objects.length === 0
    ) {
      clearMultiRoomDraft(eventId)
      return
    }
    layoutSave?.scheduleAutosave(() => {
      saveMultiRoomDraft(eventId, store.doc)
    })
  }, [eventId, layoutRooms.length, layoutSave, store.doc])

  const handleToolChange = useCallback((next: ToolId) => {
    setTool(next)
  }, [])

  /** Booth stamping stays armed until the coordinator picks another tool. */
  const handleAfterDrawCommit = useCallback(() => {
    if (tool === 'draw' && drawShape === 'booth') {
      store.clearSelection()
      return
    }
    if (isDashboard) {
      store.clearSelection()
      return
    }
    setTool('select')
  }, [drawShape, isDashboard, store, tool])

  const handleDrawShapeChange = useCallback((next: DrawShape) => {
    setDrawShape(next)
  }, [])

  const handleClearAll = useCallback(() => {
    hardResetCanvas()
    setSuppressAutoMainHall(true, eventId ?? undefined)
    onLayoutRoomsChange([], '')
    toast.success('Canvas cleared — add a room when you are ready')
  }, [eventId, hardResetCanvas, onLayoutRoomsChange])

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
    const removableIds = removable.map((o) => o.id)
    const lockedCount = lockedSelected.length
    // Urgent commit — keep outside startTransition so the canvas paints
    // the removal before deferred pathfinding / aisle overlays recompute.
    store.removeObjects(removableIds)
    if (lockedCount > 0) {
      startTransition(() => {
        toast.message(
          `Locked fixtures retained (${lockedCount}).`,
          { duration: 1500 }
        )
      })
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

  const handleDistributeSelection = useCallback(
    (orientation: 'vertical' | 'horizontal') => {
      const ids = store.selectedIds
      if (ids.size < 3) {
        toast.message('Select three or more objects to distribute spacing.')
        return false
      }
      const selected = store.doc.objects.filter((o) => ids.has(o.id))
      if (selected.length < 3) return false
      const axis: 'x' | 'y' = orientation === 'horizontal' ? 'x' : 'y'
      const patches = distributeSelectionPatches(
        selected,
        axis,
        store.doc.canvasWidthFt,
        store.doc.canvasLengthFt
      )
      if (patches.length === 0) {
        toast.message('Already evenly spaced.')
        return false
      }
      store.updateObjects(patches)
      toast.success(
        orientation === 'horizontal'
          ? `Distributed ${patches.length} object${patches.length === 1 ? '' : 's'} with equal horizontal spacing.`
          : `Distributed ${patches.length} object${patches.length === 1 ? '' : 's'} with equal vertical spacing.`,
        { duration: 1500 }
      )
      return true
    },
    [store]
  )

  const handleDistributeHorizontal = useCallback(
    () => handleDistributeSelection('horizontal'),
    [handleDistributeSelection]
  )
  const handleDistributeVertical = useCallback(
    () => handleDistributeSelection('vertical'),
    [handleDistributeSelection]
  )

  const [wizardCanvasFullscreen, setWizardCanvasFullscreen] = useState(false)
  const dualScreenWindowRefs = useRef<Partial<Record<DualScreenMode, Window | null>>>({})
  const [dualScreenActive, setDualScreenActive] = useState(false)

  const handleLaunchDualScreen = useCallback(
    (mode: DualScreenMode) => {
      if (!isDashboard) return
      const existing = dualScreenWindowRefs.current[mode]
      if (existing && !existing.closed) {
        existing.focus()
        setDualScreenActive(true)
        return
      }
      const opened = openDualScreenWindow(eventId ?? null, mode)
      dualScreenWindowRefs.current[mode] = opened
      setDualScreenActive(Boolean(opened))
      if (!opened) {
        toast.error(
          'Pop-up blocked — allow pop-ups for this site to use dual-screen mode.'
        )
      }
    },
    [eventId, isDashboard]
  )

  useEffect(() => {
    if (!isDashboard) return
    const timer = window.setInterval(() => {
      let anyOpen = false
      for (const mode of ['presenter', 'wall-cast'] as const) {
        const win = dualScreenWindowRefs.current[mode]
        if (win && win.closed) {
          dualScreenWindowRefs.current[mode] = null
        } else if (win && !win.closed) {
          anyOpen = true
        }
      }
      setDualScreenActive(anyOpen)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [isDashboard])

  /** Command center panels mode — hides side columns, not native canvas overlay. */
  const dashboardImmersive = isDashboard && commandCenterFullscreen.fullscreen
  /**
   * Native `popup-hub-canvas-fullscreen` pins the canvas over the viewport and
   * blocks site/dashboard chrome clicks — never enable on the command center.
   */
  const layoutNativeFullscreen = isDashboard ? false : wizardCanvasFullscreen
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
    if (dashboardPreview) return

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
        scheduleLayoutAutosave()
        return
      }
      if (cmd && ((e.shiftKey && key === 'z') || key === 'y')) {
        e.preventDefault()
        store.redo()
        scheduleLayoutAutosave()
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
        if (layoutNativeFullscreen) {
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
    dashboardPreview,
    layoutNativeFullscreen,
    scheduleLayoutAutosave,
    setCanvasFullscreen,
    store,
  ])

  useEffect(() => {
    if (!layoutSnapshotRef) return
    layoutSnapshotRef.current = () => {
      if (layoutRooms.length === 0) return null
      const projectedRooms = legacyRoomsFromDoc(layoutRooms, store.doc)
      return { rooms: projectedRooms, activeRoomId }
    }
    return () => {
      if (layoutSnapshotRef.current) layoutSnapshotRef.current = null
    }
  }, [activeRoomId, layoutRooms, layoutSnapshotRef, store.doc])

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

      try {
        const { data: limits } = await supabase
          .from('event_category_limits')
          .select('category_id, category:categories(name)')
          .eq('event_id', eventId)
        const categoryNameToId: Record<string, string> = {}
        for (const row of limits ?? []) {
          const category = Array.isArray(row.category) ? row.category[0] : row.category
          const name = (category as { name?: string } | null)?.name?.trim()
          if (name) categoryNameToId[name] = row.category_id as string
        }
        const booths = store.doc.objects.filter(
          (o): o is import('./state/types').BoothObject =>
            o.kind === 'booth' && (o.tablePurpose ?? 'vendor') === 'vendor'
        )
        const { syncEventBoothSlots } = await import('@/lib/floor-plan/sync-booth-slots')
        await syncEventBoothSlots(supabase, { eventId, booths, categoryNameToId })
      } catch {
        // Booth slot sync is best-effort after layout save
      }
      // Server is now the source of truth — drop the unified
      // crash-recovery draft so a future refresh loads from Supabase.
      clearMultiRoomDraft(eventId)
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

  /** Vendor booths in the active room — excludes walls, doors, exits, and patron tables. */
  const vendorBoothCount = useMemo(
    () => vendorBoothsInRoom(store.doc, activeRoomId).length,
    [activeRoomId, store.doc]
  )

  const commitVendorPackWithSpring = useCallback(
    (
      beforeBooths: ReturnType<typeof vendorBoothsInRoom>,
      packedBooths: ReturnType<typeof vendorBoothsInRoom>,
      packedDoc: FloorPlanDoc
    ) => {
      const targets = layoutSpringTargetsFromBooths(beforeBooths, packedBooths)
      if (targets.length === 0) {
        store.replaceObjects(packedDoc.objects)
        return
      }
      startLayoutSpring(targets, {
        stiffness: 190,
        damping: 24,
        onComplete: () => {
          store.replaceObjects(packedDoc.objects)
        },
      })
    },
    [startLayoutSpring, store]
  )

  const placedCount = vendorBoothCount
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
    (doc: FloorPlanDoc, nextActiveRoomId?: string) => {
      if (layoutRooms.length === 0) return
      const projected = legacyRoomsFromDoc(layoutRooms, doc)
      const liveIds = new Set((doc.rooms ?? []).map((r) => r.id))
      const resolvedActive =
        nextActiveRoomId && liveIds.has(nextActiveRoomId)
          ? nextActiveRoomId
          : liveIds.has(activeRoomId)
            ? activeRoomId
            : (projected[0]?.id ?? activeRoomId)
      onLayoutRoomsChange(projected, resolvedActive)
    },
    [activeRoomId, layoutRooms, onLayoutRoomsChange]
  )

  const wizardInitialLayoutRanRef = useRef(false)

  useEffect(() => {
    if (variant !== 'wizard') return
    if (wizardInitialLayoutRanRef.current) return
    if (!configuredCategorySlots?.length) return
    if (
      !shouldRunWizardInitialLayout(
        layoutRooms,
        store.doc,
        configuredCategorySlots
      )
    ) {
      return
    }

    const roomId =
      activeRoomId && layoutRooms.some((r) => r.id === activeRoomId)
        ? activeRoomId
        : layoutRooms[0]?.id
    if (!roomId) return

    const frame = (store.doc.rooms ?? []).find((r) => r.id === roomId)
    if (!frame) return

    wizardInitialLayoutRanRef.current = true

    const result = runWizardInitialLayout({
      doc: store.doc,
      roomId,
      categorySlots: configuredCategorySlots,
      baselineTableLengthFt: safeTableSizeFt,
      layoutCapacity,
      eventCategoryNames,
    })

    if (result.placedCount <= 0) {
      wizardInitialLayoutRanRef.current = false
      return
    }

    store.replaceObjects(result.doc.objects, { pushHistory: false })
    store.patchDoc({ objectRoom: result.doc.objectRoom ?? {} }, { pushHistory: false })
    syncLayoutRoomsFromDoc(store.readDoc(), roomId)
    resetCanvasViewport()
    onWizardInitialLayoutComplete?.({ placedCount: result.placedCount })
    logState(
      `wizardInitialLayout(): placed ${result.placedCount}/${result.requestedCount} vendor booths in ${frame.name}`
    )
  }, [
    activeRoomId,
    configuredCategorySlots,
    eventCategoryNames,
    layoutCapacity,
    layoutRooms,
    logState,
    onWizardInitialLayoutComplete,
    resetCanvasViewport,
    safeTableSizeFt,
    store,
    syncLayoutRoomsFromDoc,
    variant,
  ])

  const handleRoomGeometryCommit = useCallback(() => {
    syncLayoutRoomsFromDoc(store.readDoc())
  }, [store, syncLayoutRoomsFromDoc])

  const handlePatchRoomDimensions = useCallback(
    (roomId: string, patch: { widthFt: number; lengthFt: number }) => {
      const frame = store.readDoc().rooms?.find((f) => f.id === roomId)
      if (!frame || frame.mergedIntoObjectId) return
      const ok = store.resizeRoomFrame(roomId, {
        originX: frame.originX,
        originY: frame.originY,
        widthFt: patch.widthFt,
        lengthFt: patch.lengthFt,
      })
      if (!ok) {
        toast.message(
          'Room size exceeds canvas limits — try a smaller width or length.'
        )
        return
      }
      syncLayoutRoomsFromDoc(store.readDoc())
    },
    [store, syncLayoutRoomsFromDoc]
  )

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
    viewportApiRef.current?.resetViewport()
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
        { padding: VIEWPORT_FIT_PADDING }
      )
    } else {
      fitViewportToContent(api, store.doc, activeRoomId)
    }
    recoverCanvasFocus()
  }, [activeRoomId, addLog, recoverCanvasFocus, store.doc])


  /**
   * Auto-Arrange — scoped to the *active* room only on the unified
   * canvas. We translate that room's booths back to local coords,
   * run the v1 row-pack engine (which expects a single room sized
   * doc), then translate the result back to global coords and merge
   * into the unified doc with a single history step.
   */
  const patronTableCount = useMemo(() => {
    const objectRoom = store.doc.objectRoom ?? {}
    return store.doc.objects.filter(
      (o) =>
        o.kind === 'booth' &&
        objectRoom[o.id] === activeRoomId &&
        isGuestTableBooth(o)
    ).length
  }, [activeRoomId, store.doc.objects, store.doc.objectRoom])

  const vendorTableMetaByKey = useMemo(() => {
    if (!applications?.length) return undefined
    return vendorTableMetaFromApplications(applications, safeTableSizeFt)
  }, [applications, safeTableSizeFt])

  const trafficFlowPrerequisites = useMemo(
    () => evaluateTrafficFlowPrerequisites(store.doc, activeRoomId),
    [activeRoomId, store.doc]
  )

  const autoArrangeDisabledReason = useMemo(() => {
    if (vendorBoothCount === 0 && patronTableCount === 0) {
      return 'Draw at least one vendor booth or patron table to auto-arrange.'
    }
    if (
      autoArrangeMode !== 'grid' &&
      !trafficFlowPrerequisites.satisfied
    ) {
      return AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP
    }
    return null
  }, [
    autoArrangeMode,
    patronTableCount,
    trafficFlowPrerequisites.satisfied,
    vendorBoothCount,
  ])

  const canAutoArrangeFloorPlan =
    vendorBoothCount > 0 ||
    patronTableCount > 0

  const fillRoomDisabledReason = useMemo(() => {
    const frame = (store.doc.rooms ?? []).find((r) => r.id === activeRoomId)
    if (!frame || frame.mergedIntoObjectId) {
      return 'Select a room on the canvas first.'
    }
    return null
  }, [activeRoomId, store.doc.rooms])

  const vendorFillTableSpec = useMemo((): TableSizeSpec => {
    if (defaultPlacementSpec.purpose === 'vendor') return defaultPlacementSpec
    return vendorTableSpec(safeTableSizeFt)
  }, [defaultPlacementSpec, safeTableSizeFt])

  const patronFillTableSpec = useMemo((): TableSizeSpec => {
    if (defaultPlacementSpec.purpose === 'guest') return defaultPlacementSpec
    return guestRoundTableSpec(6)
  }, [defaultPlacementSpec])

  const vendorFillMaxCapacity = useMemo(
    () =>
      fillRoomDisabledReason
        ? 0
        : estimateRoomFillCapacity(store.doc, activeRoomId, vendorFillTableSpec, {
            autoArrangeMode,
            layoutCapacity,
          }),
    [
      activeRoomId,
      autoArrangeMode,
      fillRoomDisabledReason,
      layoutCapacity,
      store.doc,
      vendorFillTableSpec,
    ]
  )

  const patronFillMaxCapacity = useMemo(
    () =>
      fillRoomDisabledReason
        ? 0
        : estimateRoomFillCapacity(store.doc, activeRoomId, patronFillTableSpec, {
            autoArrangeMode,
          }),
    [
      activeRoomId,
      autoArrangeMode,
      fillRoomDisabledReason,
      patronFillTableSpec,
      store.doc,
    ]
  )

  const applyFillRoomResult = useCallback(
    (
      result: ReturnType<typeof fillRoomWithTables>,
      frameName: string,
      label: string
    ) => {
      if (result.placedCount <= 0) {
        toast.error(
          `Could not fit any ${label} inside ${frameName} — try a smaller count or larger room.`
        )
        return
      }

      if (result.arrange?.roomScaledForPatronPath) {
        store.patchDoc({
          rooms: result.doc.rooms,
          canvasWidthFt: result.doc.canvasWidthFt,
          canvasLengthFt: result.doc.canvasLengthFt,
        })
      }
      store.replaceObjects(result.doc.objects)
      syncLayoutRoomsFromDoc(store.readDoc())
      resetCanvasViewport()

      const dropped = result.requestedCount - result.placedCount
      if (dropped > 0) {
        toast.warning(
          `Placed ${result.placedCount} of ${result.requestedCount} ${label} — ${dropped} could not fit.`,
          { duration: 5000 }
        )
      } else {
        toast.success(
          `Filled ${frameName} with ${result.placedCount} ${label}.`,
          { duration: 3500 }
        )
      }
    },
    [resetCanvasViewport, store, syncLayoutRoomsFromDoc]
  )

  const handleFillVendorTables = useCallback(
    (count: number) => {
      const frame = (store.doc.rooms ?? []).find((r) => r.id === activeRoomId)
      if (!frame) {
        toast.error('Select a room on the canvas first.')
        return
      }
      const result = fillRoomWithTables({
        doc: store.doc,
        roomId: activeRoomId,
        count,
        tableSpec: vendorFillTableSpec,
        scope: 'vendor',
        eventCategoryNames,
        layoutCapacity,
        autoArrangeMode,
      })
      applyFillRoomResult(result, frame.name, 'vendor tables')
    },
    [
      activeRoomId,
      applyFillRoomResult,
      autoArrangeMode,
      eventCategoryNames,
      layoutCapacity,
      store.doc,
      vendorFillTableSpec,
    ]
  )

  const handleFillPatronTables = useCallback(
    (count: number) => {
      const frame = (store.doc.rooms ?? []).find((r) => r.id === activeRoomId)
      if (!frame) {
        toast.error('Select a room on the canvas first.')
        return
      }
      const result = fillRoomWithTables({
        doc: store.doc,
        roomId: activeRoomId,
        count,
        tableSpec: patronFillTableSpec,
        scope: 'patron',
        autoArrangeMode,
      })
      applyFillRoomResult(result, frame.name, 'patron tables')
    },
    [
      activeRoomId,
      applyFillRoomResult,
      autoArrangeMode,
      patronFillTableSpec,
      store.doc,
    ]
  )

  const handleAutoArrangeFloorPlan = useCallback(async () => {
    if (vendorBoothCount === 0 && patronTableCount === 0) {
      toast.message('Nothing to arrange — draw at least one vendor booth or patron table first.')
      return
    }
    if (
      autoArrangeMode !== 'grid' &&
      !trafficFlowPrerequisites.satisfied
    ) {
      toast.message(AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP, { duration: 4500 })
      return
    }

    const frame = (store.doc.rooms ?? []).find((r) => r.id === activeRoomId)
    if (!frame) {
      toast.error('Select a room on the canvas before auto-arranging.')
      return
    }

    if (autoArrangeMode === 'grid') {
      const result = autoArrangeInRoom(store.doc, activeRoomId, {
        scope: 'all',
        mode: autoArrangeMode,
        eventCategoryNames,
        baselineTableLengthFt: safeTableSizeFt,
        vendorTableMetaByKey,
        dropUnplacedBooths: true,
        ...(typeof layoutCapacity === 'number' && layoutCapacity > 0
          ? { maxBooths: layoutCapacity }
          : {}),
      })
      if (!result) {
        toast.error('Auto-arrange failed — room dimensions could not be read.')
        return
      }
      if (result.placedCount === 0) {
        toast.error(
          `Auto-arrange could not fit any objects inside ${frame.name} (${frame.widthFt}′ × ${frame.lengthFt}′).`
        )
        return
      }
      if (result.roomScaledForPatronPath) {
        store.patchDoc({
          rooms: result.doc.rooms,
          canvasWidthFt: result.doc.canvasWidthFt,
          canvasLengthFt: result.doc.canvasLengthFt,
        })
      }
      store.replaceObjects(result.doc.objects)
      if (result.roomScaledForPatronPath && result.densityWarning) {
        toast.info(result.densityWarning, { duration: 6000 })
      } else if (result.densityWarning) {
        toast.warning(result.densityWarning, { duration: 6500 })
      }
      const removed = result.removedOverlapCount
      const overflow = result.overflowCount + result.droppedCount
      if (removed > 0) {
        toast.warning(
          `Could only fit ${result.placedCount} booth${result.placedCount === 1 ? '' : 's'} safely. Removed ${removed} overlapping item${removed === 1 ? '' : 's'}.`,
          { duration: 5500 }
        )
      } else if (overflow > 0) {
        toast.warning(
          `Auto-arranged ${result.placedCount} object${result.placedCount === 1 ? '' : 's'}; ${overflow} could not fit in the room.`,
          { duration: 4500 }
        )
      } else if (result.unsatisfiedCategoryCount > 0) {
        toast.warning(
          `Auto-arranged ${result.placedCount} object${result.placedCount === 1 ? '' : 's'}. ${result.unsatisfiedCategoryCount} could not meet category spacing rules.`,
          { duration: 4500 }
        )
      } else {
        toast.success(
          `Auto-arranged ${result.placedCount} object${result.placedCount === 1 ? '' : 's'} in ${frame.name} (${frame.widthFt}′ × ${frame.lengthFt}′).`
        )
      }
      return
    }

    const arrangeOptions = {
      scope: 'all' as const,
      mode: autoArrangeMode,
      layoutSolver: 'unified' as const,
      eventCategoryNames,
      baselineTableLengthFt: safeTableSizeFt,
      vendorTableMetaByKey,
      ...(typeof layoutCapacity === 'number' && layoutCapacity > 0
        ? { maxBooths: layoutCapacity }
        : {}),
    }
    const loading = toast.loading('Optimizing floor plan…')
    try {
      const result = await runAutoArrangeWithAi(
        store.doc,
        activeRoomId,
        arrangeOptions
      )
      if (!result) return
      if (result.perimeterCapacityError) {
        toast.error(result.perimeterCapacityError, { duration: 6000 })
        return
      }
      if (result.patronArrangeAborted) {
        toast.warning(result.patronArrangeAborted, { duration: 5000 })
        return
      }
      if (result.placedCount === 0) {
        toast.error('Auto-arrange could not fit any booths or tables inside the room.')
        return
      }
      store.replaceObjects(result.doc.objects)
      if (result.unifiedMeta) {
        setUnifiedLayoutOverlay({
          spinePath: result.unifiedMeta.pathway,
          clearanceField: result.unifiedMeta.clearanceField,
        })
        setPatronPathEnabled(true)
      }
      const spaceOverflow = result.overflowCount + result.droppedCount
      if (spaceOverflow > 0) {
        toast.warning(
          `Could not reposition ${spaceOverflow} asset${spaceOverflow === 1 ? '' : 's'} due to space restrictions (left in place).`,
          { duration: 5000 }
        )
      } else if (result.unsatisfiedCategoryCount > 0) {
        toast.warning(
          `Auto-arrange complete. ${result.unsatisfiedCategoryCount} vendor booth${result.unsatisfiedCategoryCount === 1 ? '' : 's'} could not meet the 5-space / 2-row separation rule due to space constraints.`,
          { duration: 4500 }
        )
      } else if (result.aiOptimized) {
        toast.success(
          `AI arranged ${result.placedCount} asset${result.placedCount === 1 ? '' : 's'} (${result.aiModel ?? 'Gemini'}).`
        )
      } else {
        toast.success(
          `Auto-arranged ${result.placedCount} asset${result.placedCount === 1 ? '' : 's'} with traffic-flow clearance.`
        )
      }
    } finally {
      toast.dismiss(loading)
    }
  }, [
    activeRoomId,
    autoArrangeMode,
    eventCategoryNames,
    layoutCapacity,
    patronTableCount,
    safeTableSizeFt,
    store,
    trafficFlowPrerequisites.satisfied,
    vendorBoothCount,
    vendorTableMetaByKey,
  ])

  const handleAutoLayoutAndPathfind = useCallback(() => {
    if (vendorBoothCount === 0) {
      toast.message('Nothing to layout — draw at least one vendor booth first.')
      return
    }

    const booths = vendorBoothsInRoom(store.doc, activeRoomId)
    const before = booths.map((b) => ({ ...b }))
    const cleared = booths.map((b) => ({ ...b, x: 0, y: 0, rotation: 0 }))
    const packResult = PackBooths(store.doc, activeRoomId, cleared, {
      layoutSolver: 'unified',
      eventCategoryNames,
    })
    const packedDoc = applyPackedBoothsToDoc(
      store.doc,
      activeRoomId,
      packResult.booths
    )
    const pathResult = CalculateOptimalPath(packedDoc, activeRoomId)

    commitVendorPackWithSpring(before, packResult.booths, packedDoc)
    if (packResult.unifiedMeta) {
      setUnifiedLayoutOverlay({
        spinePath: packResult.unifiedMeta.pathway,
        clearanceField: packResult.unifiedMeta.clearanceField,
      })
      setPatronPathEnabled(true)
    } else {
      setPatronPathEnabled((pathResult?.path.length ?? 0) >= 2)
    }

    if (pathResult?.bottleneckBoothIds?.length) {
      setPatronPathEnabled(true)
    }

    if (packResult.placedCount === 0) {
      toast.error('Auto-layout could not fit any booths inside the merged zone.')
      return
    }

    const dropped = packResult.droppedCount
    if (dropped > 0) {
      toast.warning(
        `Packed ${packResult.placedCount} booth${packResult.placedCount === 1 ? '' : 's'}; ${dropped} could not fit.`,
        { duration: 5000 }
      )
    } else if (pathResult) {
      if (pathResult.isPartial) {
        toast.warning(
          `Patron path routed through tight aisles — ${pathResult.bottleneckBoothIds?.length ?? 0} bottleneck booth${(pathResult.bottleneckBoothIds?.length ?? 0) === 1 ? '' : 's'} highlighted in red.`,
          { duration: 5500 }
        )
      }
      toast.success(
        `Auto-layout complete — patron path visits ${pathResult.visitOrder.length} booth${pathResult.visitOrder.length === 1 ? '' : 's'} (${Math.round(pathResult.totalDistanceFt)}′).`
      )
    } else {
      toast.success(
        `Packed ${packResult.placedCount} booth${packResult.placedCount === 1 ? '' : 's'}. Add entrance/exit doors to visualize traffic flow.`
      )
    }
  }, [activeRoomId, commitVendorPackWithSpring, eventCategoryNames, store, vendorBoothCount])

  const handleAutoArrange = useCallback(() => {
    if (vendorBoothCount === 0) {
      toast.message('Nothing to arrange — draw at least one vendor booth first.')
      return
    }

    const frame = (store.doc.rooms ?? []).find((r) => r.id === activeRoomId)
    if (!frame) {
      toast.error('Select a room on the canvas before auto-arranging.')
      return
    }

    const booths = vendorBoothsInRoom(store.doc, activeRoomId)
    const before = booths.map((b) => ({ ...b }))
    const cleared = booths.map((b) => ({ ...b, x: 0, y: 0, rotation: 0 }))
    const packResult = PackBooths(store.doc, activeRoomId, cleared, {
      layoutSolver: 'unified',
      eventCategoryNames,
    })
    const packedDoc = applyPackedBoothsToDoc(
      store.doc,
      activeRoomId,
      packResult.booths
    )

    commitVendorPackWithSpring(before, packResult.booths, packedDoc)
    if (packResult.unifiedMeta) {
      setUnifiedLayoutOverlay({
        spinePath: packResult.unifiedMeta.pathway,
        clearanceField: packResult.unifiedMeta.clearanceField,
      })
      setPatronPathEnabled(true)
    }

    if (packResult.placedCount === 0) {
      toast.error(
        `Auto-arrange could not fit any vendor booths inside ${frame.name}. Check that a merged zone or room boundary exists.`
      )
      return
    }

    const dropped = packResult.droppedCount
    if (dropped > 0) {
      toast.warning(
        `Auto-arranged ${packResult.placedCount} booth${packResult.placedCount === 1 ? '' : 's'} inside the merged zone; ${dropped} could not fit and ${dropped === 1 ? 'was' : 'were'} left unplaced.`,
        { duration: 5000 }
      )
    } else {
      toast.success(
        `Auto-arranged ${packResult.placedCount} booth${packResult.placedCount === 1 ? '' : 's'} in ${frame.name} with traffic-optimized layout and 3′ clearance.`
      )
    }
  }, [activeRoomId, commitVendorPackWithSpring, eventCategoryNames, store, vendorBoothCount])

  const handlePatronPathToggle = useCallback(() => {
    setPatronPathEnabled((enabled) => {
      const next = !enabled
      if (next) {
        toast.message('Patron flow overlay on — green bands show 6′ walking aisles.', {
          duration: 3200,
        })
      }
      return next
    })
  }, [])

  const handleClearanceWarningsToggle = useCallback(() => {
    setShowClearanceWarnings((enabled) => {
      const next = !enabled
      if (next) {
        toast.message(
          'Clearance warnings on — yellow when a booth may be too close to another vendor, table, wall, or fixture; red when it is too close.',
          { duration: 4200 }
        )
      } else {
        toast.message(
          'Clearance warnings hidden — re-enable anytime with the triangle icon in the header toolbar.',
          { duration: 4200 }
        )
      }
      return next
    })
  }, [])

  const handleAddRoomWithSelectTool = useCallback(
    (options?: import('@/lib/coordinator/add-layout-room').AddLayoutRoomOptions) => {
      onAddRoom?.(options)
      setTool('select')
    },
    [onAddRoom]
  )

  const handleSelectRoom = useCallback(
    (roomId: string) => {
      onLayoutRoomsChange(layoutRooms, roomId)
      setSelectedRoomId(roomId)
      setSelectedRoomIds(new Set([roomId]))
      store.clearSelection()
      setTool('select')
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
      setTool('select')
      if (roomId !== activeRoomId) {
        onLayoutRoomsChange(layoutRooms, roomId)
      }
    },
    [activeRoomId, layoutRooms, onLayoutRoomsChange, store]
  )


  const portalToolbarToTop =
    isDashboard &&
    Boolean(toolbarPortal?.topBarActive && toolbarPortal.target)

  const portalHeaderToolbarToHeader =
    isDashboard &&
    Boolean(toolbarPortal?.headerBarActive && toolbarPortal.headerTarget)

  const resolvedDesignerExitHref =
    designerExitHref ??
    (eventId
      ? resolveDesignerExitHref(eventId, designerExitEventStatus, 'auto')
      : null)
  const resolvedDesignerExitLabel =
    designerExitLabel ??
    resolveDesignerExitLabel(
      designerExitEventName,
      designerExitEventStatus,
      'auto',
      true
    )
  const handleDesignerExit = useCallback(() => {
    if (layoutNativeFullscreen) {
      setCanvasFullscreen(false)
    }
    if (isDashboard) {
      commandCenterFullscreen.setFullscreen(false)
    }
  }, [
    commandCenterFullscreen,
    isDashboard,
    layoutNativeFullscreen,
    setCanvasFullscreen,
  ])

  const dashboardCommandBarSharedProps = {
    staticLayout: true as const,
    toolState: { tool, drawShape },
    onToolChange: handleToolChange,
    onDrawShapeChange: handleDrawShapeChange,
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    onUndo: store.undo,
    onRedo: store.redo,
    onClearAll: handleClearAll,
    selectedCount,
    onDeleteSelected: handleDeleteSelected,
    onCopy: handleCopy,
    onPaste: handlePaste,
    clipboardHasContents,
    onRotateLeft: handleRotateLeft,
    onRotateRight: handleRotateRight,
    onRotateRoomLeft: handleRotateRoomLeft,
    onRotateRoomRight: handleRotateRoomRight,
    selectedRoomId,
    onAlignVertical: handleAlignVertical,
    onAlignHorizontal: handleAlignHorizontal,
    onDistributeVertical: handleDistributeVertical,
    onDistributeHorizontal: handleDistributeHorizontal,
    zoom: currentZoom,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    onCenterView: handleCenterView,
    onAutoArrangeFloorPlan: handleAutoArrangeFloorPlan,
    canAutoArrangeFloorPlan,
    autoArrangeDisabledReason,
    autoArrangeMode,
    onAutoArrangeModeChange: setAutoArrangeMode,
    tableSizeFt: tableSizePillValue,
    onTableSizeChange: handleTableSizeChange,
    onPrepareTableDraw: handlePrepareTableDraw,
    rooms: showToolbarRoomControls ? layoutRooms : undefined,
    activeRoomId: selectedRoomId ?? activeRoomId,
    onSelectRoom: showToolbarRoomControls ? handleSelectRoom : undefined,
    onAddRoom: showToolbarRoomControls ? handleAddRoomWithSelectTool : undefined,
    onRenameRoom: showToolbarRoomControls ? onRenameRoom : undefined,
    onDeleteRoom: showToolbarRoomControls ? onDeleteRoom : undefined,
    highlightedRoomMetrics,
    highlightedRoomId: highlightedRoomId,
    onPatchRoomDimensions: handlePatchRoomDimensions,
    highlightedSelectionMetrics,
    showLabels,
    onShowLabelsChange: setShowLabels,
    boothMapLabelMode,
    onBoothMapLabelModeChange: setBoothMapLabelMode,
    canvasFullscreen: dashboardImmersive,
    onToggleCanvasFullscreen: () => {
      setCanvasFullscreen((v) => {
        const next = !v
        if (next) {
          requestAnimationFrame(() => {
            viewportApiRef.current?.resetViewport()
            recoverCanvasFocus()
          })
        }
        return next
      })
    },
    onLaunchDualScreen: isDashboard ? handleLaunchDualScreen : undefined,
    dualScreenActive,
    designerExitHref: resolvedDesignerExitHref,
    designerExitLabel: resolvedDesignerExitLabel,
    onDesignerExit: handleDesignerExit,
    onSaveMarket,
    saveMarketDisabled,
    saveMarketLoading,
    onSaveDraft,
    saveDraftDisabled,
    saveDraftLoading,
    patronPathEnabled,
    onPatronPathToggle: handlePatronPathToggle,
    showClearanceWarnings,
    onClearanceWarningsToggle: handleClearanceWarningsToggle,
    eventId,
    vendorFillMaxCapacity,
    patronFillMaxCapacity,
    onFillVendorTables: handleFillVendorTables,
    onFillPatronTables: handleFillPatronTables,
    fillRoomDisabledReason,
  }

  const dashboardCommandBar = isDashboard ? (
    <CanvasCommandBar
      {...dashboardCommandBarSharedProps}
      topBarLayout
      className={portalToolbarToTop ? 'min-h-0 w-full' : 'shrink-0'}
    />
  ) : null

  const dashboardHeaderCommandBar = isDashboard ? (
    <CanvasCommandBar
      {...dashboardCommandBarSharedProps}
      headerBarLayout
      className="min-h-0 w-full"
    />
  ) : null

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
          <div className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700">
            {placedCount} vendor booth{placedCount === 1 ? '' : 's'} placed
            {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
          </div>
        </div>
      </header>
    ) : null

  const fullscreenExitToolbar = (
    <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
      {resolvedDesignerExitHref ? (
        <CommandCenterExitButton
          eventId={eventId}
          eventName={designerExitEventName}
          eventStatus={designerExitEventStatus}
          compact
          prominent
          onBeforeNavigate={() => {
            setCanvasFullscreen(false)
            if (isDashboard) {
              commandCenterFullscreen.setFullscreen(false)
            }
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={() => setCanvasFullscreen(false)}
        className="relative z-[10001] rounded-lg border border-stone-600 bg-stone-900/95 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg hover:bg-stone-800 pointer-events-auto"
        aria-label="Exit fullscreen canvas editor"
      >
        Exit Fullscreen
      </button>
    </div>
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
      <LayoutEditorHelpBanner />
      {debugGeometry ? (
        <DiagnosticSidebar doc={store.doc} onClearAndReset={hardResetCanvas} />
      ) : null}
      <FullscreenLayout
        active={layoutNativeFullscreen}
        onActiveChange={(next) => setCanvasFullscreen(next)}
        header={layoutHeader}
        fullscreenToolbar={fullscreenExitToolbar}
        className="min-h-0 min-w-0 flex-1"
      >
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
        {isDashboard && !dashboardPreview ? (
          <>
            {dashboardCommandBar && !portalToolbarToTop
              ? dashboardCommandBar
              : null}
            {dashboardCommandBar && portalToolbarToTop && toolbarPortal?.target
              ? createPortal(dashboardCommandBar, toolbarPortal.target)
              : null}
            {dashboardHeaderCommandBar &&
            portalHeaderToolbarToHeader &&
            toolbarPortal?.headerTarget
              ? createPortal(dashboardHeaderCommandBar, toolbarPortal.headerTarget)
              : null}
          </>
        ) : null}
        {isDashboard ? (
            <div className="flex min-h-0 min-w-0 flex-1 basis-0 items-stretch overflow-hidden">
              <div
                data-layout-help="canvas"
                className="floor-plan-canvas-host floor-plan-canvas-host--dashboard relative flex h-full min-h-0 min-w-0 flex-1 flex-row overflow-hidden bg-stone-50"
              >
                {!dashboardPreview ? (
                  <CanvasLegend
                    variant="docked"
                    clearanceSummary={clearanceSummary}
                    showClearanceWarnings={showClearanceWarnings}
                  />
                ) : null}
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <CanvasRootErrorBoundary
                  onReset={() => {
                    logState('Canvas error boundary: reset triggered')
                    store.resetState()
                  }}
                  onError={(error) => {
                    logState(`Canvas error: ${error.message}`)
                  }}
                >
                  <LayoutCanvas
                    className="absolute inset-0 min-h-0"
                    scrollHost={!isEmbedded}
                    commandCenterViewport
                    onLayoutCommit={isDashboard ? scheduleLayoutAutosave : undefined}
                    layoutSpringPoses={layoutSpringPoses}
                    store={store}
                    toolState={{ tool, drawShape }}
                    defaultBoothTableSpec={defaultPlacementSpec}
                    defaultBoothTableSpecRef={defaultPlacementSpecRef}
                    tableSizeFt={tableSizePillValue}
                    activeRoomId={activeRoomId}
                    selectedRoomId={selectedRoomId}
                    onRoomFrameClick={handleRoomFrameClick}
                    onRoomGeometryCommit={handleRoomGeometryCommit}
                    onViewportReady={handleViewportReady}
                    onZoomChange={setCurrentZoom}
                    eventCategoryNames={eventCategoryNames}
                    boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
                    boothMapLabelMode={isDashboard ? boothMapLabelMode : undefined}
                    boothMapLabelByObjectId={
                      isDashboard ? boothMapLabelByObjectId : undefined
                    }
                    onVendorDrop={onVendorDrop}
                    autoArrangeMode={autoArrangeMode}
                    patronTrafficPath={patronTrafficPath}
                    pathfindingBottleneckIds={pathfindingBottleneckIds}
                    patronPathIsPartial={patronPathfinding.isPartial}
                    patronAisleCorridors={patronAisleCorridors}
                    unifiedLayoutOverlay={unifiedLayoutOverlay}
                    onProximityViolation={(info) => {
                      toast.error(
                        `Same-category booths must be at least 4 columns or 2 rows apart — "${info.category}" placement reverted.`,
                        { duration: 2400 }
                      )
                    }}
                    onOverlapViolation={() => {
                      const placeableRooms = (store.doc.rooms ?? []).filter(
                        (r) => !r.mergedIntoObjectId
                      )
                      if (placeableRooms.length === 0) {
                        toast.message(
                          'Add a room first — use Add room in the toolbar, then draw booths inside it.',
                          { duration: 3200 }
                        )
                        return
                      }
                      if (
                        layoutActiveRoomId &&
                        !placeableRooms.some((r) => r.id === layoutActiveRoomId)
                      ) {
                        toast.message(
                          'Room is still loading on the canvas — try drawing again in a moment.',
                          { duration: 2800 }
                        )
                        return
                      }
                      toast.error(
                        'Draw inside the room interior — booths cannot overlap fixtures or sit outside the walls.',
                        { duration: 2800 }
                      )
                    }}
                    onRoomCanvasLimitBlocked={() => {
                      toast.message(
                        'Canvas limit reached — drag the primary (largest) room smaller or move annex rooms closer.',
                        { duration: 2200 }
                      )
                    }}
                    onAfterDrawCommit={handleAfterDrawCommit}
                    stickyDrawPlacement
                    showLabels={showLabels}
                    viewOnly={dashboardPreview}
                    showClearanceWarnings={showClearanceWarnings}
                  />
                </CanvasRootErrorBoundary>
                </div>
                {!dashboardPreview ? <CanvasLedger /> : null}
              </div>
            </div>
        ) : (
          <div
            className={cn(
              'flex w-full flex-row items-stretch overflow-hidden min-h-0 flex-1',
              isEmbedded ? 'h-full' : 'h-[calc(100vh-64px)]'
            )}
          >
            <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
              <CanvasCommandBar
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
                onDistributeVertical={handleDistributeVertical}
                onDistributeHorizontal={handleDistributeHorizontal}
                zoom={currentZoom}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={handleZoomReset}
                onCenterView={handleCenterView}
                onAutoArrangeFloorPlan={handleAutoArrangeFloorPlan}
                canAutoArrangeFloorPlan={canAutoArrangeFloorPlan}
                autoArrangeDisabledReason={autoArrangeDisabledReason}
                autoArrangeMode={autoArrangeMode}
                onAutoArrangeModeChange={setAutoArrangeMode}
                tableSizeFt={tableSizePillValue}
                onTableSizeChange={handleTableSizeChange}
                onPrepareTableDraw={handlePrepareTableDraw}
                rooms={showToolbarRoomControls ? layoutRooms : undefined}
                activeRoomId={selectedRoomId ?? activeRoomId}
                onSelectRoom={showToolbarRoomControls ? handleSelectRoom : undefined}
                onAddRoom={showToolbarRoomControls ? handleAddRoomWithSelectTool : undefined}
                onRenameRoom={showToolbarRoomControls ? onRenameRoom : undefined}
                onDeleteRoom={showToolbarRoomControls ? onDeleteRoom : undefined}
                highlightedRoomMetrics={highlightedRoomMetrics}
                highlightedSelectionMetrics={highlightedSelectionMetrics}
                showLabels={showLabels}
                onShowLabelsChange={setShowLabels}
                canvasFullscreen={layoutNativeFullscreen}
                onToggleCanvasFullscreen={() => {
                  setCanvasFullscreen((v) => {
                    const next = !v
                    if (next) {
                      requestAnimationFrame(() => {
                        viewportApiRef.current?.resetViewport()
                        recoverCanvasFocus()
                      })
                    }
                    return next
                  })
                }}
                designerExitHref={resolvedDesignerExitHref}
                designerExitLabel={resolvedDesignerExitLabel}
                onDesignerExit={handleDesignerExit}
                onSaveMarket={onSaveMarket}
                saveMarketDisabled={saveMarketDisabled}
                saveMarketLoading={saveMarketLoading}
                onSaveDraft={onSaveDraft}
                saveDraftDisabled={saveDraftDisabled}
                saveDraftLoading={saveDraftLoading}
                patronPathEnabled={patronPathEnabled}
                onPatronPathToggle={handlePatronPathToggle}
                showClearanceWarnings={showClearanceWarnings}
                onClearanceWarningsToggle={handleClearanceWarningsToggle}
                vendorFillMaxCapacity={vendorFillMaxCapacity}
                patronFillMaxCapacity={patronFillMaxCapacity}
                onFillVendorTables={handleFillVendorTables}
                onFillPatronTables={handleFillPatronTables}
                fillRoomDisabledReason={fillRoomDisabledReason}
              />
              <div
                data-layout-help="canvas"
                className={cn(
                  'floor-plan-canvas-host relative flex min-h-0 min-w-0 flex-col rounded-lg border border-stone-200 bg-stone-100',
                  isEmbedded
                    ? 'floor-plan-canvas-host--content-sized h-auto shrink-0 overflow-visible'
                    : 'h-full flex-1 overflow-auto'
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
                  <LayoutCanvas
                    className={
                      isEmbedded
                        ? 'relative min-h-0 w-full max-w-full'
                        : 'absolute inset-0 min-h-0 max-w-full'
                    }
                    scrollHost={!isEmbedded}
                    layoutSpringPoses={layoutSpringPoses}
                    store={store}
                    toolState={{ tool, drawShape }}
                    defaultBoothTableSpec={defaultPlacementSpec}
                    defaultBoothTableSpecRef={defaultPlacementSpecRef}
                    tableSizeFt={tableSizePillValue}
                    activeRoomId={activeRoomId}
                    selectedRoomId={selectedRoomId}
                    onRoomFrameClick={handleRoomFrameClick}
                    onRoomGeometryCommit={handleRoomGeometryCommit}
                    onViewportReady={handleViewportReady}
                    onZoomChange={setCurrentZoom}
                    eventCategoryNames={eventCategoryNames}
                    boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
                    boothMapLabelMode={isDashboard ? boothMapLabelMode : undefined}
                    boothMapLabelByObjectId={
                      isDashboard ? boothMapLabelByObjectId : undefined
                    }
                    onVendorDrop={onVendorDrop}
                    autoArrangeMode={autoArrangeMode}
                    patronTrafficPath={patronTrafficPath}
                    pathfindingBottleneckIds={pathfindingBottleneckIds}
                    patronPathIsPartial={patronPathfinding.isPartial}
                    patronAisleCorridors={patronAisleCorridors}
                    unifiedLayoutOverlay={unifiedLayoutOverlay}
                    onProximityViolation={(info) => {
                      toast.error(
                        `Same-category booths must be at least 4 columns or 2 rows apart — "${info.category}" placement reverted.`,
                        { duration: 2400 }
                      )
                    }}
                    onOverlapViolation={() => {
                      const placeableRooms = (store.doc.rooms ?? []).filter(
                        (r) => !r.mergedIntoObjectId
                      )
                      if (placeableRooms.length === 0) {
                        toast.message(
                          'Add a room first — use Add room in the toolbar, then draw booths inside it.',
                          { duration: 3200 }
                        )
                        return
                      }
                      if (
                        layoutActiveRoomId &&
                        !placeableRooms.some((r) => r.id === layoutActiveRoomId)
                      ) {
                        toast.message(
                          'Room is still loading on the canvas — try drawing again in a moment.',
                          { duration: 2800 }
                        )
                        return
                      }
                      toast.error(
                        'Draw inside the room interior — booths cannot overlap fixtures or sit outside the walls.',
                        { duration: 2800 }
                      )
                    }}
                    onRoomCanvasLimitBlocked={() => {
                      toast.message(
                        'Canvas limit reached — drag the primary (largest) room smaller or move annex rooms closer.',
                        { duration: 2200 }
                      )
                    }}
                    onAfterDrawCommit={handleAfterDrawCommit}
                    stickyDrawPlacement
                    showLabels={showLabels}
                    layoutCapacity={layoutCapacity}
                    baselineTableLengthFt={safeTableSizeFt}
                    showClearanceWarnings={showClearanceWarnings}
                  />
                </CanvasRootErrorBoundary>
                {!isDashboard ? (
                  <CanvasLegend
                    variant="floating"
                    clearanceSummary={clearanceSummary}
                    showClearanceWarnings={showClearanceWarnings}
                  />
                ) : null}
              </div>
            </div>

            <div
              className={cn(
                'relative z-20 flex h-full min-h-0 shrink-0 self-stretch',
                rightInspectorOpen && 'w-[320px] min-w-[320px]'
              )}
            >
              {!rightInspectorOpen ? (
                <button
                  type="button"
                  onClick={() => setRightInspectorOpen(true)}
                  title="Show inspector (])"
                  aria-label="Show inspector"
                  className="flex min-h-[10rem] w-8 shrink-0 self-stretch items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 shadow-sm hover:bg-stone-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="relative flex h-full min-h-0 w-[320px] min-w-[320px] shrink-0 flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setRightInspectorOpen(false)}
                    title="Hide inspector (])"
                    aria-label="Hide inspector"
                    className="absolute left-1 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm hover:bg-stone-50"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <PropertyInspector
                    store={store}
                    eventCategoryNames={eventCategoryNames}
                    onAutoArrange={handleAutoArrange}
                    canAutoArrange={vendorBoothCount > 0}
                    onAutoLayoutAndPathfind={handleAutoLayoutAndPathfind}
                    canAutoLayoutAndPathfind={vendorBoothCount > 0}
                    className="min-h-0 flex-1 overflow-y-auto pt-1"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </FullscreenLayout>
      <LayoutEditorHelpHost />
    </div>
  )
}
