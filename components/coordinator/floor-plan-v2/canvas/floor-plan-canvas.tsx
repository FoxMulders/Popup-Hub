'use client'

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { CanvasGrid } from './canvas-grid'
import { CanvasObjects } from './canvas-objects'
import {
  DraftPreview,
  MarqueePreview,
  PatronTrafficPathOverlay,
  PatronAisleOverlay,
  UnifiedLayoutFlowOverlay,
  type UnifiedClearanceHeatCell,
  SelectionChrome,
  SelectionRotateHandles,
} from './canvas-overlays'
import { InlineLabelEditor } from './inline-label-editor'
import { RoomDropZones } from './room-drop-zones'
import { RoomFrames } from './room-frames'
import { RoomSelectionOverlay } from './room-selection-overlay'
import { activeRoomFrames } from './canvas-engine'
import { FLOOR_PLAN_CANVAS_ID } from './canvas-focus'
import { useViewport, type ViewportApi, type ZoomMath, type PanClampBounds } from './use-viewport'
import { fitViewportToContent, VIEWPORT_FIT_PADDING_PX } from './use-layout-viewport'
import { useCanvasPointer, resolveDrawCommitRect } from '../interactions/use-canvas-pointer'
import { useCanvasObjectKeyboard } from '../interactions/use-canvas-object-keyboard'
import { useSelectionKeyboardNudge } from '../interactions/selection-keyboard-nudge'
import { resolveTablePlacementPreview } from '../interactions/table-placement-preview'
import {
  detectPlacedObjectOverlaps,
  placedObjectOverlapsAny,
} from '../interactions/geometry'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import {
  DEFAULT_TABLE_SIZE,
} from '@/lib/booth-planner/layout-table-size'
import type { TableSizeSpec } from '@/lib/booth-planner/table-shape'
import {
  CANVAS_GRID_MAJOR_EVERY,
  canvasGridSpacingForTableFt,
} from './canvas-grid-spacing'
import type { LabelObject, PlacedObject } from '../state/types'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
import type { BoothMapLabelMode } from '@/lib/coordinator/booth-map-label'
import type { ToolState } from '../tools/types'
import { cn } from '@/lib/utils'
import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
import { VENDOR_DRAG_MIME } from '@/lib/coordinator/booth-placement-status'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import { dissolvedStageIdsForDoc } from '@/src/utils/layoutMergeEngine'
import { boothPatchForTableSize } from '@/lib/booth-planner/table-booth-consolidation'
import {
  vendorBoothClearanceBandsByObjectId,
  vendorBoothClearanceThemeForProbe,
} from '@/lib/coordinator/booth-clearance-visual'
import type { BoothObject } from '../state/types'
import {
  editableRingForFrame,
  insertVertexOnEdge,
  nearestEdgeHit,
} from '../geometry/polygon-edit'

import type { LayoutSpringPose } from '../hooks/use-layout-spring'

export interface FloorPlanCanvasProps {
  store: FloorPlanDocStore
  toolState: ToolState
  /**
   * Active room id (for the multi-room canvas). New draws are tagged
   * with this id; the room frame is highlighted on the canvas. When
   * undefined the canvas runs in legacy single-room mode and skips
   * the room-frame layer entirely.
   */
  activeRoomId?: string | null
  /**
   * Currently selected room (clicked-to-select via the Select tool on
   * a frame stroke). Drives the "selected" perimeter chrome.
   */
  selectedRoomId?: string | null
  /** Called when the user clicks on a room frame stroke. */
  onRoomFrameClick?: (roomId: string) => void
  /** After a room drag/resize commits — sync wizard room origins. */
  onRoomGeometryCommit?: () => void
  /**
   * Fired immediately after a draw gesture commits a new object. The
   * default behaviour is to leave the tool sticky — the host owns
   * tool-switching policy entirely.
   */
  onAfterDrawCommit?: () => void
  /**
   * Receives the canvas's imperative viewport API on mount. The host
   * uses this to drive zoom from a toolbar that lives outside the
   * canvas's DOM subtree. Calling code should keep a ref + a
   * `currentZoom` mirror in state so it can re-render the readout.
   */
  onViewportReady?: (api: ViewportApi | null) => void
  /** Mirrors viewport.zoom upward so the toolbar can render the % readout. */
  onZoomChange?: (zoom: number) => void
  /**
   * When true (default), the canvas fills its host and owns pan/zoom scroll.
   * When false, the canvas grows with content for page-level scroll (wizard QA).
   */
  scrollHost?: boolean
  /**
   * Sorted list of category names for this event (Step 2). Forwarded
   * to the pointer hook so newly drawn booths auto-allocate to the
   * currently least-used category, preventing visual clusters.
   */
  eventCategoryNames?: ReadonlyArray<string>
  /**
   * Notifies the host (the floor-plan workspace) that a placement
   * was rejected by the same-category proximity rule. The host
   * surfaces a toast — the rule's pure logic stays headless.
   */
  onProximityViolation?: (info: {
    category: string
    dxColumns: number
    dyRows: number
  }) => void
  /** Notifies the host when a placement is rejected due to overlap. */
  onOverlapViolation?: () => void
  /** Fired when room drag/resize hits the 5× canvas dimension cap. */
  onRoomCanvasLimitBlocked?: () => void
  /** When false, hide architectural overlay labels on the canvas. */
  showLabels?: boolean
  /** Footprint template for newly drawn booths. */
  defaultBoothTableSpec?: TableSizeSpec
  /** Sync ref for draw-time booth footprint (see use-canvas-pointer). */
  defaultBoothTableSpecRef?: MutableRefObject<TableSizeSpec | undefined>
  /** Active TABLE SIZE pill — drives minor/major grid spacing. */
  tableSizeFt?: TableSizeSpec
  className?: string
  /** Fixed pixels-per-foot at zoom = 1. */
  basePxPerFt?: number
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
  boothMapLabelMode?: BoothMapLabelMode
  boothMapLabelByObjectId?: ReadonlyMap<
    string,
    { vendorName: string; category: string }
  >
  onVendorDrop?: (applicationId: string, canvasX: number, canvasY: number) => void
  autoArrangeMode?: AutoArrangeMode
  /** Computed patron viewing path (feet) — dotted overlay when set. */
  patronTrafficPath?: ReadonlyArray<{ x: number; y: number }> | null
  /** Per-leg path segments — avoids phantom chords when a leg fails. */
  patronTrafficPathSegments?: ReadonlyArray<
    ReadonlyArray<{ x: number; y: number }>
  > | null
  /** Vendor booths narrowing the active patron path. */
  pathfindingBottleneckIds?: ReadonlySet<string>
  /** True when pathfinding used relaxed clearance or skipped legs. */
  patronPathIsPartial?: boolean
  /** 6′ patron aisle corridor rects (feet) — green overlay when set. */
  patronAisleCorridors?: ReadonlyArray<{
    x: number
    y: number
    width: number
    height: number
  }> | null
  /** Unified solver spine + clearance heat overlay (feet). */
  unifiedLayoutOverlay?: {
    spinePath: ReadonlyArray<{ x: number; y: number }> | null
    clearanceField: ReadonlyArray<UnifiedClearanceHeatCell> | null
  } | null
  /** Command center: higher zoom floor so drags feel less jumpy when framed out. */
  commandCenterViewport?: boolean
  /** Keep draw tool armed between placements; show hover ghost preview. */
  stickyDrawPlacement?: boolean
  /** Dock legend as left sidebar panel (dashboard). */
  legendVariant?: 'floating' | 'sidebar'
  /** Fired when a canvas gesture commits layout changes (drag end, draw, resize). */
  onLayoutCommit?: () => void
  /** Step 2 capacity ceiling for strict grid auto-arrange. */
  layoutCapacity?: number
  /** Baseline table length for vendor booth footprints during arrange. */
  baselineTableLengthFt?: LayoutBaselineTableLengthFt
  /** Interpolated booth poses during auto-arrange spring animation. */
  layoutSpringPoses?: ReadonlyMap<string, LayoutSpringPose> | null
  /** View-only presentation — pan/zoom allowed, no object or layout edits. */
  viewOnly?: boolean
  /** Yellow/red aisle bands on vendor booths (dashboard toggle). */
  showClearanceWarnings?: boolean
  /** Enforce same-category proximity spacing on draw and drag. */
  enforceCategorySeparation?: boolean
}

const DEFAULT_BASE_PX_PER_FT = 12
/** Minimum zoom on coordinator dashboard — allow 50% steps via discrete zoom. */
const COMMAND_CENTER_ZOOM_MIN = 0.25

/** Stages draw their own perimeter — skip duplicate dashed outline on selection. */
function filteredSelectionIds(
  objects: ReadonlyArray<PlacedObject>,
  selectedIds: ReadonlySet<string>
): ReadonlySet<string> {
  return new Set(
    [...selectedIds].filter((id) => {
      const obj = objects.find((o) => o.id === id)
      return obj?.kind !== 'stage'
    })
  )
}

export function LayoutCanvas(props: FloorPlanCanvasProps) {
  return <FloorPlanCanvas {...props} />
}

export function FloorPlanCanvas({
  store,
  toolState,
  activeRoomId,
  selectedRoomId,
  onRoomFrameClick,
  onRoomGeometryCommit,
  onAfterDrawCommit,
  onViewportReady,
  onZoomChange,
  eventCategoryNames,
  onProximityViolation,
  onOverlapViolation,
  onRoomCanvasLimitBlocked,
  showLabels = true,
  defaultBoothTableSpec,
  defaultBoothTableSpecRef,
  tableSizeFt,
  className,
  basePxPerFt = DEFAULT_BASE_PX_PER_FT,
  boothPlacementStatusByObjectId,
  boothMapLabelMode,
  boothMapLabelByObjectId,
  onVendorDrop,
  autoArrangeMode = 'grid',
  patronTrafficPath = null,
  patronTrafficPathSegments = null,
  pathfindingBottleneckIds,
  patronPathIsPartial = false,
  patronAisleCorridors = null,
  unifiedLayoutOverlay = null,
  commandCenterViewport = false,
  scrollHost = true,
  stickyDrawPlacement = false,
  legendVariant = 'floating',
  onLayoutCommit,
  layoutCapacity,
  baselineTableLengthFt,
  layoutSpringPoses = null,
  viewOnly = false,
  showClearanceWarnings = true,
  enforceCategorySeparation = true,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clipViewportRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Middle-button pan preview target — GPU translate3d during drag. */
  const panContentRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<SVGSVGElement>(null)
  const zoomForAnchorRef = useRef(1)

  /** Edge-to-edge grid: no infinite pad; size the DOM to the grid footprint. */
  const tightToGrid = commandCenterViewport || !scrollHost
  const padFt = tightToGrid
    ? 0
    : Math.max(40, store.doc.canvasWidthFt, store.doc.canvasLengthFt)

  const effectiveTableSizeFt = useMemo(
    () =>
      tableSizeFt?.ft ??
      defaultBoothTableSpec?.ft ??
      DEFAULT_TABLE_SIZE,
    [defaultBoothTableSpec, tableSizeFt]
  )

  const gridSpacing = useMemo(
    () => canvasGridSpacingForTableFt(effectiveTableSizeFt),
    [effectiveTableSizeFt]
  )

  const roomGridFrame = useMemo(() => {
    const roomId = selectedRoomId ?? activeRoomId
    if (!roomId) return null
    const frame = (store.doc.rooms ?? []).find((f) => f.id === roomId)
    if (!frame || frame.mergedIntoObjectId) return null
    return frame
  }, [activeRoomId, selectedRoomId, store.doc.rooms])

  const getZoomMath = useCallback<() => ZoomMath>(() => {
    const objects = store.doc.objects
    const selected = store.selectedIds
    let anchorX = store.doc.canvasWidthFt / 2
    let anchorY = store.doc.canvasLengthFt / 2

    if (commandCenterViewport) {
      const scroll = scrollRef.current
      const ratio = basePxPerFt * zoomForAnchorRef.current
      if (scroll && ratio > 0) {
        anchorX =
          (scroll.scrollLeft + scroll.clientWidth / 2) / ratio - padFt
        anchorY =
          (scroll.scrollTop + scroll.clientHeight / 2) / ratio - padFt
      }
    } else if (selected.size > 0) {
      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      let any = false
      for (const o of objects) {
        if (!selected.has(o.id)) continue
        any = true
        if (o.x < minX) minX = o.x
        if (o.y < minY) minY = o.y
        if (o.x + o.width > maxX) maxX = o.x + o.width
        if (o.y + o.height > maxY) maxY = o.y + o.height
      }
      if (any) {
        anchorX = (minX + maxX) / 2
        anchorY = (minY + maxY) / 2
      }
    }

    return {
      basePxPerFt,
      padFt,
      anchorFt: { x: anchorX, y: anchorY },
    }
  }, [
    basePxPerFt,
    commandCenterViewport,
    padFt,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
    store.doc.objects,
    store.selectedIds,
  ])

  const getPanClampBounds = useCallback((): PanClampBounds | null => {
    const scroll = scrollRef.current
    if (!scroll || !scrollHost) return null
    const ratio = basePxPerFt * zoomForAnchorRef.current
    if (ratio <= 0) return null

    const frame = roomGridFrame
    const originX = frame?.originX ?? 0
    const originY = frame?.originY ?? 0
    const gridW = frame?.widthFt ?? store.doc.canvasWidthFt
    const gridH = frame?.lengthFt ?? store.doc.canvasLengthFt
    const gridLeft = (padFt + originX) * ratio
    const gridTop = (padFt + originY) * ratio
    const gridRight = gridLeft + gridW * ratio
    const gridBottom = gridTop + gridH * ratio
    const minVisible = 48
    const cw = scroll.clientWidth
    const ch = scroll.clientHeight

    if (gridRight - gridLeft <= cw) {
      const centeredLeft = gridLeft - (cw - (gridRight - gridLeft)) / 2
      const centeredTop = gridTop - (ch - (gridBottom - gridTop)) / 2
      return {
        minLeft: centeredLeft,
        maxLeft: centeredLeft,
        minTop: centeredTop,
        maxTop: centeredTop,
      }
    }

    return {
      minLeft: gridRight - minVisible,
      maxLeft: gridLeft - cw + minVisible,
      minTop: gridBottom - minVisible,
      maxTop: gridTop - ch + minVisible,
    }
  }, [
    basePxPerFt,
    padFt,
    roomGridFrame,
    scrollHost,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
  ])

  const viewport = useViewport({
    scrollRef,
    panContentRef,
    initialZoom: 1,
    getZoomMath,
    getPanClampBounds,
    zoomMin: commandCenterViewport ? COMMAND_CENTER_ZOOM_MIN : undefined,
    zoomStepMultiplier: commandCenterViewport ? 2 : 4,
    getToolMode: () => toolState.tool,
  })

  // Stable ref — the hook returns a fresh API object each render; reading
  // it from a ref keeps framing effects from re-firing on every zoom/pan.
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  zoomForAnchorRef.current = viewport.zoom

  useEffect(() => {
    onViewportReady?.(viewportRef.current)
    return () => onViewportReady?.(null)
  }, [onViewportReady])

  useEffect(() => {
    onZoomChange?.(viewport.zoom)
  }, [onZoomChange, viewport.zoom])

  /**
   * Re-frame when the active room or room *dimensions* change — not when
   * origins move (drag), so zoom and pan are not reset on every move.
   */
  const roomsFramingKey = useMemo(() => {
    const frames = store.doc.rooms ?? []
    const mergedSig = (store.doc.objects ?? [])
      .filter((o) => o.kind === 'merged_zone')
      .map(
        (o) =>
          `${o.id}:${o.x},${o.y},${o.width},${o.height},${o.rotation ?? 0}`
      )
      .join(';')
    return `${activeRoomId ?? ''}:${frames
      .map(
        (f) =>
          `${f.id}:${f.widthFt},${f.lengthFt},${f.mergedIntoObjectId ?? ''}`
      )
      .join('|')}:${mergedSig}`
  }, [activeRoomId, store.doc.objects, store.doc.rooms])

  /** When no rooms exist, reframe if the open canvas dimensions change. */
  const viewportFramingKey = useMemo(() => {
    const frames = store.doc.rooms ?? []
    if (frames.length === 0) {
      return `${roomsFramingKey}@canvas:${store.doc.canvasWidthFt},${store.doc.canvasLengthFt}`
    }
    return roomsFramingKey
  }, [
    roomsFramingKey,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
    store.doc.rooms,
  ])

  const frameActiveRoom = useCallback(() => {
    fitViewportToContent(viewportRef.current, store.doc, activeRoomId, {
      paddingPx: commandCenterViewport ? undefined : VIEWPORT_FIT_PADDING_PX,
      commandCenterViewport,
    })
  }, [activeRoomId, commandCenterViewport, store.doc])

  const frameActiveRoomRef = useRef(frameActiveRoom)
  frameActiveRoomRef.current = frameActiveRoom

  const didInitialFrameRef = useRef(false)
  useEffect(() => {
    if (!scrollHost) return
    frameActiveRoomRef.current()
    didInitialFrameRef.current = true
  }, [viewportFramingKey, scrollHost])

  const observedViewportSizeRef = useRef({ w: 0, h: 0 })
  useEffect(() => {
    if (!scrollHost) return
    const scroll = scrollRef.current
    if (!scroll || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (!didInitialFrameRef.current) return
      const w = scroll.clientWidth
      const h = scroll.clientHeight
      if (w <= 0 || h <= 0) return
      const last = observedViewportSizeRef.current
      // Reframe once when the viewport first becomes measurable (flex
      // layout after mount). Skip later resizes — scrollbar toggles and
      // window resizes were resetting pan/zoom and locking the room center.
      if (last.w > 0 && last.h > 0) return
      observedViewportSizeRef.current = { w, h }
      frameActiveRoomRef.current()
    })
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [scrollHost])

  const clipToActiveRoom = !scrollHost && roomGridFrame != null
  /** Command center: size the scroll surface to the active room grid, not the 5× doc canvas. */
  const edgeToRoomGrid = tightToGrid && roomGridFrame != null
  const gridClipActive = clipToActiveRoom || edgeToRoomGrid

  const transform = useMemo(
    () => ({
      basePxPerFt,
      zoom: viewport.zoom,
      surfaceOriginFtX: gridClipActive ? roomGridFrame!.originX : 0,
      surfaceOriginFtY: gridClipActive ? roomGridFrame!.originY : 0,
    }),
    [
      basePxPerFt,
      gridClipActive,
      roomGridFrame,
      viewport.zoom,
    ]
  )

  const pointer = useCanvasPointer({
    store,
    toolState,
    scrollRef,
    surfaceRef,
    clipViewportRef: gridClipActive ? clipViewportRef : undefined,
    transform,
    panActive: viewport.panActive,
    onAfterDrawCommit,
    eventCategoryNames,
    activeRoomId: activeRoomId ?? null,
    selectedRoomId: selectedRoomId ?? null,
    onRoomFrameClick,
    onRoomGeometryCommit,
    onProximityViolation,
    onOverlapViolation,
    onRoomCanvasLimitBlocked,
    defaultBoothTableSpec,
    defaultBoothTableSpecRef,
    autoArrangeMode,
    commandCenterViewport,
    stickyDrawPlacement,
    onLayoutCommit,
    enforceCategorySeparation,
  })

  useSelectionKeyboardNudge(store, {
    activeRoomId: activeRoomId ?? null,
    enabled: !viewOnly,
  })

  useCanvasObjectKeyboard(store, { enabled: commandCenterViewport && !viewOnly })

  const deferredObjects = useDeferredValue(store.doc.objects)
  const deferredRooms = useDeferredValue(store.doc.rooms)
  const deferredObjectRoom = useDeferredValue(store.doc.objectRoom)
  const deferredOverlapCtx = useMemo(
    () => ({
      rooms: deferredRooms ?? [],
      objectRoom: deferredObjectRoom,
      doc: {
        ...store.doc,
        objects: deferredObjects,
        rooms: deferredRooms,
        objectRoom: deferredObjectRoom,
      },
    }),
    [deferredObjectRoom, deferredObjects, deferredRooms, store.doc]
  )

  const overlappingIds = useMemo(
    () => detectPlacedObjectOverlaps(deferredObjects, deferredOverlapCtx),
    [deferredObjects, deferredOverlapCtx]
  )

  const boothClearanceBandByObjectId = useMemo(
    () =>
      vendorBoothClearanceBandsByObjectId(
        deferredObjects,
        deferredRooms,
        deferredObjectRoom
      ),
    [deferredObjectRoom, deferredObjects, deferredRooms]
  )

  const dissolvedStageIds = useMemo(
    () => dissolvedStageIdsForDoc(store.doc),
    [store.doc]
  )

  const previewSourceRect = pointer.draftRect ?? pointer.placementHoverRect
  const previewSourceKind = pointer.draftKind ?? pointer.placementHoverKind
  const isGhostPreview =
    pointer.draftRect == null && pointer.placementHoverRect != null

  const draftPreviewProbe = useMemo((): BoothObject | null => {
    const rawRect = previewSourceRect
    const kind = previewSourceKind
    if (!rawRect || kind !== 'booth') return null
    const rect = resolveDrawCommitRect(
      kind,
      rawRect,
      store.doc.snapFt,
      defaultBoothTableSpec
    )
    const preview = resolveTablePlacementPreview(
      kind,
      rect,
      defaultBoothTableSpec,
      store.doc,
      activeRoomId ?? null
    )
    const rotation =
      pointer.draftRect != null ? 0 : pointer.placementHoverRotation
    const base = {
      id: '__draft__',
      kind: 'booth' as const,
      x: preview?.x ?? rect.x,
      y: preview?.y ?? rect.y,
      width: preview?.width ?? rect.width,
      height: preview?.height ?? rect.height,
      rotation: preview?.rotation ?? rotation,
      accentColor: null,
    }
    const sizePatch =
      defaultBoothTableSpec != null
        ? boothPatchForTableSize(base, defaultBoothTableSpec)
        : null
    return {
      ...base,
      ...(sizePatch ?? {}),
      tablePurpose: defaultBoothTableSpec?.purpose,
    } as BoothObject
  }, [
    activeRoomId,
    defaultBoothTableSpec,
    pointer.draftRect,
    pointer.placementHoverRotation,
    previewSourceKind,
    previewSourceRect,
    store.doc,
    store.doc.snapFt,
  ])

  const draftOverlaps = useMemo(() => {
    if (!previewSourceRect || !previewSourceKind) return false
    if (draftPreviewProbe) {
      return placedObjectOverlapsAny(
        draftPreviewProbe,
        deferredObjects,
        undefined,
        deferredOverlapCtx
      )
    }
    const rect = resolveDrawCommitRect(
      previewSourceKind,
      previewSourceRect,
      store.doc.snapFt,
      defaultBoothTableSpec
    )
    const preview = resolveTablePlacementPreview(
      previewSourceKind,
      rect,
      defaultBoothTableSpec,
      store.doc,
      activeRoomId ?? null
    )
    const rotation =
      pointer.draftRect != null ? 0 : pointer.placementHoverRotation
    const probe = {
      id: '__draft__',
      kind: previewSourceKind,
      x: preview?.x ?? rect.x,
      y: preview?.y ?? rect.y,
      width: preview?.width ?? rect.width,
      height: preview?.height ?? rect.height,
      rotation: preview?.rotation ?? rotation,
    } as PlacedObject
    return placedObjectOverlapsAny(
      probe,
      deferredObjects,
      undefined,
      deferredOverlapCtx
    )
  }, [
    activeRoomId,
    defaultBoothTableSpec,
    deferredObjects,
    deferredOverlapCtx,
    draftPreviewProbe,
    pointer.draftRect,
    pointer.placementHoverRotation,
    previewSourceKind,
    previewSourceRect,
    store.doc,
    store.doc.snapFt,
  ])

  const draftClearanceTheme = useMemo(() => {
    if (!showClearanceWarnings) return null
    if (!draftPreviewProbe || draftOverlaps) return null
    if (defaultBoothTableSpec?.purpose === 'guest') return null
    const previewRoomId = activeRoomId ?? deferredRooms?.[0]?.id ?? null
    return vendorBoothClearanceThemeForProbe(
      draftPreviewProbe,
      deferredObjects,
      deferredRooms,
      deferredObjectRoom,
      previewRoomId
    )
  }, [
    showClearanceWarnings,
    activeRoomId,
    defaultBoothTableSpec?.purpose,
    deferredObjectRoom,
    deferredObjects,
    deferredRooms,
    draftOverlaps,
    draftPreviewProbe,
  ])

  const draftPreviewRect = useMemo(() => {
    const rawRect = previewSourceRect
    const kind = previewSourceKind
    if (!rawRect || !kind) return null
    const rect = resolveDrawCommitRect(
      kind,
      rawRect,
      store.doc.snapFt,
      defaultBoothTableSpec
    )
    const preview = resolveTablePlacementPreview(
      kind,
      rect,
      defaultBoothTableSpec,
      store.doc,
      activeRoomId ?? null
    )
    if (!preview) return rect
    return {
      x: preview.x,
      y: preview.y,
      width: preview.width,
      height: preview.height,
    }
  }, [
    activeRoomId,
    defaultBoothTableSpec,
    previewSourceKind,
    previewSourceRect,
    store.doc,
    store.doc.snapFt,
  ])

  const draftPreviewRotation = useMemo(() => {
    if (pointer.draftRect != null) return 0
    return pointer.placementHoverRotation
  }, [pointer.draftRect, pointer.placementHoverRotation])

  const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
  const editingObj = useMemo<PlacedObject | null>(() => {
    if (!editingObjectId) return null
    return store.doc.objects.find((o) => o.id === editingObjectId) ?? null
  }, [editingObjectId, store.doc.objects])

  const commitEditing = useCallback(
    (next: string) => {
      if (!editingObj) {
        setEditingObjectId(null)
        return
      }
      const trimmed = next.trim()
      if (editingObj.kind === 'label') {
        const label = editingObj as LabelObject
        if ((label.text ?? '') !== trimmed) {
          store.updateObject(editingObj.id, { text: trimmed })
        }
      } else {
        if ((editingObj.label ?? '') !== trimmed) {
          store.updateObject(editingObj.id, { label: trimmed || undefined })
        }
      }
      setEditingObjectId(null)
    },
    [editingObj, store]
  )

  const cancelEditing = useCallback(() => {
    setEditingObjectId(null)
  }, [])

  useEffect(() => {
    if (editingObjectId && !editingObj) setEditingObjectId(null)
  }, [editingObj, editingObjectId])

  const pxPerFt = transform.basePxPerFt * transform.zoom
  const visibleWidthFt = gridClipActive
    ? roomGridFrame!.widthFt
    : store.doc.canvasWidthFt
  const visibleLengthFt = gridClipActive
    ? roomGridFrame!.lengthFt
    : store.doc.canvasLengthFt
  const docWidthPx = visibleWidthFt * pxPerFt
  const docHeightPx = visibleLengthFt * pxPerFt
  const svgWidthPx = store.doc.canvasWidthFt * pxPerFt
  const svgHeightPx = store.doc.canvasLengthFt * pxPerFt
  const padPx = padFt * pxPerFt
  const totalWidthPx = docWidthPx + padPx * 2
  const totalHeightPx = docHeightPx + padPx * 2
  const surfaceOffsetPx = gridClipActive
    ? {
        left: -roomGridFrame!.originX * pxPerFt,
        top: -roomGridFrame!.originY * pxPerFt,
      }
    : { left: tightToGrid ? 0 : padPx, top: tightToGrid ? 0 : padPx }

  useLayoutEffect(() => {
    clipViewportRef.current = gridClipActive ? panContentRef.current : null
  }, [gridClipActive])

  const centeredForDimsRef = useRef<{ w: number; l: number; roomId: string | null } | null>(
    null
  )
  useLayoutEffect(() => {
    if (!scrollHost) return
    const scroll = scrollRef.current
    if (!scroll) return
    if (scroll.clientWidth === 0 || scroll.clientHeight === 0) return
    const w = roomGridFrame?.widthFt ?? store.doc.canvasWidthFt
    const l = roomGridFrame?.lengthFt ?? store.doc.canvasLengthFt
    const roomKey = activeRoomId ?? null
    const last = centeredForDimsRef.current
    if (last && last.w === w && last.l === l && last.roomId === roomKey) return
    fitViewportToContent(viewportRef.current, store.doc, activeRoomId, {
      paddingPx: commandCenterViewport ? undefined : VIEWPORT_FIT_PADDING_PX,
      commandCenterViewport,
    })
    centeredForDimsRef.current = { w, l, roomId: roomKey }
  }, [
    activeRoomId,
    commandCenterViewport,
    roomGridFrame,
    scrollHost,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
  ])

  const cursor = viewOnly
    ? viewport.isPanning
      ? 'grabbing'
      : 'grab'
    : pointer.roomVertexDragActive
      ? 'grabbing'
      : pointer.rotating
      ? 'grabbing'
      : viewport.isPanning
        ? 'grabbing'
        : pointer.roomEdgeHover != null
          ? 'crosshair'
          : pointer.roomVertexHover != null
          ? 'grab'
          : toolState.tool === 'select' && pointer.emptyCanvasHover
            ? 'crosshair'
            : cursorForTool(viewport.isPanning ? 'pan' : toolState.tool)

  const ftAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const clipEl = gridClipActive ? clipViewportRef.current : null
      const surface = surfaceRef.current
      if (!clipEl && !surface) return { x: 0, y: 0 }
      const rect = (clipEl ?? surface)!.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      const ratio = basePxPerFt * viewport.zoom
      if (ratio === 0) return { x: 0, y: 0 }
      return {
        x: px / ratio + (transform.surfaceOriginFtX ?? 0),
        y: py / ratio + (transform.surfaceOriginFtY ?? 0),
      }
    },
    [
      basePxPerFt,
      clipToActiveRoom,
      gridClipActive,
      transform.surfaceOriginFtX,
      transform.surfaceOriginFtY,
      viewport.zoom,
    ]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (toolState.tool !== 'select') return
      const target = e.target as Element | null
      const id = target
        ?.closest('[data-object-id]')
        ?.getAttribute('data-object-id')
      if (id) {
        const obj = store.doc.objects.find((o) => o.id === id)
        if (!obj || obj.locked) return
        e.preventDefault()
        e.stopPropagation()
        if (!store.selectedIds.has(id)) {
          store.setSelection([id])
        }
        setEditingObjectId(id)
        return
      }

      const interactionRoomId = selectedRoomId ?? activeRoomId ?? null
      if (!interactionRoomId) return
      const frame = (store.doc.rooms ?? []).find((f) => f.id === interactionRoomId)
      if (!frame || frame.mergedIntoObjectId || frame.joinGroupId) return

      const ft = ftAtClient(e.clientX, e.clientY)
      const ring = editableRingForFrame(frame)
      const edgeTol = pxPerFt > 0 ? Math.max(0.5, 8 / pxPerFt) : 0.75
      const hit = nearestEdgeHit(ft, ring, edgeTol)
      if (!hit) return

      const nextRing = insertVertexOnEdge(ring, hit.edgeIndex, hit.projection)
      const ok = store.updateRoomPerimeter(interactionRoomId, nextRing, {
        pushHistory: true,
      })
      if (!ok) return
      e.preventDefault()
      e.stopPropagation()
      onRoomGeometryCommit?.()
      onLayoutCommit?.()
    },
    [
      activeRoomId,
      ftAtClient,
      onLayoutCommit,
      onRoomGeometryCommit,
      pxPerFt,
      selectedRoomId,
      store,
      toolState.tool,
    ]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (viewOnly || !onVendorDrop) return
      if (e.dataTransfer.types.includes(VENDOR_DRAG_MIME)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    },
    [onVendorDrop, viewOnly]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (viewOnly || !onVendorDrop) return
      const raw = e.dataTransfer.getData(VENDOR_DRAG_MIME)
      if (!raw) return
      e.preventDefault()
      try {
        const payload = JSON.parse(raw) as { applicationId?: string }
        if (!payload.applicationId) return
        const ft = ftAtClient(e.clientX, e.clientY)
        onVendorDrop(payload.applicationId, ft.x, ft.y)
      } catch {
        // ignore malformed drag payload
      }
    },
    [ftAtClient, onVendorDrop, viewOnly]
  )

  const { onWheel: onViewportWheel, ...viewportPointerHandlers } =
    viewport.scrollHandlers

  return (
    <div
      ref={containerRef}
      className={cn(
        'floor-plan-canvas-root relative min-h-0 min-w-0 w-full',
        scrollHost ? 'h-full flex-1' : 'h-auto w-fit max-w-full',
        className
      )}
    >
      <div
        id={FLOOR_PLAN_CANVAS_ID}
        ref={scrollRef}
        data-canvas-scroll-host={scrollHost ? 'true' : 'false'}
        className={cn(
          'canvas-container pointer-events-auto relative w-full min-w-0 max-w-full outline-none',
          scrollHost && !commandCenterViewport && 'h-full overflow-auto bg-stone-100',
          scrollHost &&
            commandCenterViewport &&
            'h-full overflow-hidden scrollbar-none bg-stone-50',
          !scrollHost && 'h-auto overflow-visible bg-stone-100'
        )}
        tabIndex={viewOnly ? -1 : 0}
        role="application"
        aria-label={viewOnly ? 'Floor plan preview' : 'Floor plan canvas viewport'}
        style={{ touchAction: 'none', cursor }}
        {...viewportPointerHandlers}
        onWheelCapture={onViewportWheel}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          ref={panContentRef}
          className={cn(!scrollHost && 'w-fit')}
          style={{
            width: totalWidthPx,
            height: totalHeightPx,
            position: 'relative',
            overflow: gridClipActive ? 'hidden' : undefined,
          }}
        >
          <svg
            ref={surfaceRef}
            className="floor-plan-canvas-surface"
            width={gridClipActive ? svgWidthPx : docWidthPx}
            height={gridClipActive ? svgHeightPx : docHeightPx}
            style={{
              position: gridClipActive || !tightToGrid ? 'absolute' : 'relative',
              left: surfaceOffsetPx.left,
              top: surfaceOffsetPx.top,
              display: 'block',
            pointerEvents: 'auto',
            zIndex: 1,
            background: commandCenterViewport ? 'transparent' : '#fafaf9',
            boxShadow: commandCenterViewport
              ? undefined
              : '0 0 0 1px rgb(214 211 209), 0 4px 14px rgb(28 25 23 / 0.12)',
            cursor,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
          onPointerDown={(e) => {
            if (viewOnly || toolState.tool === 'hand') return
            // Middle-button / aux-click pan is handled on the scroll viewport.
            if (e.pointerType === 'mouse' && e.button !== 0) return
            e.preventDefault()
            pointer.onPointerDown(e)
          }}
          onPointerMove={viewOnly ? undefined : pointer.onPointerMove}
          onPointerUp={viewOnly ? undefined : pointer.onPointerUp}
          onPointerCancel={viewOnly ? undefined : pointer.onPointerUp}
          onPointerLeave={viewOnly ? undefined : pointer.onPointerLeave}
          onContextMenu={viewOnly ? undefined : pointer.onContextMenu}
          onDoubleClick={viewOnly ? undefined : handleDoubleClick}
        >
          <g
            transform={
              roomGridFrame
                ? `translate(${roomGridFrame.originX * pxPerFt}, ${roomGridFrame.originY * pxPerFt})`
                : undefined
            }
          >
            <CanvasGrid
              widthFt={
                roomGridFrame?.widthFt ?? store.doc.canvasWidthFt
              }
              lengthFt={
                roomGridFrame?.lengthFt ?? store.doc.canvasLengthFt
              }
              spacingFt={gridSpacing.minorFt}
              majorEvery={gridSpacing.majorEvery ?? CANVAS_GRID_MAJOR_EVERY}
              pxPerFt={pxPerFt}
            />
          </g>
          <RoomDropZones
            doc={store.doc}
            pxPerFt={pxPerFt}
            activeRoomId={activeRoomId ?? null}
          />
          <CanvasObjects
            objects={store.doc.objects}
            layoutSpringPoses={layoutSpringPoses}
            rooms={store.doc.rooms}
            objectRoom={store.doc.objectRoom}
            dissolvedStageIds={dissolvedStageIds}
            selectedIds={store.selectedIds}
            pxPerFt={pxPerFt}
            showLabels={showLabels}
            overlappingIds={overlappingIds}
            pathfindingBottleneckIds={pathfindingBottleneckIds}
            editingObjectId={editingObjectId}
            eventCategoryNames={eventCategoryNames}
            boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
            boothMapLabelMode={boothMapLabelMode}
            boothMapLabelByObjectId={boothMapLabelByObjectId}
            boothClearanceBandByObjectId={boothClearanceBandByObjectId}
            emphasizeClearance={
              pointer.objectGestureActive || pointer.boothLayoutGestureActive
            }
            showClearanceWarnings={showClearanceWarnings}
            renderLayer="merged_zone"
          />
          {activeRoomFrames(store.doc).length > 0 ? (
            <RoomFrames
              frames={activeRoomFrames(store.doc)}
              objects={store.doc.objects}
              activeRoomId={activeRoomId ?? null}
              selectedRoomId={selectedRoomId ?? null}
              pxPerFt={pxPerFt}
              showLabels={showLabels}
            />
          ) : null}
          <CanvasObjects
            objects={store.doc.objects}
            layoutSpringPoses={layoutSpringPoses}
            rooms={store.doc.rooms}
            objectRoom={store.doc.objectRoom}
            dissolvedStageIds={dissolvedStageIds}
            selectedIds={store.selectedIds}
            pxPerFt={pxPerFt}
            showLabels={showLabels}
            overlappingIds={overlappingIds}
            pathfindingBottleneckIds={pathfindingBottleneckIds}
            editingObjectId={editingObjectId}
            eventCategoryNames={eventCategoryNames}
            boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
            boothMapLabelMode={boothMapLabelMode}
            boothMapLabelByObjectId={boothMapLabelByObjectId}
            boothClearanceBandByObjectId={boothClearanceBandByObjectId}
            emphasizeClearance={
              pointer.objectGestureActive || pointer.boothLayoutGestureActive
            }
            showClearanceWarnings={showClearanceWarnings}
            renderLayer="placable"
          />
          {toolState.tool === 'select' && !viewOnly ? (
            <SelectionChrome
              objects={store.doc.objects}
              selectedIds={filteredSelectionIds(
                store.doc.objects,
                store.selectedIds
              )}
              pxPerFt={pxPerFt}
            />
          ) : null}
          {toolState.tool === 'select' && !viewOnly && (selectedRoomId ?? activeRoomId)
            ? (() => {
                const interactionRoomId = selectedRoomId ?? activeRoomId
                const frame = (store.doc.rooms ?? []).find(
                  (f) => f.id === interactionRoomId
                )
                if (!frame || frame.mergedIntoObjectId) return null
                return (
                  <RoomSelectionOverlay
                    frame={frame}
                    pxPerFt={pxPerFt}
                    suppressHandles={pointer.roomGestureActive}
                    hoveredEdgeIndex={
                      pointer.roomEdgeHover?.roomId === frame.id
                        ? pointer.roomEdgeHover.edgeIndex
                        : null
                    }
                  />
                )
              })()
            : null}
          {toolState.tool === 'select' && !viewOnly ? (
            <SelectionRotateHandles
              objects={store.doc.objects}
              selectedIds={filteredSelectionIds(
                store.doc.objects,
                store.selectedIds
              )}
              pxPerFt={pxPerFt}
              suppressHandle={
                pointer.draftRect !== null || pointer.roomGestureActive
              }
            />
          ) : null}
          {!viewOnly ? (
            <DraftPreview
              rect={draftPreviewRect}
              kind={previewSourceKind}
              pxPerFt={pxPerFt}
              hasOverlap={draftOverlaps}
              rotation={draftPreviewRotation}
              ghost={isGhostPreview}
              clearanceTheme={draftClearanceTheme}
            />
          ) : null}
          {!viewOnly ? <MarqueePreview rect={pointer.marqueeRect} pxPerFt={pxPerFt} /> : null}
          <PatronAisleOverlay corridors={patronAisleCorridors} pxPerFt={pxPerFt} />
          <PatronTrafficPathOverlay
            path={patronTrafficPath}
            pathSegments={patronTrafficPathSegments}
            isPartial={patronPathIsPartial}
            pxPerFt={pxPerFt}
          />
          <UnifiedLayoutFlowOverlay
            spinePath={unifiedLayoutOverlay?.spinePath}
            clearanceField={unifiedLayoutOverlay?.clearanceField}
            pxPerFt={pxPerFt}
          />
          {!viewOnly && editingObj ? (
            <InlineLabelEditor
              obj={editingObj}
              pxPerFt={pxPerFt}
              onCommit={commitEditing}
              onCancel={cancelEditing}
            />
          ) : null}
        </svg>
        </div>
      </div>
    </div>
  )
}

function cursorForTool(tool: 'hand' | 'select' | 'draw' | 'pan'): string {
  switch (tool) {
    case 'pan':
      return 'grabbing'
    case 'hand':
      return 'grab'
    case 'draw':
      return 'crosshair'
    case 'select':
    default:
      return 'default'
  }
}
