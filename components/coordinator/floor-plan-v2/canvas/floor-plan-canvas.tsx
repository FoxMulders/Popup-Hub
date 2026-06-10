'use client'

import {
  useCallback,
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
  SelectionChrome,
  SelectionRotateHandles,
} from './canvas-overlays'
import { InlineLabelEditor } from './inline-label-editor'
import { RoomDropZones } from './room-drop-zones'
import { RoomFrames } from './room-frames'
import { RoomSelectionOverlay } from './room-selection-overlay'
import { activeRoomFramingBounds } from '../state/room-canvas'
import { activeRoomFrames } from './canvas-engine'
import { FLOOR_PLAN_CANVAS_ID } from './canvas-focus'
import { useViewport, type ViewportApi, type ZoomMath } from './use-viewport'
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
import type { ToolState } from '../tools/types'
import { cn } from '@/lib/utils'
import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
import { VENDOR_DRAG_MIME } from '@/lib/coordinator/booth-placement-status'
import { dissolvedStageIdsForDoc } from '@/src/utils/layoutMergeEngine'

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
  onVendorDrop?: (applicationId: string, canvasX: number, canvasY: number) => void
  autoArrangeMode?: AutoArrangeMode
  /** Computed patron viewing path (feet) — dotted overlay when set. */
  patronTrafficPath?: ReadonlyArray<{ x: number; y: number }> | null
  /** 6′ patron aisle corridor rects (feet) — green overlay when set. */
  patronAisleCorridors?: ReadonlyArray<{
    x: number
    y: number
    width: number
    height: number
  }> | null
  /** Command center: higher zoom floor so drags feel less jumpy when framed out. */
  commandCenterViewport?: boolean
  /** Keep draw tool armed between placements; show hover ghost preview. */
  stickyDrawPlacement?: boolean
  /** Dock legend as left sidebar panel (dashboard). */
  legendVariant?: 'floating' | 'sidebar'
}

const DEFAULT_BASE_PX_PER_FT = 12
/** Minimum zoom on coordinator dashboard — avoids hypersensitive room drags when framed out. */
const COMMAND_CENTER_ZOOM_MIN = 0.75

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
  onVendorDrop,
  autoArrangeMode = 'grid',
  patronTrafficPath = null,
  patronAisleCorridors = null,
  commandCenterViewport = false,
  scrollHost = true,
  stickyDrawPlacement = false,
  legendVariant = 'floating',
}: FloorPlanCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<SVGSVGElement>(null)

  const padFt = commandCenterViewport
    ? 8
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

  const getZoomMath = useCallback<() => ZoomMath>(() => {
    const objects = store.doc.objects
    const selected = store.selectedIds
    let anchorX = store.doc.canvasWidthFt / 2
    let anchorY = store.doc.canvasLengthFt / 2

    if (selected.size > 0) {
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
    padFt,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
    store.doc.objects,
    store.selectedIds,
  ])

  const viewport = useViewport({
    scrollRef,
    initialZoom: 1,
    getZoomMath,
    zoomMin: commandCenterViewport ? COMMAND_CENTER_ZOOM_MIN : undefined,
    zoomStepMultiplier: commandCenterViewport ? 2 : 4,
    getToolMode: () => toolState.tool,
  })

  useEffect(() => {
    onViewportReady?.(viewport)
    return () => onViewportReady?.(null)
  }, [onViewportReady, viewport])

  useEffect(() => {
    onZoomChange?.(viewport.zoom)
  }, [onZoomChange, viewport.zoom])

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
          `${f.id}:${f.originX},${f.originY},${f.widthFt},${f.lengthFt},${f.mergedIntoObjectId ?? ''}`
      )
      .join('|')}:${mergedSig}`
  }, [activeRoomId, store.doc.objects, store.doc.rooms])

  const frameActiveRoom = useCallback(() => {
    const frames = store.doc.rooms ?? []
    if (frames.length === 0) {
      viewport.fitToBounds(
        {
          minX: 0,
          minY: 0,
          maxX: store.doc.canvasWidthFt,
          maxY: store.doc.canvasLengthFt,
        },
        { padding: commandCenterViewport ? 0.06 : 0.08 }
      )
      return
    }
    const bounds = activeRoomFramingBounds(
      frames,
      activeRoomId,
      store.doc.objects,
      store.doc.objectRoom
    )
    viewport.fitToBounds(bounds, {
      padding: commandCenterViewport ? 0.03 : 0.08,
    })
  }, [
    activeRoomId,
    commandCenterViewport,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
    store.doc.objectRoom,
    store.doc.objects,
    store.doc.rooms,
    viewport,
  ])

  const didInitialFrameRef = useRef(false)
  useEffect(() => {
    if (!scrollHost) return
    frameActiveRoom()
    didInitialFrameRef.current = true
  }, [frameActiveRoom, roomsFramingKey, scrollHost])

  useEffect(() => {
    if (!scrollHost) return
    const scroll = scrollRef.current
    if (!scroll || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (!didInitialFrameRef.current) return
      if (scroll.clientWidth > 0 && scroll.clientHeight > 0) {
        frameActiveRoom()
      }
    })
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [frameActiveRoom, scrollHost])

  const transform = useMemo(
    () => ({ basePxPerFt, zoom: viewport.zoom }),
    [basePxPerFt, viewport.zoom]
  )

  const pointer = useCanvasPointer({
    store,
    toolState,
    scrollRef,
    surfaceRef,
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
  })

  useSelectionKeyboardNudge(store, {
    activeRoomId: activeRoomId ?? null,
    onProximityViolation,
    onOverlapViolation,
  })

  useCanvasObjectKeyboard(store, { enabled: commandCenterViewport })

  const mergeOverlapCtx = useMemo(
    () => ({
      rooms: store.doc.rooms ?? [],
      objectRoom: store.doc.objectRoom,
      doc: store.doc,
    }),
    [store.doc]
  )

  const overlappingIds = useMemo(
    () => detectPlacedObjectOverlaps(store.doc.objects, mergeOverlapCtx),
    [mergeOverlapCtx, store.doc.objects]
  )

  const dissolvedStageIds = useMemo(
    () => dissolvedStageIdsForDoc(store.doc),
    [store.doc]
  )

  const previewSourceRect = pointer.draftRect ?? pointer.placementHoverRect
  const previewSourceKind = pointer.draftKind ?? pointer.placementHoverKind
  const isGhostPreview =
    pointer.draftRect == null && pointer.placementHoverRect != null

  const draftOverlaps = useMemo(() => {
    const rawRect = previewSourceRect
    const kind = previewSourceKind
    if (!rawRect || !kind) return false
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
      pointer.draftRect != null
        ? 0
        : pointer.placementHoverRotation
    const probe = {
      id: '__draft__',
      kind,
      x: preview?.x ?? rect.x,
      y: preview?.y ?? rect.y,
      width: preview?.width ?? rect.width,
      height: preview?.height ?? rect.height,
      rotation: preview?.rotation ?? rotation,
    } as PlacedObject
    return placedObjectOverlapsAny(probe, store.doc.objects, undefined, mergeOverlapCtx)
  }, [
    activeRoomId,
    defaultBoothTableSpec,
    mergeOverlapCtx,
    pointer.draftRect,
    pointer.placementHoverRotation,
    previewSourceKind,
    previewSourceRect,
    store.doc,
    store.doc.objects,
    store.doc.snapFt,
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

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (toolState.tool !== 'select') return
      const target = e.target as Element | null
      const id = target
        ?.closest('[data-object-id]')
        ?.getAttribute('data-object-id')
      if (!id) return
      const obj = store.doc.objects.find((o) => o.id === id)
      if (!obj || obj.locked) return
      e.preventDefault()
      e.stopPropagation()
      if (!store.selectedIds.has(id)) {
        store.setSelection([id])
      }
      setEditingObjectId(id)
    },
    [store, toolState.tool]
  )

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
  const docWidthPx = store.doc.canvasWidthFt * pxPerFt
  const docHeightPx = store.doc.canvasLengthFt * pxPerFt
  const padPx = padFt * pxPerFt
  const totalWidthPx = docWidthPx + padPx * 2
  const totalHeightPx = docHeightPx + padPx * 2

  const centeredForDimsRef = useRef<{ w: number; l: number } | null>(null)
  useLayoutEffect(() => {
    if (!scrollHost) return
    const scroll = scrollRef.current
    if (!scroll) return
    if (scroll.clientWidth === 0 || scroll.clientHeight === 0) return
    const w = store.doc.canvasWidthFt
    const l = store.doc.canvasLengthFt
    const last = centeredForDimsRef.current
    if (last && last.w === w && last.l === l) return
    scroll.scrollLeft = (padFt + w / 2) * pxPerFt - scroll.clientWidth / 2
    scroll.scrollTop = (padFt + l / 2) * pxPerFt - scroll.clientHeight / 2
    centeredForDimsRef.current = { w, l }
  }, [
    padFt,
    pxPerFt,
    scrollHost,
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
  ])

  const cursor = pointer.rotating
    ? 'grabbing'
    : viewport.isPanning
      ? 'grabbing'
      : cursorForTool(viewport.isPanning ? 'pan' : toolState.tool, commandCenterViewport)

  const ftAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const surface = surfaceRef.current
      if (!surface) return { x: 0, y: 0 }
      const rect = surface.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      const ratio = basePxPerFt * viewport.zoom
      if (ratio === 0) return { x: 0, y: 0 }
      return { x: px / ratio, y: py / ratio }
    },
    [basePxPerFt, viewport.zoom]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onVendorDrop) return
      if (e.dataTransfer.types.includes(VENDOR_DRAG_MIME)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    },
    [onVendorDrop]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!onVendorDrop) return
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
    [ftAtClient, onVendorDrop]
  )

  const { onWheel: onViewportWheel, ...viewportPointerHandlers } =
    viewport.scrollHandlers

  return (
    <div
      id={FLOOR_PLAN_CANVAS_ID}
      ref={scrollRef}
      className={cn(
        'canvas-container pointer-events-auto relative w-full min-w-0 max-w-full bg-stone-100 outline-none',
        scrollHost && !commandCenterViewport && 'h-full overflow-auto',
        scrollHost && commandCenterViewport && 'h-full overflow-hidden scrollbar-none',
        commandCenterViewport && 'bg-stone-100',
        className
      )}
      tabIndex={0}
      role="application"
      aria-label="Floor plan canvas viewport"
      style={{ touchAction: 'none', cursor }}
      {...viewportPointerHandlers}
      onWheelCapture={onViewportWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        style={{
          width: totalWidthPx,
          height: totalHeightPx,
          position: 'relative',
        }}
      >
        <svg
          ref={surfaceRef}
          className="floor-plan-canvas-surface"
          width={docWidthPx}
          height={docHeightPx}
          style={{
            position: 'absolute',
            left: padPx,
            top: padPx,
            display: 'block',
            pointerEvents: 'auto',
            zIndex: 1,
            background: '#fafaf9',
            boxShadow:
              '0 0 0 1px rgb(214 211 209), 0 4px 14px rgb(28 25 23 / 0.12)',
            cursor,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
          onPointerDown={(e) => {
            if (toolState.tool === 'hand') return
            e.preventDefault()
            pointer.onPointerDown(e)
          }}
          onPointerMove={pointer.onPointerMove}
          onPointerUp={pointer.onPointerUp}
          onPointerCancel={pointer.onPointerUp}
          onContextMenu={pointer.onContextMenu}
          onDoubleClick={handleDoubleClick}
        >
          <CanvasGrid
            widthFt={store.doc.canvasWidthFt}
            lengthFt={store.doc.canvasLengthFt}
            spacingFt={gridSpacing.minorFt}
            majorEvery={gridSpacing.majorEvery ?? CANVAS_GRID_MAJOR_EVERY}
            pxPerFt={pxPerFt}
          />
          <RoomDropZones
            doc={store.doc}
            pxPerFt={pxPerFt}
            activeRoomId={activeRoomId ?? null}
          />
          <CanvasObjects
            objects={store.doc.objects}
            rooms={store.doc.rooms}
            dissolvedStageIds={dissolvedStageIds}
            selectedIds={store.selectedIds}
            pxPerFt={pxPerFt}
            showLabels={showLabels}
            overlappingIds={overlappingIds}
            editingObjectId={editingObjectId}
            eventCategoryNames={eventCategoryNames}
            boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
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
            rooms={store.doc.rooms}
            dissolvedStageIds={dissolvedStageIds}
            selectedIds={store.selectedIds}
            pxPerFt={pxPerFt}
            showLabels={showLabels}
            overlappingIds={overlappingIds}
            editingObjectId={editingObjectId}
            eventCategoryNames={eventCategoryNames}
            boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
            renderLayer="placable"
          />
          {toolState.tool === 'select' ? (
            <SelectionChrome
              objects={store.doc.objects}
              selectedIds={filteredSelectionIds(
                store.doc.objects,
                store.selectedIds
              )}
              pxPerFt={pxPerFt}
            />
          ) : null}
          {toolState.tool === 'select' && (selectedRoomId ?? activeRoomId)
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
                  />
                )
              })()
            : null}
          {toolState.tool === 'select' ? (
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
          <DraftPreview
            rect={draftPreviewRect}
            kind={previewSourceKind}
            pxPerFt={pxPerFt}
            hasOverlap={draftOverlaps}
            rotation={draftPreviewRotation}
            ghost={isGhostPreview}
          />
          <MarqueePreview rect={pointer.marqueeRect} pxPerFt={pxPerFt} />
          <PatronAisleOverlay corridors={patronAisleCorridors} pxPerFt={pxPerFt} />
          <PatronTrafficPathOverlay path={patronTrafficPath} pxPerFt={pxPerFt} />
          {editingObj ? (
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
  )
}

function cursorForTool(
  tool: 'hand' | 'select' | 'draw' | 'pan',
  commandCenter?: boolean
): string {
  switch (tool) {
    case 'pan':
      return 'grabbing'
    case 'hand':
      return 'grab'
    case 'draw':
      return 'crosshair'
    case 'select':
    default:
      return commandCenter ? 'grab' : 'default'
  }
}
