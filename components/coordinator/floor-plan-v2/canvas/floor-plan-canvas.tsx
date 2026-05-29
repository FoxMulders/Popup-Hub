'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CanvasGrid } from './canvas-grid'
import { CanvasObjects } from './canvas-objects'
import {
  DraftPreview,
  MarqueePreview,
  SelectionOverlay,
} from './canvas-overlays'
import { InlineLabelEditor } from './inline-label-editor'
import { RoomFrames } from './room-frames'
import { RoomSelectionOverlay } from './room-selection-overlay'
import { roomUnionBounds } from '../state/room-canvas'
import { useViewport, type ViewportApi, type ZoomMath } from './use-viewport'
import { useCanvasPointer } from '../interactions/use-canvas-pointer'
import { useBoothCategoryTooltip } from '../interactions/use-booth-category-tooltip'
import {
  detectPlacedObjectOverlaps,
  placedObjectOverlapsAny,
} from '../interactions/geometry'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import type { LabelObject, PlacedObject } from '../state/types'
import type { ToolState } from '../tools/types'
import { cn } from '@/lib/utils'

interface FloorPlanCanvasProps {
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
  className?: string
  /** Fixed pixels-per-foot at zoom = 1. */
  basePxPerFt?: number
}

const DEFAULT_BASE_PX_PER_FT = 12

export function FloorPlanCanvas({
  store,
  toolState,
  activeRoomId,
  selectedRoomId,
  onRoomFrameClick,
  onAfterDrawCommit,
  onViewportReady,
  onZoomChange,
  eventCategoryNames,
  onProximityViolation,
  onOverlapViolation,
  onRoomCanvasLimitBlocked,
  className,
  basePxPerFt = DEFAULT_BASE_PX_PER_FT,
}: FloorPlanCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<SVGSVGElement>(null)

  // Add a generous infinite-feeling pad around the venue so users can
  // pan into negative coordinates and place objects "off the field".
  // This pad value is also what the zoom math needs for anchoring, so
  // we compute it once here and pass it to the viewport.
  const padFt = Math.max(40, store.doc.canvasWidthFt, store.doc.canvasLengthFt)

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
    // Tool ref so the viewport hook can route a single-touch drag into
    // a pan when the Hand tool is active. (Mouse panning already uses
    // middle-click / Shift+drag.)
    getToolMode: () => toolState.tool,
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
    onZoomChange?.(viewport.zoom)
  }, [onZoomChange, viewport.zoom])

  /**
   * Adaptive auto-zoom: when room frames spread apart, step zoom down
   * (80% per step from 1.0) so every room stays framed. Only zooms
   * out — never forces zoom-in while the user is inspecting detail.
   */
  const roomsLayoutKey = useMemo(() => {
    const frames = store.doc.rooms ?? []
    return frames
      .map(
        (f) =>
          `${f.id}:${f.originX},${f.originY},${f.widthFt},${f.lengthFt}`
      )
      .join('|')
  }, [store.doc.rooms])

  const lastAutoZoomRef = useRef<number | null>(null)
  useEffect(() => {
    const frames = store.doc.rooms ?? []
    if (frames.length === 0) return
    const scroll = scrollRef.current
    if (!scroll || scroll.clientWidth === 0 || scroll.clientHeight === 0) {
      return
    }
    const bounds = roomUnionBounds(frames)
    const widthFt = bounds.maxX - bounds.minX
    const heightFt = bounds.maxY - bounds.minY
    if (widthFt <= 0 || heightFt <= 0) return

    const padding = 0.12
    const stepFactor = 0.8
    const usableW = Math.max(40, scroll.clientWidth * (1 - padding * 2))
    const usableH = Math.max(40, scroll.clientHeight * (1 - padding * 2))
    let targetZoom = 1
    while (targetZoom >= 0.25) {
      const pxPerFt = basePxPerFt * targetZoom
      if (widthFt * pxPerFt <= usableW && heightFt * pxPerFt <= usableH) {
        break
      }
      targetZoom *= stepFactor
    }
    targetZoom = Math.max(0.25, Math.min(3, targetZoom))

    if (
      lastAutoZoomRef.current !== null &&
      targetZoom >= viewport.zoom - 0.02
    ) {
      return
    }
    lastAutoZoomRef.current = targetZoom
    if (targetZoom < viewport.zoom - 0.02) {
      viewport.fitToBoundsStepped(
        {
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
        },
        { padding, stepFactor, zoomMax: 1 }
      )
    }
  }, [basePxPerFt, roomsLayoutKey, viewport, store.doc.rooms])

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
    onProximityViolation,
    onOverlapViolation,
    onRoomCanvasLimitBlocked,
  })

  const overlappingIds = useMemo(
    () => detectPlacedObjectOverlaps(store.doc.objects),
    [store.doc.objects]
  )

  const draftOverlaps = useMemo(() => {
    const rect = pointer.draftRect
    const kind = pointer.draftKind
    if (!rect || !kind) return false
    const probe = {
      id: '__draft__',
      kind,
      x: rect.x,
      y: rect.y,
      width: Math.max(store.doc.snapFt || 1, rect.width),
      height: Math.max(store.doc.snapFt || 1, rect.height),
      rotation: 0,
    } as PlacedObject
    return placedObjectOverlapsAny(probe, store.doc.objects)
  }, [
    pointer.draftKind,
    pointer.draftRect,
    store.doc.objects,
    store.doc.snapFt,
  ])

  const categoryTooltip = useBoothCategoryTooltip({
    surfaceRef,
    transform,
    objects: store.doc.objects,
    disabled:
      viewport.isPanning ||
      viewport.panActive ||
      pointer.rotating ||
      pointer.draftRect !== null ||
      pointer.marqueeRect !== null,
  })

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

  /**
   * Initial centering: when the canvas first renders (or the document
   * dimensions change because the active room was switched / the user
   * resized the venue in the inspector), park the scroll container so
   * the room midpoint sits at the viewport center. This is the same
   * anchor the zoom buttons use when nothing is selected, so the
   * default frame and the zoom-target stay consistent.
   *
   * Tracked by a ref keyed on (width, length) so we don't fight the
   * user every time they manually pan or scroll.
   */
  const centeredForDimsRef = useRef<{ w: number; l: number } | null>(null)
  useLayoutEffect(() => {
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
    store.doc.canvasLengthFt,
    store.doc.canvasWidthFt,
  ])

  const cursor = pointer.rotating
    ? 'grabbing'
    : cursorForTool(viewport.isPanning ? 'pan' : toolState.tool)

  return (
    <div
      ref={scrollRef}
      className={cn(
        'relative h-full w-full overflow-auto bg-stone-50 outline-none',
        className
      )}
      tabIndex={0}
      role="application"
      aria-label="Floor plan canvas viewport"
      style={{ touchAction: 'none', cursor }}
      {...viewport.scrollHandlers}
      onMouseMove={categoryTooltip.onMouseMove}
      onMouseLeave={categoryTooltip.onMouseLeave}
    >
      {categoryTooltip.tooltip ? (
        <div
          className="pointer-events-none fixed z-50 rounded bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg"
          style={{
            left: categoryTooltip.tooltip.x,
            top: categoryTooltip.tooltip.y - 28,
            transform: 'translateX(-50%)',
          }}
          role="tooltip"
        >
          {categoryTooltip.tooltip.label}
        </div>
      ) : null}
      <div
        style={{
          width: totalWidthPx,
          height: totalHeightPx,
          position: 'relative',
        }}
      >
        <svg
          ref={surfaceRef}
          width={docWidthPx}
          height={docHeightPx}
          style={{
            position: 'absolute',
            left: padPx,
            top: padPx,
            display: 'block',
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
          onPointerDown={pointer.onPointerDown}
          onPointerMove={pointer.onPointerMove}
          onPointerUp={pointer.onPointerUp}
          onPointerCancel={pointer.onPointerUp}
          onContextMenu={pointer.onContextMenu}
          onDoubleClick={handleDoubleClick}
        >
          <CanvasGrid
            widthFt={store.doc.canvasWidthFt}
            lengthFt={store.doc.canvasLengthFt}
            spacingFt={store.doc.gridSpacingFt}
            pxPerFt={pxPerFt}
          />
          {store.doc.rooms && store.doc.rooms.length > 0 ? (
            <RoomFrames
              frames={store.doc.rooms}
              objects={store.doc.objects}
              activeRoomId={activeRoomId ?? null}
              selectedRoomId={selectedRoomId ?? null}
              pxPerFt={pxPerFt}
            />
          ) : null}
          <CanvasObjects
            objects={store.doc.objects}
            selectedIds={store.selectedIds}
            pxPerFt={pxPerFt}
            overlappingIds={overlappingIds}
            editingObjectId={editingObjectId}
            eventCategoryNames={eventCategoryNames}
          />
          {toolState.tool === 'select' ? (
            <SelectionOverlay
              objects={store.doc.objects}
              selectedIds={store.selectedIds}
              pxPerFt={pxPerFt}
              suppressHandle={
                pointer.draftRect !== null || pointer.roomGestureActive
              }
            />
          ) : null}
          {toolState.tool === 'select' && selectedRoomId
            ? (() => {
                const frame = (store.doc.rooms ?? []).find(
                  (f) => f.id === selectedRoomId
                )
                return frame ? (
                  <RoomSelectionOverlay
                    frame={frame}
                    pxPerFt={pxPerFt}
                    suppressHandles={pointer.roomGestureActive}
                  />
                ) : null
              })()
            : null}
          <DraftPreview
            rect={pointer.draftRect}
            kind={pointer.draftKind}
            pxPerFt={pxPerFt}
            hasOverlap={draftOverlaps}
          />
          <MarqueePreview rect={pointer.marqueeRect} pxPerFt={pxPerFt} />
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

