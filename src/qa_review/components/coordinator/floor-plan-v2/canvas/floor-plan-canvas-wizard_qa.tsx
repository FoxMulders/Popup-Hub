'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { CanvasGrid } from '@/components/coordinator/floor-plan-v2/canvas/canvas-grid'
import { CanvasObjects } from '@/components/coordinator/floor-plan-v2/canvas/canvas-objects'
import {
  DraftPreview,
  MarqueePreview,
  PatronTrafficPathOverlay,
  SelectionOverlay,
} from '@/components/coordinator/floor-plan-v2/canvas/canvas-overlays'
import { InlineLabelEditor } from '@/components/coordinator/floor-plan-v2/canvas/inline-label-editor'
import { RoomDropZones } from '@/components/coordinator/floor-plan-v2/canvas/room-drop-zones'
import { RoomFrames } from '@/components/coordinator/floor-plan-v2/canvas/room-frames'
import { RoomSelectionOverlay } from '@/components/coordinator/floor-plan-v2/canvas/room-selection-overlay'
import { activeRoomFrames } from '@/components/coordinator/floor-plan-v2/canvas/canvas-engine'
import { FLOOR_PLAN_CANVAS_ID } from '@/components/coordinator/floor-plan-v2/canvas/canvas-focus'
import {
  contentFramingBounds,
  fitViewportToContent,
} from '@/components/coordinator/floor-plan-v2/canvas/use-layout-viewport'
import {
  normalizeViewportZoom,
  useCanvasViewportFraming,
} from '@/components/coordinator/floor-plan-v2/canvas/use-canvas-viewport-framing'
import { useViewport, type ViewportApi, type ZoomMath } from '@/components/coordinator/floor-plan-v2/canvas/use-viewport'
import { useCanvasPointerWizardQa } from '@/src/qa_review/components/coordinator/floor-plan-v2/interactions/use-canvas-pointer-wizard_qa'
import { resolveDrawCommitRect } from '@/components/coordinator/floor-plan-v2/interactions/use-canvas-pointer'
import {
  detectPlacedObjectOverlaps,
  placedObjectOverlapsAny,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import type { FloorPlanDocStore } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { TableSizeSpec } from '@/lib/booth-planner/table-shape'
import { DEFAULT_TABLE_SIZE } from '@/lib/booth-planner/layout-table-size'
import { canvasGridSpacingForTableFt } from '@/components/coordinator/floor-plan-v2/canvas/canvas-grid-spacing'
import type { LabelObject, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { AutoArrangeMode } from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import type { ToolState } from '@/components/coordinator/floor-plan-v2/tools/types'
import {
  QA_CANVAS_CONTAINER_CLASS,
  QA_GLOBAL_PAGE_SCROLL,
} from '@/src/qa_review/lib/qa-scroll-layout_qa'
import { cn } from '@/lib/utils'
import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
import { VENDOR_DRAG_MIME } from '@/lib/coordinator/booth-placement-status'

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
  /** Command center: higher zoom floor so drags feel less jumpy when framed out. */
  commandCenterViewport?: boolean
}

const DEFAULT_BASE_PX_PER_FT = 12
/** Minimum zoom on coordinator dashboard — avoids hypersensitive room drags when framed out. */
const COMMAND_CENTER_ZOOM_MIN = 0.72

export function LayoutCanvasWizardQa(props: FloorPlanCanvasProps) {
  return <FloorPlanCanvasWizardQa {...props} />
}

export function FloorPlanCanvasWizardQa({
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
  commandCenterViewport = false,
  scrollHost = true,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<SVGSVGElement>(null)

  // Add a generous infinite-feeling pad around the venue so users can
  // pan into negative coordinates and place objects "off the field".
  // This pad value is also what the zoom math needs for anchoring, so
  // we compute it once here and pass it to the viewport.
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

  /**
   * Anchor priority for "discrete" zoom (buttons, reset, programmatic):
   *   1. If at least one object is selected, use the centroid of its
   *      union bounding box. Multi-select uses the union, so the camera
   *      frames the selection as a group.
   *   2. Otherwise, fall back to the absolute room center
   *      (canvasWidthFt / 2, canvasLengthFt / 2). This keeps an empty
   *      hall locked at the middle of the viewport during zoom.
   *
   * Wheel and pinch zoom override this with a screen-anchored math
   * inside the viewport hook — the cursor / finger midpoint stays
   * locked, which matches Figma / Miro behavior. The rule below is
   * the *fallback* anchor for everything else.
   */
  const getZoomMath = useCallback<() => ZoomMath>(() => {
    const objects = store.doc.objects
    const selected = store.selectedIds
    const contentBounds = contentFramingBounds(store.doc, activeRoomId)
    let anchorX = (contentBounds.minX + contentBounds.maxX) / 2
    let anchorY = (contentBounds.minY + contentBounds.maxY) / 2

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
    activeRoomId,
    basePxPerFt,
    padFt,
    store.doc,
    store.doc.objects,
    store.selectedIds,
  ])

  const viewport = useViewport({
    scrollRef,
    initialZoom: 1,
    getZoomMath,
    zoomMin: commandCenterViewport ? COMMAND_CENTER_ZOOM_MIN : undefined,
    zoomStepMultiplier: commandCenterViewport ? 2 : 4,
    // Tool ref so the viewport hook can route a single-touch drag into
    // a pan when the Hand tool is active. (Mouse panning already uses
    // middle-click / Shift+drag.)
    getToolMode: () => toolState.tool,
  })

  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

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
    return fitViewportToContent(
      viewportRef.current,
      store.doc,
      activeRoomId,
      { commandCenterViewport }
    )
  }, [activeRoomId, commandCenterViewport, store.doc])

  useCanvasViewportFraming({
    scrollRef,
    containerRef,
    framingKey: viewportFramingKey,
    onFrame: frameActiveRoom,
    observeContainer: scrollHost,
  })

  // Lift zoom controls to the host so the toolbar (rendered outside
  // this canvas's DOM subtree) can drive zoom in / zoom out / reset.
  // The API object is recreated each render so we only forward it
  // on identity change, not on each zoom tick — host re-renders for
  // the % readout via `onZoomChange` instead.
  useEffect(() => {
    onViewportReady?.(viewport)
    return () => onViewportReady?.(null)
  }, [onViewportReady, viewport])

  useEffect(() => {
    onZoomChange?.(
      normalizeViewportZoom(viewport.zoom, viewport.getBaselineZoom())
    )
  }, [onZoomChange, viewport.getBaselineZoom, viewport.zoom])

  const transform = useMemo(
    () => ({ basePxPerFt, zoom: viewport.zoom }),
    [basePxPerFt, viewport.zoom]
  )

  const pointer = useCanvasPointerWizardQa({
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
  })

  const mergeOverlapCtx = useMemo(
    () => ({ rooms: store.doc.rooms ?? [] }),
    [store.doc.rooms]
  )

  const overlappingIds = useMemo(
    () => detectPlacedObjectOverlaps(store.doc.objects, mergeOverlapCtx),
    [mergeOverlapCtx, store.doc.objects]
  )

  const draftOverlaps = useMemo(() => {
    const rawRect = pointer.draftRect
    const kind = pointer.draftKind
    if (!rawRect || !kind) return false
    const rect = resolveDrawCommitRect(
      kind,
      rawRect,
      store.doc.snapFt,
      defaultBoothTableSpec
    )
    const probe = {
      id: '__draft__',
      kind,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      rotation: 0,
    } as PlacedObject
    return placedObjectOverlapsAny(probe, store.doc.objects, undefined, mergeOverlapCtx)
  }, [
    defaultBoothTableSpec,
    mergeOverlapCtx,
    pointer.draftKind,
    pointer.draftRect,
    store.doc.objects,
    store.doc.snapFt,
  ])

  const draftPreviewRect = useMemo(() => {
    const rawRect = pointer.draftRect
    const kind = pointer.draftKind
    if (!rawRect || !kind) return null
    return resolveDrawCommitRect(
      kind,
      rawRect,
      store.doc.snapFt,
      defaultBoothTableSpec
    )
  }, [
    defaultBoothTableSpec,
    pointer.draftKind,
    pointer.draftRect,
    store.doc.snapFt,
  ])

  /**
   * Inline label editor state. A double-click on any placed object
   * swaps the static SVG label for an HTML `<input>` rendered through
   * `<foreignObject>` so the user can rename in place. Tracked here
   * (rather than in the floor-plan-v2 host) because the editor is
   * positioned in canvas-pixel space, which is local to this surface.
   */
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
  const editingObj = useMemo<PlacedObject | null>(() => {
    if (!editingObjectId) return null
    return store.doc.objects.find((o) => o.id === editingObjectId) ?? null
  }, [editingObjectId, store.doc.objects])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Only react to dblclick in select mode — in draw mode the user
      // is mid-stroke and a stray dblclick shouldn't pop a renamer.
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
      // Make sure the object is selected so cancel/blur leaves the
      // user with the same selection state they expected.
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

  // Close any active edit if the underlying object disappears (e.g.
  // it was deleted via the toolbar while the input was focused).
  useEffect(() => {
    if (editingObjectId && !editingObj) setEditingObjectId(null)
  }, [editingObj, editingObjectId])

  const pxPerFt = transform.basePxPerFt * transform.zoom
  const docWidthPx = store.doc.canvasWidthFt * pxPerFt
  const docHeightPx = store.doc.canvasLengthFt * pxPerFt
  const padPx = padFt * pxPerFt
  const totalWidthPx = docWidthPx + padPx * 2
  const totalHeightPx = docHeightPx + padPx * 2

  const cursor = pointer.rotating
    ? 'grabbing'
    : cursorForTool(viewport.isPanning ? 'pan' : toolState.tool)

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

  const warnOverlayCapture = useCallback((target: EventTarget | null) => {
    if (!target || !(target instanceof Element)) return
    const overlay = target.closest('[data-kind="merged_zone"]')
    if (overlay) {
      console.warn('Click captured by overlay:', target)
    }
  }, [])

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

  const handleWheelCapture = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (QA_GLOBAL_PAGE_SCROLL && !e.ctrlKey && !e.metaKey) {
        return
      }
      onViewportWheel(e)
    },
    [onViewportWheel]
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-0 w-full',
        scrollHost ? 'h-full flex-1' : 'h-auto',
        className
      )}
    >
      <div
        id={FLOOR_PLAN_CANVAS_ID}
        ref={scrollRef}
        className={cn(
          scrollHost
            ? 'canvas-container pointer-events-auto relative h-full w-full overflow-auto bg-stone-100 outline-none'
            : QA_CANVAS_CONTAINER_CLASS,
          commandCenterViewport && 'bg-stone-100'
        )}
      tabIndex={0}
      role="application"
      aria-label="Floor plan canvas viewport"
      style={{ touchAction: 'none', cursor }}
      {...viewportPointerHandlers}
      onWheelCapture={handleWheelCapture}
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
            boxShadow: '0 0 0 1px #e7e5e4, 0 12px 28px rgba(28,25,23,0.08)',
            cursor,
            // touch-action:none is critical on iOS Safari — without it
            // the OS captures the first touchmove for native scrolling
            // and our pointermove arrives ~300ms late (or not at all).
            // userSelect:none stops long-press from triggering iOS
            // text selection callouts when dragging objects.
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
          onMouseDownCapture={(e) => {
            warnOverlayCapture(e.target)
          }}
          onPointerDown={(e) => {
            warnOverlayCapture(e.target)
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
            majorEvery={gridSpacing.majorEvery}
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
            <SelectionOverlay
              objects={store.doc.objects}
              selectedIds={store.selectedIds}
              pxPerFt={pxPerFt}
              suppressHandle={
                pointer.draftRect !== null ||
                pointer.roomGestureActive ||
                pointer.objectGestureActive
              }
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
                    suppressHandles={
                      pointer.roomGestureActive || pointer.objectGestureActive
                    }
                  />
                )
              })()
            : null}
          <DraftPreview
            rect={draftPreviewRect}
            kind={pointer.draftKind}
            pxPerFt={pxPerFt}
            hasOverlap={draftOverlaps}
          />
          <MarqueePreview rect={pointer.marqueeRect} pxPerFt={pxPerFt} />
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

