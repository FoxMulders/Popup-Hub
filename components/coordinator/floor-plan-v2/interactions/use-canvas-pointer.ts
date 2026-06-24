'use client'

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type MutableRefObject,
} from 'react'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import {
  boothDimensionsForTableSpec,
  boothPatchForTableSize,
} from '@/lib/booth-planner/table-booth-consolidation'
import {
  isGuestTableBooth,
  isTentTableSpec,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'
import { TENT_OUTDOOR_ONLY_TOOLTIP } from '@/lib/booth-planner/indoor-shell'
import type { AmenityType, BoothObject, PlacedObject, RoomFrame } from '../state/types'
import { useDebugLog } from '../debug/debug-log-context'
import { formatPlacementProbe } from '../debug/format-geometry-log'
import {
  isCanvasOpenPlacementKind,
  isValidCanvasOpenPlacement,
  defaultFoodTruckFootprintFt,
} from '@/lib/floor-plan/canvas-open-placement'
import {
  defaultAmenityFootprintFt,
  defaultAmenityLabel,
  nextAmenityLabel,
} from '@/lib/floor-plan/amenity-placement'
import {
  defaultFoodCourtFootprintFt,
  nextFoodCourtLabel,
} from '@/lib/floor-plan/food-court-placement'
import {
  defaultStageFootprintFt,
  nextStageLabel,
} from '@/lib/floor-plan/stage-placement'
import { isOutdoorVenueProfile, venueProfileForRoom } from '@/lib/floor-plan/venue-profile'
import {
  isValidObjectPlacement,
  resolvePlacementRoomIdForObject,
  type PlacementProbe,
} from '../geometry/is-point-in-room'
import type { ToolState } from '../tools/types'
import {
  aabbFitsCanvas,
  canvasClampDelta,
  groupCanvasClampDelta,
  hitTest,
  normalizeRect,
  objectCenter,
  pointInsideFrame,
  pointInsideRoomPlacement,
  rectsIntersect,
  rotatedAabb,
  roomDragMotionScale,
  roomDragSnapFt,
  scalePointFromAnchor,
  snapPoint,
  snapToGrid,
  type Point,
  type Rect,
  type ViewportTransform,
} from './geometry'
import { objectFootprintAabb } from '../state/table-cluster-layout'
import {
  objectResizeFromHandle,
  patchForObjectResize,
  pointerInObjectSpace,
  type ObjectResizeHandle,
} from './object-resize'
import {
  roomResizeFromHandle,
  type RoomResizeHandle,
} from '../state/room-canvas'
import { hitTestRoomStroke } from '../state/room-joins'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import {
  findBoothProximityViolation,
  findFirstViolationInMove,
} from './category-rules'
import { isVendorBoothObject } from './vendor-booth-placement'
import {
  defaultStructuralDoorFootprintFt,
  isStructuralWallSnapKind,
  orientLongEdgeAlongWall,
  snapStructuralAssetForDoc,
  snapStructuralAssetToLocalPerimeter,
  snapStructuralAssetToRoomFrame,
  structuralLayoutMovePatch,
} from './structural-wall-snap'
import { resolveTablePlacementPreview } from './table-placement-preview'
import {
  footprintClampDeltaForRoom,
} from '@/lib/floor-plan/boundary-constraints'
import {
  boothLayoutCommitPatch,
  boothLayoutMovePatch,
  resolveBoothMoveSnapFt,
} from '../engine/booth-layout-engine'
import {
  editableRingForFrame,
  moveVertex,
  nearestEdgeHit,
  nearestVertexHit,
} from '../geometry/polygon-edit'

interface UseCanvasPointerOptions {
  store: FloorPlanDocStore
  toolState: ToolState
  scrollRef: RefObject<HTMLElement | null>
  surfaceRef: RefObject<SVGSVGElement | null>
  /** When set, pointer coords use this clip box instead of the SVG rect. */
  clipViewportRef?: RefObject<HTMLElement | null>
  transform: ViewportTransform
  /**
   * When true the canvas's own pointer pipeline yields to whatever
   * external pan/zoom hook is attached (e.g. middle-button pan, two-
   * finger touch pan). Currently used to skip pointer handling while a
   * pinch is active.
   */
  panActive: boolean
  /**
   * Called whenever a draw gesture commits a new object. The host owns
   * tool-switching policy (sticky placement vs revert to Select).
   */
  onAfterDrawCommit?: () => void
  /**
   * Dashboard command center — keep draw tool armed after commit and
   * show a hover ghost preview between placements.
   */
  stickyDrawPlacement?: boolean
  /**
   * Sorted list of category names defined on this event. Used by the
   * draw-commit flow to assign each new booth to the *least*-used
   * category in the current document — so two newly-placed booths
   * never default into the same bucket and end up clustered. Empty /
   * undefined disables the auto-assignment (booth is born untagged).
   */
  eventCategoryNames?: ReadonlyArray<string>
  /**
   * Active room id on the unified multi-room canvas. New draws and
   * paste-spawned objects inherit this association so saves project
   * back into the right `LayoutRoom`. Empty / null falls back to
   * "no association" (legacy single-room behaviour).
   */
  activeRoomId?: string | null
  /**
   * Currently selected room frame on the canvas. Used by the
   * pointer-down router to decide whether a Select-tool click on a
   * frame stroke promotes to a macro-level frame drag.
   */
  selectedRoomId?: string | null
  /** Notifies the host when a click selects a room frame. */
  onRoomFrameClick?: (roomId: string, options?: { additive?: boolean }) => void
  /** Fired after a layout mutation commits (drag end, draw, resize). */
  onLayoutCommit?: () => void
  /** Fired after a room drag/resize gesture commits geometry. */
  onRoomGeometryCommit?: () => void
  /** Fired when a room drag/resize is blocked (e.g. origin at 0,0). */
  onRoomCanvasLimitBlocked?: () => void
  /**
   * Notifies the host that a placement (draw or drag) was rejected by
   * the same-category proximity rule (`category-rules.ts`). The host
   * surfaces a toast — the rule logic itself stays headless so it can
   * be unit-tested without React or sonner.
   */
  onProximityViolation?: (info: {
    category: string
    dxColumns: number
    dyRows: number
  }) => void
  /** Notifies the host when a placement is rejected due to overlap. */
  onOverlapViolation?: () => void
  /** Footprint template for newly drawn booths. */
  defaultBoothTableSpec?: TableSizeSpec
  /** When set, pointer reads placement spec from this ref (sync updates). */
  defaultBoothTableSpecRef?: MutableRefObject<TableSizeSpec | undefined>
  /** When `perimeter-only`, booths snap/orient to room walls after drag. */
  autoArrangeMode?: AutoArrangeMode
  /** Dashboard command center: damp room drag/resize and raise zoom floor. */
  commandCenterViewport?: boolean
  /** When false, same-category proximity spacing is not enforced on draw/drag. */
  enforceCategorySeparation?: boolean
  /** Surfaces placement rejections (e.g. tent on indoor lot). */
  onDrawPlacementRejected?: (message: string) => void
}

type DrawDraft =
  | null
  | {
      anchor: Point
      current: Point
      kind: PlacedObject['kind']
      amenityType?: AmenityType
    }

type DragState =
  | null
  | {
      pointerId: number
      ids: string[]
      origin: Point
      lastFt: Point
      moved: boolean
      /** Original object positions keyed by id, for absolute deltas. */
      originals: Map<string, { x: number; y: number }>
    }

type MarqueeState =
  | null
  | {
      pointerId: number
      anchor: Point
      current: Point
    }

/**
 * Active rotate gesture state. Started when the user pointer-downs on
 * an element with `data-rotate-handle="true"` and ended on pointer-up.
 *
 * `initialAngle` is the angle (degrees) from the anchor object's center
 * to the initial pointer position; the same delta angle is then applied
 * to every selected object in `affected` (each rotated independently
 * around its own center) so multi-select gestures rotate the whole
 * group rather than only the dragged anchor.
 */
type RotateState =
  | null
  | {
      pointerId: number
      /** The object whose handle was grabbed — drives the cursor angle. */
      anchorId: string
      anchorCenterFt: Point
      anchorInitialAngleDeg: number
      /** Snapshot of every object affected by this gesture. */
      affected: Array<{
        id: string
        initialRotation: number
        initialX: number
        initialY: number
      }>
    }

/**
 * Active macro-level room-drag gesture. Started when the user
 * pointer-downs on an element with `data-room-stroke="true"` and ends
 * on pointer-up. While active we apply a *cumulative* delta to the
 * room's origin — accumulated outside the gesture's history so the
 * undo stack only grows by one entry on commit.
 */
type RoomDragState =
  | null
  | {
      pointerId: number
      roomId: string
      origin: Point
      lastDx: number
      lastDy: number
      moved: boolean
      limitNotified: boolean
    }

type ObjectResizeState =
  | null
  | {
      pointerId: number
      objectId: string
      handle: ObjectResizeHandle
      initial: PlacedObject
      moved: boolean
    }

type RoomResizeState =
  | null
  | {
      pointerId: number
      roomId: string
      handle: RoomResizeHandle
      initialFrame: RoomFrame
      anchor: Point
      moved: boolean
      limitNotified: boolean
    }

type RoomVertexDragState =
  | null
  | {
      pointerId: number
      roomId: string
      vertexIndex: number
      initialRing: ReadonlyArray<readonly [number, number]>
      moved: boolean
    }

/**
 * 15° increments match the toolbar buttons; holding Shift switches to
 * smooth 1° rotation for fine adjustments.
 */
const ROTATE_SNAP_DEG = 15

/**
 * Returns the angle (in degrees, clockwise, 0 = +X axis) from `center`
 * to `p`. Used by the rotate handle to translate pointer motion into
 * a delta rotation.
 */
function angleDegFromCenter(center: Point, p: Point): number {
  return (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI
}

/** Wrap a degree value into the canonical (-180, 180] range. */
function normalizeDegrees(deg: number): number {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/**
 * Map a freehand draw rect to the object that will actually be placed.
 * Booths snap to the active table-length footprint and center inside
 * the drawn area so coordinators need not drag exact dimensions.
 */
export function resolveDrawCommitRect(
  kind: PlacedObject['kind'],
  rect: Rect,
  snapFt: number,
  defaultBoothTableSpec?: TableSizeSpec,
  amenityType?: AmenityType
): Rect {
  const minSize = snapFt || 1
  const centerStamp = (
    width: number,
    height: number
  ): Rect => {
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    return {
      x: snapToGrid(cx - width / 2, snapFt),
      y: snapToGrid(cy - height / 2, snapFt),
      width,
      height,
    }
  }
  if (kind === 'food_truck') {
    const { width, height } = defaultFoodTruckFootprintFt()
    return centerStamp(width, height)
  }
  if (kind === 'stage') {
    const { width, height } = defaultStageFootprintFt()
    return centerStamp(width, height)
  }
  if (kind === 'food_court') {
    const { width, height } = defaultFoodCourtFootprintFt()
    return centerStamp(width, height)
  }
  if (kind === 'amenity' && amenityType) {
    const { width, height } = defaultAmenityFootprintFt(amenityType)
    return centerStamp(width, height)
  }
  if (kind === 'door' || kind === 'emergency_exit') {
    const drawnW = Math.max(minSize, rect.width)
    const drawnH = Math.max(minSize, rect.height)
    const hasDragExtent = drawnW > minSize || drawnH > minSize
    const { width, height } = hasDragExtent
      ? orientLongEdgeAlongWall(drawnW, drawnH)
      : defaultStructuralDoorFootprintFt()
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    return {
      x: snapToGrid(cx - width / 2, snapFt),
      y: snapToGrid(cy - height / 2, snapFt),
      width,
      height,
    }
  }
  if (kind !== 'booth' || defaultBoothTableSpec == null) {
    return {
      x: rect.x,
      y: rect.y,
      width: Math.max(minSize, rect.width),
      height: Math.max(minSize, rect.height),
    }
  }
  const { width, height } = boothDimensionsForTableSpec(defaultBoothTableSpec)
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  return {
    x: snapToGrid(cx - width / 2, snapFt),
    y: snapToGrid(cy - height / 2, snapFt),
    width,
    height,
  }
}

function dragCommitPatchForObject(
  obj: PlacedObject,
  doc: FloorPlanDocStore['doc'],
  activeRoomId: string | null | undefined,
  snapFt: number
): Partial<PlacedObject> {
  if (obj.kind === 'booth') {
    const booth = obj as BoothObject
    if (!isGuestTableBooth(booth)) {
      return boothLayoutCommitPatch(booth, doc, {
        snapFt,
        activeRoomId,
      })
    }
    const roomId = doc.objectRoom?.[booth.id] ?? activeRoomId
    if (roomId) {
      const clamp = footprintClampDeltaForRoom(booth, doc, roomId)
      if (clamp.dx !== 0 || clamp.dy !== 0) {
        return {
          x: booth.x + clamp.dx,
          y: booth.y + clamp.dy,
        }
      }
    }
    return { x: booth.x, y: booth.y }
  }
  let patch: Partial<PlacedObject> = { x: obj.x, y: obj.y }
  if (isStructuralWallSnapKind(obj.kind)) {
    const roomId = doc.objectRoom?.[obj.id] ?? activeRoomId
    const frame = roomId ? doc.rooms?.find((r) => r.id === roomId) : null
    if (frame) {
      patch = snapStructuralAssetToRoomFrame(obj, frame)
    } else {
      const snap = snapStructuralAssetForDoc(obj, doc)
      if (snap) patch = snap
    }
  }
  return patch
}

function objectWithPatch(
  obj: PlacedObject,
  patch: Partial<PlacedObject>
): PlacedObject {
  return { ...obj, ...patch } as PlacedObject
}

export interface CanvasPointerApi {
  draftRect: Rect | null
  draftKind: PlacedObject['kind'] | null
  /** Sticky draw mode — ghost footprint at cursor between placements. */
  placementHoverRect: Rect | null
  placementHoverKind: PlacedObject['kind'] | null
  placementHoverRotation: number
  marqueeRect: Rect | null
  /** True while the user is actively dragging an on-canvas rotate handle. */
  rotating: boolean
  /** True during macro room drag or resize. */
  roomGestureActive: boolean
  /** True while dragging a room perimeter vertex. */
  roomVertexDragActive: boolean
  /** Hovered edge on the selected room (select tool). */
  roomEdgeHover: { roomId: string; edgeIndex: number } | null
  /** Hovered vertex index on the selected room. */
  roomVertexHover: number | null
  /** True while dragging an object resize handle. */
  objectGestureActive: boolean
  /** True while actively dragging booths across the canvas. */
  boothLayoutGestureActive: boolean
  /** Select tool — pointer over empty canvas (no object hit). */
  emptyCanvasHover: boolean
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => boolean
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
  onContextMenu: (e: React.MouseEvent<SVGSVGElement>) => void
}

export function useCanvasPointer(
  options: UseCanvasPointerOptions
): CanvasPointerApi {
  const {
    store,
    toolState,
    scrollRef,
    surfaceRef,
    clipViewportRef,
    transform,
    panActive,
  } = options
  const { addLog } = useDebugLog()
  const addLogRef = useRef(addLog)
  useEffect(() => {
    addLogRef.current = addLog
  }, [addLog])
  const onAfterDrawCommit = options.onAfterDrawCommit
  const stickyDrawPlacement = options.stickyDrawPlacement ?? false
  const stickyDrawPlacementRef = useRef(stickyDrawPlacement)
  useEffect(() => {
    stickyDrawPlacementRef.current = stickyDrawPlacement
  }, [stickyDrawPlacement])
  const eventCategoryNames = options.eventCategoryNames
  const commandCenterViewport = options.commandCenterViewport ?? false
  const enforceCategorySeparation = options.enforceCategorySeparation ?? true
  const enforceCategorySeparationRef = useRef(enforceCategorySeparation)
  useEffect(() => {
    enforceCategorySeparationRef.current = enforceCategorySeparation
  }, [enforceCategorySeparation])
  const onProximityViolation = options.onProximityViolation
  const onProximityViolationRef = useRef(onProximityViolation)
  useEffect(() => {
    onProximityViolationRef.current = onProximityViolation
  }, [onProximityViolation])
  const onOverlapViolation = options.onOverlapViolation
  const onOverlapViolationRef = useRef(onOverlapViolation)
  useEffect(() => {
    onOverlapViolationRef.current = onOverlapViolation
  }, [onOverlapViolation])
  const onDrawPlacementRejected = options.onDrawPlacementRejected
  const onDrawPlacementRejectedRef = useRef(onDrawPlacementRejected)
  useEffect(() => {
    onDrawPlacementRejectedRef.current = onDrawPlacementRejected
  }, [onDrawPlacementRejected])
  const onLayoutCommit = options.onLayoutCommit
  const onLayoutCommitRef = useRef(onLayoutCommit)
  useEffect(() => {
    onLayoutCommitRef.current = onLayoutCommit
  }, [onLayoutCommit])

  // The host re-renders this hook every time the doc changes (because
  // `store.doc` is a different object), but `commitDraft` only fires
  // on a draw release. We refresh refs of the inputs it needs each
  // render so the closure inside `onPointerUp` always sees the latest
  // category list and the current booth distribution.
  const eventCategoryNamesRef = useRef(eventCategoryNames)
  useEffect(() => {
    eventCategoryNamesRef.current = eventCategoryNames
  }, [eventCategoryNames])
  const defaultBoothTableSpecRef = useRef(options.defaultBoothTableSpec)
  const defaultBoothTableSpecSourceRef =
    options.defaultBoothTableSpecRef ?? defaultBoothTableSpecRef
  if (!options.defaultBoothTableSpecRef) {
    defaultBoothTableSpecRef.current = options.defaultBoothTableSpec
  }

  const readDefaultBoothTableSpec = useCallback((): TableSizeSpec | undefined => {
    return defaultBoothTableSpecSourceRef.current
  }, [defaultBoothTableSpecSourceRef])

  const [draft, setDraftState] = useState<DrawDraft>(null)
  // Gesture lifecycle reads the ref so pointerup always sees the draft
  // started on pointerdown — same pattern as toolStateRef / panActiveRef.
  const draftRef = useRef<DrawDraft>(null)
  const setDraft = useCallback((next: DrawDraft) => {
    draftRef.current = next
    setDraftState(next)
  }, [])
  const [placementHover, setPlacementHoverState] = useState<{
    rect: Rect
    kind: PlacedObject['kind']
    rotation: number
  } | null>(null)
  const setPlacementHover = useCallback(
    (
      next: {
        rect: Rect
        kind: PlacedObject['kind']
        rotation: number
      } | null
    ) => {
      setPlacementHoverState(next)
    },
    []
  )
  useEffect(() => {
    if (toolState.tool !== 'draw') {
      setPlacementHover(null)
    }
  }, [toolState.tool, setPlacementHover])
  const dragRef = useRef<DragState>(null)
  const [marquee, setMarquee] = useState<MarqueeState>(null)
  const rotateRef = useRef<RotateState>(null)
  const [rotating, setRotating] = useState(false)
  const [roomGestureActive, setRoomGestureActive] = useState(false)
  const [roomVertexDragActive, setRoomVertexDragActive] = useState(false)
  const roomDragRef = useRef<RoomDragState>(null)
  const roomResizeRef = useRef<RoomResizeState>(null)
  const roomVertexDragRef = useRef<RoomVertexDragState>(null)
  const [roomEdgeHover, setRoomEdgeHover] = useState<{
    roomId: string
    edgeIndex: number
  } | null>(null)
  const [roomVertexHover, setRoomVertexHover] = useState<number | null>(null)
  const objectResizeRef = useRef<ObjectResizeState>(null)
  const [objectGestureActive, setObjectGestureActive] = useState(false)
  const [boothLayoutGestureActive, setBoothLayoutGestureActive] = useState(false)
  const [emptyCanvasHover, setEmptyCanvasHover] = useState(false)
  const onRoomCanvasLimitBlockedRef = useRef(
    options.onRoomCanvasLimitBlocked
  )
  useEffect(() => {
    onRoomCanvasLimitBlockedRef.current = options.onRoomCanvasLimitBlocked
  }, [options.onRoomCanvasLimitBlocked])
  const activeRoomIdRef = useRef(options.activeRoomId ?? null)
  useEffect(() => {
    activeRoomIdRef.current = options.activeRoomId ?? null
  }, [options.activeRoomId])
  const onRoomFrameClickRef = useRef(options.onRoomFrameClick)
  useEffect(() => {
    onRoomFrameClickRef.current = options.onRoomFrameClick
  }, [options.onRoomFrameClick])
  const onRoomGeometryCommitRef = useRef(options.onRoomGeometryCommit)
  useEffect(() => {
    onRoomGeometryCommitRef.current = options.onRoomGeometryCommit
  }, [options.onRoomGeometryCommit])
  const selectedRoomIdRef = useRef(options.selectedRoomId ?? null)
  useEffect(() => {
    selectedRoomIdRef.current = options.selectedRoomId ?? null
  }, [options.selectedRoomId])

  const pxPerFt = transform.basePxPerFt * transform.zoom

  const edgeHitToleranceFt = useCallback((): number => {
    if (pxPerFt <= 0) return 0.75
    return Math.max(0.5, 8 / pxPerFt)
  }, [pxPerFt])

  const vertexHitToleranceFt = useCallback((): number => {
    if (pxPerFt <= 0) return 0.6
    return Math.max(0.4, 6 / pxPerFt)
  }, [pxPerFt])

  /**
   * Pointermove can fire at the device's native rate (often 120 Hz on
   * recent iPhones, even higher on Pro models). Each move triggers a
   * `store.updateObjects` and a React render; running that 120+ times
   * per second on a phone is the easiest way to drop frames.
   *
   * We coalesce by stashing the latest move in a ref and applying it
   * inside a rAF tick. Drags and rotates feel buttery instead of
   * step-per-event-ish — the user sees one render per paint.
   */
  type CoalescedMove = {
    ft: Point
    pointerId: number
    shiftKey: boolean
    metaKey: boolean
    ctrlKey: boolean
  }
  const pendingMoveRef = useRef<CoalescedMove | null>(null)
  const moveRafRef = useRef<number | null>(null)

  // Mirror panActive so the rAF callback can bail if a pinch / mouse-
  // pan begins while we're mid-drag — pan should always win.
  const panActiveRef = useRef(panActive)
  useEffect(() => {
    panActiveRef.current = panActive
  }, [panActive])

  /** Tracks Shift held during drag when pointer events omit modifier state. */
  const shiftHeldRef = useRef(false)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = false
    }
    const onBlur = () => {
      shiftHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const toolStateRef = useRef(toolState)
  useEffect(() => {
    toolStateRef.current = toolState
  }, [toolState])

  const ftAt = useCallback(
    (clientX: number, clientY: number): Point => {
      const surface = surfaceRef.current
      const scroll = scrollRef.current
      if (!surface || !scroll) return { x: 0, y: 0 }
      const clipEl = clipViewportRef?.current
      const rect = (clipEl ?? surface).getBoundingClientRect()
      // The SVG element renders at the scaled (zoomed) size already. Its
      // client rect is the viewport position; client coords minus that
      // origin gives us a position inside the surface in pixels.
      const px = clientX - rect.left
      const py = clientY - rect.top
      const ratio = transform.basePxPerFt * transform.zoom
      if (ratio === 0) return { x: 0, y: 0 }
      return {
        x: px / ratio + (transform.surfaceOriginFtX ?? 0),
        y: py / ratio + (transform.surfaceOriginFtY ?? 0),
      }
    },
    [
      clipViewportRef,
      scrollRef,
      surfaceRef,
      transform.basePxPerFt,
      transform.surfaceOriginFtX,
      transform.surfaceOriginFtY,
      transform.zoom,
    ]
  )

  const beginDrag = useCallback(
    (pointerId: number, originFt: Point, ids: string[]) => {
      const originals = new Map<string, { x: number; y: number }>()
      for (const obj of store.doc.objects) {
        if (ids.includes(obj.id)) {
          originals.set(obj.id, { x: obj.x, y: obj.y })
        }
      }
      dragRef.current = {
        pointerId,
        ids,
        origin: originFt,
        lastFt: originFt,
        moved: false,
        originals,
      }
      rotateRef.current = null
    },
    [store.doc]
  )

  const capturePointer = useCallback(
    (target: SVGSVGElement, pointerId: number) => {
      // setPointerCapture throws "InvalidPointerId" on synthesized
      // pointers (Playwright, our browser tests). Real pointer
      // capture isn't strictly required for correct behaviour because
      // pointer events still bubble to the captured root, so swallow
      // the throw rather than crashing the gesture.
      try {
        target.setPointerCapture(pointerId)
      } catch {
        // ignore
      }
    },
    []
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): boolean => {
      if (panActiveRef.current) return false
      // Only react to primary mouse / pen / touch.
      if (e.button !== 0 && e.pointerType === 'mouse') return false

      const ft = ftAt(e.clientX, e.clientY)
      const activeTool = toolStateRef.current
      const target = e.target as Element | null
      const allowObjectGestures = activeTool.tool === 'select'
      const allowRoomGestures =
        activeTool.tool === 'select' || activeTool.tool === 'hand'

      if (activeTool.tool === 'draw') {
        const drawHitId =
          target?.closest('[data-object-id]')?.getAttribute('data-object-id') ??
          hitTest(store.doc.objects, ft)?.id ??
          null
        if (drawHitId) {
          const additive = e.shiftKey || e.metaKey || e.ctrlKey
          const wasSelected = store.selectedIds.has(drawHitId)
          if (additive) {
            store.toggleSelection(drawHitId)
          } else if (!wasSelected) {
            store.setSelection([drawHitId])
          }
          capturePointer(e.currentTarget, e.pointerId)
          const targetIds = wasSelected || additive
            ? Array.from(new Set([...store.selectedIds, drawHitId]))
            : [drawHitId]
          const dragIds = targetIds.filter((id) => {
            const obj = store.doc.objects.find((o) => o.id === id)
            return obj && !obj.locked
          })
          if (dragIds.length > 0) {
            beginDrag(e.pointerId, ft, dragIds)
          }
          return true
        }
        capturePointer(e.currentTarget, e.pointerId)
        const snapped = snapPoint(ft, store.doc.snapFt)
        setDraft({
          anchor: snapped,
          current: snapped,
          kind: activeTool.drawShape,
          ...(activeTool.drawShape === 'amenity' && activeTool.amenityType
            ? { amenityType: activeTool.amenityType }
            : {}),
        })
        return true
      }

      const objectResizeEl = target?.closest('[data-object-resize-handle]')
      if (objectResizeEl && allowObjectGestures) {
        const objectId = objectResizeEl.getAttribute('data-object-id')
        const handle = objectResizeEl.getAttribute(
          'data-object-resize-handle'
        ) as ObjectResizeHandle | null
        const obj =
          objectId && store.doc.objects.find((o) => o.id === objectId)
        if (objectId && handle && obj && !obj.locked) {
          capturePointer(e.currentTarget, e.pointerId)
          if (!store.selectedIds.has(objectId)) {
            store.setSelection([objectId])
          }
          setObjectGestureActive(true)
          objectResizeRef.current = {
            pointerId: e.pointerId,
            objectId,
            handle,
            initial: { ...obj },
            moved: false,
          }
          return true
        }
      }

      const resizeHandleEl = target?.closest('[data-room-resize-handle]')
      if (resizeHandleEl && allowRoomGestures) {
        const roomId = resizeHandleEl.getAttribute('data-room-id')
        const handle = resizeHandleEl.getAttribute(
          'data-room-resize-handle'
        ) as RoomResizeHandle | null
        const frame = (store.doc.rooms ?? []).find((f) => f.id === roomId)
        if (roomId && handle && frame) {
          capturePointer(e.currentTarget, e.pointerId)
          store.clearSelection()
          onRoomFrameClickRef.current?.(roomId)
          setRoomGestureActive(true)
          roomResizeRef.current = {
            pointerId: e.pointerId,
            roomId,
            handle,
            initialFrame: { ...frame },
            anchor: ft,
            moved: false,
            limitNotified: false,
          }
          return true
        }
      }

      const vertexHandleEl = target?.closest('[data-room-vertex-index]')
      if (vertexHandleEl && allowRoomGestures && activeTool.tool === 'select') {
        const roomId = vertexHandleEl.getAttribute('data-room-id')
        const indexRaw = vertexHandleEl.getAttribute('data-room-vertex-index')
        const vertexIndex = indexRaw != null ? Number(indexRaw) : NaN
        const frame = (store.doc.rooms ?? []).find((f) => f.id === roomId)
        if (
          roomId &&
          frame &&
          !frame.mergedIntoObjectId &&
          !frame.joinGroupId &&
          Number.isFinite(vertexIndex)
        ) {
          capturePointer(e.currentTarget, e.pointerId)
          store.clearSelection()
          onRoomFrameClickRef.current?.(roomId)
          setRoomGestureActive(true)
          setRoomVertexDragActive(true)
          roomVertexDragRef.current = {
            pointerId: e.pointerId,
            roomId,
            vertexIndex,
            initialRing: editableRingForFrame(frame),
            moved: false,
          }
          return true
        }
      }

      // Rotate handle takes priority over the underlying object hit-
      // test. The handle carries `data-rotate-handle="true"` and
      // `data-object-id` so we can pick up the right object without
      // walking the doc.
      const rotateHandle = target?.closest('[data-rotate-handle="true"]')
      if (rotateHandle) {
        if (!allowObjectGestures) {
          capturePointer(e.currentTarget, e.pointerId)
          return true
        }
        const handleObjectId = rotateHandle.getAttribute('data-object-id')
        const anchorObj =
          handleObjectId &&
          store.doc.objects.find((o) => o.id === handleObjectId)
        if (anchorObj) {
          capturePointer(e.currentTarget, e.pointerId)
          const anchorCenter = objectCenter(anchorObj)
          // If the handle's owner is part of a multi-selection, rotate
          // every selected (unlocked) object as a group; each pivots
          // around its own center so the cluster stays in place. If
          // the handle's owner isn't in the current selection (rare —
          // only selected items render handles), fall back to a single-
          // object rotate against just the anchor.
          const ownerSelected = store.selectedIds.has(anchorObj.id)
          const targetIds = ownerSelected
            ? Array.from(store.selectedIds)
            : [anchorObj.id]
          const idSet = new Set(targetIds)
          const affected = store.doc.objects
            .filter((o) => idSet.has(o.id) && !o.locked)
            .map((o) => ({
              id: o.id,
              initialRotation: o.rotation || 0,
              initialX: o.x,
              initialY: o.y,
            }))
          // If the only candidate (the anchor itself) is locked we
          // bail entirely — nothing to rotate.
          if (affected.length === 0) return true
          dragRef.current = null
          rotateRef.current = {
            pointerId: e.pointerId,
            anchorId: anchorObj.id,
            anchorCenterFt: anchorCenter,
            anchorInitialAngleDeg: angleDegFromCenter(anchorCenter, ft),
            affected,
          }
          setRotating(true)
          return true
        }
        capturePointer(e.currentTarget, e.pointerId)
        return true
      }

      // Placed objects win over empty room interior — otherwise every
      // booth click inside a room starts a macro room drag instead of
      // selecting or moving the booth.
      const objectId = allowObjectGestures
        ? (target?.closest('[data-object-id]')?.getAttribute('data-object-id') ??
            hitTest(store.doc.objects, ft)?.id ??
            null)
        : null
      if (objectId) {
        const additive = e.shiftKey || e.metaKey || e.ctrlKey
        const wasSelected = store.selectedIds.has(objectId)
        if (additive) {
          store.toggleSelection(objectId)
        } else if (!wasSelected) {
          store.setSelection([objectId])
        }
        const targetIds = wasSelected || additive
          ? Array.from(new Set([...store.selectedIds, objectId]))
          : [objectId]
        const dragIds = targetIds.filter((id) => {
          const obj = store.doc.objects.find((o) => o.id === id)
          return obj && !obj.locked
        })
        capturePointer(e.currentTarget, e.pointerId)
        if (dragIds.length > 0) {
          beginDrag(e.pointerId, ft, dragIds)
        }
        return true
      }

      // Room perimeter stroke — or empty interior for hand tool only.
      // Select tool uses empty interior for marquee multi-select (Figma-style).
      if (allowRoomGestures) {
        const roomStroke = target?.closest('[data-room-stroke="true"]')
        let roomId = roomStroke?.getAttribute('data-room-id') ?? null

        if (activeTool.tool === 'select') {
          if (!roomId) {
            // Fall through to marquee below.
          } else {
            const frames = store.doc.rooms ?? []
            const resolvedFrame = frames.find((f) => f.id === roomId)
            if (!resolvedFrame) {
              const viaMerge = frames.find((f) => f.mergedIntoObjectId === roomId)
              if (viaMerge) roomId = viaMerge.id
            }
            const additive = e.shiftKey || e.metaKey || e.ctrlKey
            store.clearSelection()
            onRoomFrameClickRef.current?.(roomId, { additive })
            if (additive) {
              return true
            }
            capturePointer(e.currentTarget, e.pointerId)
            setRoomGestureActive(true)
            roomDragRef.current = {
              pointerId: e.pointerId,
              roomId,
              origin: ft,
              lastDx: 0,
              lastDy: 0,
              moved: false,
              limitNotified: false,
            }
            return true
          }
        } else {
          if (activeTool.tool === 'hand') {
            const objectUnderPointer =
              target?.closest('[data-object-id]')?.getAttribute('data-object-id') ??
              hitTest(store.doc.objects, ft)?.id ??
              null
            if (objectUnderPointer) return false
          }
          if (!roomId) {
            const frames = store.doc.rooms ?? []
            const activeId = activeRoomIdRef.current
            const activeFrame = activeId
              ? frames.find((f) => f.id === activeId)
              : null
            if (
              activeFrame &&
              !activeFrame.mergedIntoObjectId &&
              (pointInsideRoomPlacement(activeFrame, ft, store.doc, activeFrame.id) ||
                hitTestRoomStroke(frames, ft, 0.75) === activeFrame.id)
            ) {
              roomId = activeFrame.id
            } else {
              roomId = hitTestRoomStroke(frames, ft, 0.75)
              if (!roomId) {
                for (let i = frames.length - 1; i >= 0; i--) {
                  const f = frames[i]!
                  if (f.mergedIntoObjectId) continue
                  if (pointInsideRoomPlacement(f, ft, store.doc, f.id)) {
                    roomId = f.id
                    break
                  }
                }
              }
            }
          }
          if (roomId) {
            const frames = store.doc.rooms ?? []
            const resolvedFrame = frames.find((f) => f.id === roomId)
            if (!resolvedFrame) {
              const viaMerge = frames.find((f) => f.mergedIntoObjectId === roomId)
              if (viaMerge) roomId = viaMerge.id
            }
            const additive = e.shiftKey || e.metaKey || e.ctrlKey
            store.clearSelection()
            onRoomFrameClickRef.current?.(roomId, { additive })
            if (additive) {
              return true
            }
            capturePointer(e.currentTarget, e.pointerId)
            setRoomGestureActive(true)
            roomDragRef.current = {
              pointerId: e.pointerId,
              roomId,
              origin: ft,
              lastDx: 0,
              lastDy: 0,
              moved: false,
              limitNotified: false,
            }
            return true
          }
        }
      }

      if (!allowObjectGestures) return false

      // Empty canvas in select mode → marquee.
      capturePointer(e.currentTarget, e.pointerId)
      if (!(e.shiftKey || e.metaKey || e.ctrlKey)) {
        store.clearSelection()
      }
      setMarquee({ pointerId: e.pointerId, anchor: ft, current: ft })
      return true
    },
    [beginDrag, capturePointer, ftAt, store]
  )

  /**
   * Apply a coalesced move to whichever gesture is currently active
   * (rotate / draft / drag / marquee / room-drag). Called from a
   * rAF tick so we never run more than once per paint, even on
   * 120 Hz touch devices.
   */
  const flushMove = useCallback(
    (move: CoalescedMove) => {
      if (panActiveRef.current) return
      const drag = dragRef.current
      const rotate = rotateRef.current
      const roomDrag = roomDragRef.current
      const roomResize = roomResizeRef.current
      const roomVertexDrag = roomVertexDragRef.current
      const objectResize = objectResizeRef.current
      const { ft, pointerId, shiftKey, metaKey, ctrlKey } = move

      if (roomVertexDrag && roomVertexDrag.pointerId === pointerId) {
        const frame = (store.doc.rooms ?? []).find(
          (f) => f.id === roomVertexDrag.roomId
        )
        if (!frame) return
        const currentRing = editableRingForFrame(frame)
        const candidate = shiftKey
          ? { x: ft.x, y: ft.y }
          : snapPoint(ft, store.doc.snapFt)
        const trialRing = moveVertex(currentRing, roomVertexDrag.vertexIndex, candidate)
        const ok = store.updateRoomPerimeter(roomVertexDrag.roomId, trialRing, {
          pushHistory: !roomVertexDrag.moved,
        })
        if (ok) {
          const wasMoved = roomVertexDrag.moved
          const isMovedNow =
            wasMoved ||
            candidate.x !==
              roomVertexDrag.initialRing[roomVertexDrag.vertexIndex]?.[0] ||
            candidate.y !==
              roomVertexDrag.initialRing[roomVertexDrag.vertexIndex]?.[1]
          roomVertexDragRef.current = {
            ...roomVertexDrag,
            moved: isMovedNow,
          }
        }
        return
      }

      if (objectResize && objectResize.pointerId === pointerId) {
        const localPointer = pointerInObjectSpace(objectResize.initial, ft)
        const geom = objectResizeFromHandle(
          objectResize.initial,
          objectResize.handle,
          localPointer,
          store.doc.snapFt
        )
        const patch = patchForObjectResize(objectResize.initial, geom)
        const objNow = store.doc.objects.find(
          (o) => o.id === objectResize.objectId
        )
        if (!objNow) return
        const probe = { ...objNow, ...patch } as PlacedObject
        const cw = store.doc.canvasWidthFt
        const cl = store.doc.canvasLengthFt
        const clampDelta = canvasClampDelta(probe, cw, cl)
        const clamped = {
          ...patch,
          x: (patch.x ?? objNow.x) + clampDelta.dx,
          y: (patch.y ?? objNow.y) + clampDelta.dy,
        }
        const wasMoved = objectResize.moved
        const isMovedNow =
          wasMoved ||
          clamped.x !== objectResize.initial.x ||
          clamped.y !== objectResize.initial.y ||
          clamped.width !== objectResize.initial.width ||
          clamped.height !== objectResize.initial.height
        store.updateObject(objectResize.objectId, clamped, {
          pushHistory: false,
        })
        objectResizeRef.current = {
          ...objectResize,
          moved: isMovedNow,
        }
        return
      }

      if (roomResize && roomResize.pointerId === pointerId) {
        const motionScale = roomDragMotionScale(
          transform.zoom,
          commandCenterViewport
        )
        const scaledFt = scalePointFromAnchor(
          roomResize.anchor,
          ft,
          motionScale
        )
        const patch = roomResizeFromHandle(
          roomResize.initialFrame,
          roomResize.handle,
          scaledFt,
          roomResize.anchor
        )
        const wasMoved = roomResize.moved
        const isMovedNow =
          wasMoved ||
          patch.widthFt !== roomResize.initialFrame.widthFt ||
          patch.lengthFt !== roomResize.initialFrame.lengthFt ||
          patch.originX !== roomResize.initialFrame.originX ||
          patch.originY !== roomResize.initialFrame.originY
        const ok = store.resizeRoomFrame(roomResize.roomId, patch, {
          pushHistory: !wasMoved,
        })
        let limitNotified = roomResize.limitNotified
        if (!ok && !limitNotified) {
          onRoomCanvasLimitBlockedRef.current?.()
          limitNotified = true
        }
        roomResizeRef.current = {
          ...roomResize,
          moved: isMovedNow,
          limitNotified,
        }
        return
      }

      if (roomDrag && roomDrag.pointerId === pointerId) {
        const motionScale = roomDragMotionScale(
          transform.zoom,
          commandCenterViewport
        )
        const snap = roomDragSnapFt(store.doc.snapFt, commandCenterViewport)
        const rawDx = (ft.x - roomDrag.origin.x) * motionScale
        const rawDy = (ft.y - roomDrag.origin.y) * motionScale
        const dxTotal = snap > 0 ? Math.round(rawDx / snap) * snap : rawDx
        const dyTotal = snap > 0 ? Math.round(rawDy / snap) * snap : rawDy
        const stepDx = dxTotal - roomDrag.lastDx
        const stepDy = dyTotal - roomDrag.lastDy
        const wasMoved = roomDrag.moved
        const isMovedNow =
          wasMoved || Math.abs(rawDx) > 0.05 || Math.abs(rawDy) > 0.05
        let limitNotified = roomDrag.limitNotified
        if (stepDx !== 0 || stepDy !== 0) {
          const ok = store.moveRoomFrame(roomDrag.roomId, stepDx, stepDy, {
            pushHistory: !wasMoved,
          })
          if (!ok && !limitNotified) {
            onRoomCanvasLimitBlockedRef.current?.()
            limitNotified = true
          }
        }
        roomDragRef.current = {
          ...roomDrag,
          lastDx: dxTotal,
          lastDy: dyTotal,
          moved: isMovedNow,
          limitNotified,
        }
        return
      }

      if (rotate && rotate.pointerId === pointerId) {
        const angleNow = angleDegFromCenter(rotate.anchorCenterFt, ft)
        let deltaDeg = angleNow - rotate.anchorInitialAngleDeg
        if (!shiftKey) {
          // Default: snap to ROTATE_SNAP_DEG (15°). Shift = freeform.
          deltaDeg = Math.round(deltaDeg / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG
        }
        const cw = store.doc.canvasWidthFt
        const cl = store.doc.canvasLengthFt
        const objById = new Map(store.doc.objects.map((o) => [o.id, o]))

        // Build the proposed rotated layout from each object's *initial*
        // (pre-gesture) position so the clamp measures the new orientation
        // freshly each frame instead of accumulating round-off drift.
        type Plan = {
          id: string
          nextRotation: number
          baseX: number
          baseY: number
          probe: PlacedObject
        }
        const plans: Plan[] = []
        for (const a of rotate.affected) {
          const obj = objById.get(a.id)
          if (!obj) continue
          const nextRotation = normalizeDegrees(a.initialRotation + deltaDeg)
          const probe: PlacedObject = {
            ...obj,
            rotation: nextRotation,
            x: a.initialX,
            y: a.initialY,
          }
          plans.push({
            id: a.id,
            nextRotation,
            baseX: a.initialX,
            baseY: a.initialY,
            probe,
          })
        }
        if (plans.length === 0) return

        // Containment: prefer a single uniform translation that pulls the
        // group's union AABB back inside the canvas (so a tilted row stays
        // flush against the wall). When the cluster is itself larger than
        // the canvas after rotating, fall back to clamping each object
        // independently so nothing leaks out, even at the cost of warping
        // relative geometry slightly.
        const probes = plans.map((p) => p.probe)
        const unionDelta = groupCanvasClampDelta(probes, cw, cl)
        type PatchEntry = {
          id: string
          patch: Partial<PlacedObject>
          finalProbe: PlacedObject
        }
        const entries: PatchEntry[] = []
        if (unionDelta) {
          for (const p of plans) {
            const nx = p.baseX + unionDelta.dx
            const ny = p.baseY + unionDelta.dy
            entries.push({
              id: p.id,
              patch: { rotation: p.nextRotation, x: nx, y: ny },
              finalProbe: { ...p.probe, x: nx, y: ny },
            })
          }
        } else {
          for (const p of plans) {
            const { dx, dy } = canvasClampDelta(p.probe, cw, cl)
            const nx = p.baseX + dx
            const ny = p.baseY + dy
            entries.push({
              id: p.id,
              patch: { rotation: p.nextRotation, x: nx, y: ny },
              finalProbe: { ...p.probe, x: nx, y: ny },
            })
          }
        }
        // Final boundary halt: if even the clamped probes still poke
        // off the canvas (an object whose rotated AABB is wider/taller
        // than the room), freeze the rotation gesture this frame.
        // The last accepted angle stays committed; the user backs off
        // and rotation resumes when the angle returns to a fitting
        // range.
        for (const entry of entries) {
          const aabb = rotatedAabb(entry.finalProbe)
          if (!aabbFitsCanvas(aabb, cw, cl)) {
            return
          }
        }
        if (entries.length > 0) {
          store.updateObjects(
            entries.map((e) => ({ id: e.id, patch: e.patch })),
            { pushHistory: false }
          )
        }
        return
      }

      const activeDraft = draftRef.current
      if (activeDraft) {
        const snapped = snapPoint(ft, store.doc.snapFt)
        setDraft({
          anchor: activeDraft.anchor,
          current: snapped,
          kind: activeDraft.kind,
        })
        return
      }

      if (drag && drag.pointerId === pointerId) {
        const dx = ft.x - drag.origin.x
        const dy = ft.y - drag.origin.y
        const moved =
          drag.moved || Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05
        dragRef.current = { ...drag, lastFt: ft, moved }
        if (!moved) return
        setBoothLayoutGestureActive(true)
        const patches: Array<{
          id: string
          patch: Partial<PlacedObject>
        }> = []
        const snapFt = resolveBoothMoveSnapFt({
          shiftKey,
          shiftHeld: shiftHeldRef.current,
          docSnapFt: store.doc.snapFt,
        })
        const objectRoom = store.doc.objectRoom ?? {}
        const objById = new Map(store.doc.objects.map((o) => [o.id, o]))
        for (const id of drag.ids) {
          const orig = drag.originals.get(id)
          if (!orig) continue
          const obj = objById.get(id)
          if (!obj) continue
          const patch = isStructuralWallSnapKind(obj.kind)
            ? structuralLayoutMovePatch(
                obj,
                orig,
                dx,
                dy,
                store.doc,
                objectRoom[id] ?? activeRoomIdRef.current ?? null,
                snapFt
              )
            : boothLayoutMovePatch(obj, orig, dx, dy, store.doc, {
                snapFt,
                activeRoomId: objectRoom[id] ?? activeRoomIdRef.current ?? null,
              })
          patches.push({
            id,
            patch,
          })
        }
        // Don't push a history entry on every frame. We'll push one at
        // pointerup if `moved` is true.
        store.updateObjects(patches, { pushHistory: false })
        return
      }

      const marqueeNow = marquee
      if (marqueeNow && marqueeNow.pointerId === pointerId) {
        // Mark unused-modifier vars so eslint doesn't trip — they're
        // captured in the coalesced move but only matter on rotate.
        void metaKey
        void ctrlKey
        setMarquee({ ...marqueeNow, current: ft })
        return
      }

      const activeTool = toolStateRef.current
      const isTableDrawPreview =
        activeTool.tool === 'draw' && activeTool.drawShape === 'booth'
      const isStructuralDrawPreview =
        activeTool.tool === 'draw' &&
        isStructuralWallSnapKind(activeTool.drawShape)
      if (stickyDrawPlacementRef.current || isTableDrawPreview || isStructuralDrawPreview) {
        const gestureActive =
          draftRef.current ||
          dragRef.current ||
          rotateRef.current ||
          roomDragRef.current ||
          roomResizeRef.current ||
          roomVertexDragRef.current ||
          objectResizeRef.current ||
          marqueeNow
        if (activeTool.tool === 'draw' && !gestureActive) {
          const snapped = snapPoint(ft, store.doc.snapFt)
          const rawRect = {
            x: snapped.x,
            y: snapped.y,
            width: 0,
            height: 0,
          }
          const rect = resolveDrawCommitRect(
            activeTool.drawShape,
            rawRect,
            store.doc.snapFt,
            readDefaultBoothTableSpec()
          )
          const preview = resolveTablePlacementPreview(
            activeTool.drawShape,
            rect,
            readDefaultBoothTableSpec(),
            store.doc,
            activeRoomIdRef.current
          )
          if (preview) {
            startTransition(() => {
              setPlacementHover({
                rect: {
                  x: preview.x,
                  y: preview.y,
                  width: preview.width,
                  height: preview.height,
                },
                kind: activeTool.drawShape,
                rotation: preview.rotation,
              })
            })
            return
          }
          startTransition(() => {
            setPlacementHover({ rect, kind: activeTool.drawShape, rotation: 0 })
          })
          return
        }
        startTransition(() => {
          setPlacementHover(null)
        })
      }

      if (activeTool.tool === 'select') {
        const interactionRoomId =
          selectedRoomIdRef.current ?? activeRoomIdRef.current
        const frame =
          interactionRoomId &&
          (store.doc.rooms ?? []).find((f) => f.id === interactionRoomId)
        if (
          frame &&
          !frame.mergedIntoObjectId &&
          !frame.joinGroupId &&
          !draftRef.current &&
          !dragRef.current &&
          !rotateRef.current &&
          !roomDragRef.current &&
          !roomResizeRef.current &&
          !roomVertexDragRef.current &&
          !objectResizeRef.current &&
          !marqueeNow
        ) {
          const ring = editableRingForFrame(frame)
          const edgeTol = edgeHitToleranceFt()
          const vertTol = vertexHitToleranceFt()
          const vertHit = nearestVertexHit(ft, ring, vertTol)
          if (vertHit != null) {
            startTransition(() => {
              setRoomVertexHover(vertHit)
              setRoomEdgeHover(null)
              setEmptyCanvasHover(false)
            })
            return
          }
          const edgeHit = nearestEdgeHit(ft, ring, edgeTol)
          if (edgeHit) {
            startTransition(() => {
              setRoomEdgeHover({
                roomId: frame.id,
                edgeIndex: edgeHit.edgeIndex,
              })
              setRoomVertexHover(null)
              setEmptyCanvasHover(false)
            })
            return
          }
        }
        startTransition(() => {
          setRoomEdgeHover(null)
          setRoomVertexHover(null)
          const objectHit =
            hitTest(store.doc.objects, ft)?.id ??
            null
          setEmptyCanvasHover(objectHit == null)
        })
      } else {
        startTransition(() => {
          setEmptyCanvasHover(false)
        })
      }
    },
    [
      commandCenterViewport,
      edgeHitToleranceFt,
      marquee,
      readDefaultBoothTableSpec,
      setDraft,
      setPlacementHover,
      store,
      transform.zoom,
      vertexHitToleranceFt,
    ]
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (panActiveRef.current) return
      // Stash the latest pointer position. Modifier keys are captured
      // here because React event objects are technically still safe
      // post-handler in React 19, but keeping a plain snapshot is
      // cheaper and bullet-proof against any future pooling regressions.
      pendingMoveRef.current = {
        ft: ftAt(e.clientX, e.clientY),
        pointerId: e.pointerId,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
      }
      if (moveRafRef.current !== null) return
      moveRafRef.current = requestAnimationFrame(() => {
        moveRafRef.current = null
        const pending = pendingMoveRef.current
        if (!pending) return
        pendingMoveRef.current = null
        flushMove(pending)
      })
    },
    [flushMove, ftAt]
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      // Flush any pending coalesced move before we tear down state, so
      // the final pointer position is committed before history is
      // snapshotted on the gesture-specific branches below.
      if (moveRafRef.current !== null) {
        cancelAnimationFrame(moveRafRef.current)
        moveRafRef.current = null
      }
      const pending = pendingMoveRef.current
      pendingMoveRef.current = null
      if (pending && pending.pointerId === e.pointerId) {
        flushMove(pending)
      }

      const objectResize = objectResizeRef.current
      if (objectResize && objectResize.pointerId === e.pointerId) {
        if (objectResize.moved) {
          const obj = store.doc.objects.find(
            (o) => o.id === objectResize.objectId
          )
          if (obj) {
            store.updateObject(
              objectResize.objectId,
              {
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
                ...(obj.kind === 'booth'
                  ? {
                      tableLengthFt: (obj as BoothObject).tableLengthFt,
                      tableShape: (obj as BoothObject).tableShape,
                      tablePurpose: (obj as BoothObject).tablePurpose,
                    }
                  : {}),
              },
              { pushHistory: true }
            )
            onLayoutCommitRef.current?.()
          }
        }
        objectResizeRef.current = null
        setObjectGestureActive(false)
        return
      }

      const roomResize = roomResizeRef.current
      if (roomResize && roomResize.pointerId === e.pointerId) {
        if (roomResize.moved) {
          onRoomGeometryCommitRef.current?.()
          onLayoutCommitRef.current?.()
        }
        roomResizeRef.current = null
        setRoomGestureActive(false)
        return
      }

      const roomVertexDrag = roomVertexDragRef.current
      if (roomVertexDrag && roomVertexDrag.pointerId === e.pointerId) {
        if (roomVertexDrag.moved) {
          onRoomGeometryCommitRef.current?.()
          onLayoutCommitRef.current?.()
        }
        roomVertexDragRef.current = null
        setRoomGestureActive(false)
        setRoomVertexDragActive(false)
        return
      }

      const roomDrag = roomDragRef.current
      if (roomDrag && roomDrag.pointerId === e.pointerId) {
        // Clamp the room frame back to non-negative origin so the
        // unified canvas always anchors at (0, 0). If the user
        // dragged it past the left/top edge we silently bring it
        // back without spawning another history entry — the first
        // mid-drag commit already pushed the pre-gesture state.
        const frame = (store.doc.rooms ?? []).find(
          (r) => r.id === roomDrag.roomId
        )
        let cleanupDx = 0
        let cleanupDy = 0
        if (frame) {
          if (frame.originX < 0) cleanupDx = -frame.originX
          if (frame.originY < 0) cleanupDy = -frame.originY
        }
        if (cleanupDx !== 0 || cleanupDy !== 0) {
          store.moveRoomFrame(roomDrag.roomId, cleanupDx, cleanupDy, {
            pushHistory: false,
          })
        }
        if (roomDrag.moved) {
          onRoomGeometryCommitRef.current?.()
        }
        roomDragRef.current = null
        setRoomGestureActive(false)
        return
      }

      const rotate = rotateRef.current
      if (rotate && rotate.pointerId === e.pointerId) {
        // Snapshot every affected object once at gesture end so the
        // entire group rotation is one undo step. We've been mutating
        // without history during the move; commit one frame's worth
        // of patches with pushHistory:true here.
        const objById = new Map(store.doc.objects.map((o) => [o.id, o]))
        const finalPatches: Array<{
          id: string
          patch: Partial<PlacedObject>
        }> = []
        let anyChanged = false
        for (const a of rotate.affected) {
          const obj = objById.get(a.id)
          if (!obj) continue
          if (
            (obj.rotation || 0) !== a.initialRotation ||
            obj.x !== a.initialX ||
            obj.y !== a.initialY
          ) {
            anyChanged = true
          }
          finalPatches.push({
            id: a.id,
            patch: { rotation: obj.rotation, x: obj.x, y: obj.y },
          })
        }
        if (anyChanged && finalPatches.length > 0) {
          store.updateObjects(finalPatches, { pushHistory: true })
        }
        rotateRef.current = null
        setRotating(false)
        return
      }

      const activeDraft = draftRef.current
      if (activeDraft) {
        const rawRect = normalizeRect(activeDraft.anchor, activeDraft.current)
        const hasDragExtent =
          rawRect.width >= store.doc.snapFt ||
          rawRect.height >= store.doc.snapFt
        // Tap-to-place: the draft preview already shows the resolved
        // booth footprint (table-length pill), but a click has zero
        // freehand extent. Anchor at the snapped pointer so
        // resolveDrawCommitRect can center the real object there.
        let rect = resolveDrawCommitRect(
          activeDraft.kind,
          hasDragExtent
            ? rawRect
            : {
                x: activeDraft.anchor.x,
                y: activeDraft.anchor.y,
                width: 0,
                height: 0,
              },
          store.doc.snapFt,
          readDefaultBoothTableSpec()
        )
        let placementProbe: PlacementProbe = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          rotation: 0,
          kind: activeDraft.kind,
        }
        const drawRoomId = resolvePlacementRoomIdForObject(
          store.doc,
          placementProbe,
          activeRoomIdRef.current
        )
        if (isStructuralWallSnapKind(activeDraft.kind) && drawRoomId) {
          const frame = store.doc.rooms?.find((r) => r.id === drawRoomId)
          if (frame) {
            const local = snapStructuralAssetToLocalPerimeter(
              {
                ...placementProbe,
                x: placementProbe.x - frame.originX,
                y: placementProbe.y - frame.originY,
              },
              frame.widthFt,
              frame.lengthFt
            )
            rect = {
              x: frame.originX + local.x!,
              y: frame.originY + local.y!,
              width: local.width ?? rect.width,
              height: local.height ?? rect.height,
            }
            placementProbe = {
              ...placementProbe,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              rotation: local.rotation ?? 0,
            }
          }
        }
        // Multi-room association: the new object inherits the room
        // whose perimeter contains its centroid (or, failing that,
        // the active room set by the host). This lets a coordinator
        // draw inside any room frame on the unified canvas without
        // first having to flip the active selection.
        const canvasOpenDraw = isCanvasOpenPlacementKind(activeDraft.kind)
        if (
          (!canvasOpenDraw && !drawRoomId) ||
          !isValidObjectPlacement(store.doc, placementProbe, drawRoomId)
        ) {
          addLogRef.current(
            `Placement rejected (draw ${activeDraft.kind}): ${formatPlacementProbe(rect)} room=${drawRoomId ?? 'none'} canvasOpen=${canvasOpenDraw}`
          )
          onOverlapViolationRef.current?.()
          setDraft(null)
          return
        }
        commitDraft(
          store,
          activeDraft.kind,
          rect,
          eventCategoryNamesRef.current,
          drawRoomId,
          onProximityViolationRef.current,
          onOverlapViolationRef.current,
          readDefaultBoothTableSpec(),
          (msg) => addLogRef.current(msg),
          enforceCategorySeparationRef.current,
          activeDraft.amenityType,
          onDrawPlacementRejectedRef.current
        )
        onAfterDrawCommit?.()
        onLayoutCommitRef.current?.()
        setDraft(null)
        return
      }

      const drag = dragRef.current
      if (drag && drag.pointerId === e.pointerId) {
        if (drag.moved) {
          const commitSnapFt = resolveBoothMoveSnapFt({
            shiftKey: e.shiftKey,
            shiftHeld: shiftHeldRef.current,
            docSnapFt: store.doc.snapFt,
          })
          // Same-category proximity gate: when the drag would land
          // any moved booth within `<4 cols AND <2 rows` of another
          // same-category booth, snap the entire move back to its
          // pre-gesture origin. Non-booths and untagged booths skip
          // the gate. Other booths in the move are excluded from the
          // "others" set so a coordinator dragging a same-category
          // pair as a unit isn't blocked by their own neighbour.
          const movedIdSet = new Set(drag.ids)
          const movedResolved = store.doc.objects
            .filter((o) => movedIdSet.has(o.id))
            .map((o) =>
              objectWithPatch(
                o,
                dragCommitPatchForObject(
                  o,
                  store.doc,
                  activeRoomIdRef.current,
                  commitSnapFt
                )
              )
            )

          if (enforceCategorySeparationRef.current) {
            const movedBooths = movedResolved.filter(
              (o): o is BoothObject =>
                o.kind === 'booth' && !isGuestTableBooth(o as BoothObject)
            )
            const others = store.doc.objects.filter((o) => !movedIdSet.has(o.id))
            const violation = findFirstViolationInMove(
              movedBooths,
              others,
              store.doc.gridSpacingFt || 1
            )
            if (violation) {
              const revertPatches: Array<{
                id: string
                patch: Partial<PlacedObject>
              }> = []
              for (const id of drag.ids) {
                const orig = drag.originals.get(id)
                if (orig) {
                  revertPatches.push({
                    id,
                    patch: { x: orig.x, y: orig.y },
                  })
                }
              }
              if (revertPatches.length > 0) {
                store.updateObjects(revertPatches, { pushHistory: false })
              }
              onProximityViolationRef.current?.({
                category: violation.category,
                dxColumns: violation.dxColumns,
                dyRows: violation.dyRows,
              })
              dragRef.current = null
              setBoothLayoutGestureActive(false)
              return
            }
          }

          const finalPatches: Array<{
            id: string
            patch: Partial<PlacedObject>
          }> = []
          let blockedByWall = false
          for (const resolved of movedResolved) {
            const patch = {
              x: resolved.x,
              y: resolved.y,
              width: resolved.width,
              height: resolved.height,
              rotation: resolved.rotation,
            }
            if (
              isCanvasOpenPlacementKind(resolved.kind) &&
              !isValidCanvasOpenPlacement(store.readDoc(), resolved, movedIdSet)
            ) {
              const orig = drag.originals.get(resolved.id)
              if (orig) {
                finalPatches.push({
                  id: resolved.id,
                  patch: {
                    x: orig.x,
                    y: orig.y,
                  },
                })
                blockedByWall = true
                continue
              }
            }
            finalPatches.push({ id: resolved.id, patch })
          }
          if (blockedByWall) {
            onOverlapViolationRef.current?.()
          }
          store.updateObjects(finalPatches, { pushHistory: true })
          onLayoutCommitRef.current?.()
        }
        dragRef.current = null
        setBoothLayoutGestureActive(false)
        return
      }

      if (marquee && marquee.pointerId === e.pointerId) {
        const rect = normalizeRect(marquee.anchor, marquee.current)
        if (rect.width > 0.5 || rect.height > 0.5) {
          // Marquee selects against each object's rotated AABB so a
          // tilted booth can still be lassoed without false misses.
          const hits = store.doc.objects
            .filter((o) => rectsIntersect(rect, rotatedAabb(o)))
            .map((o) => o.id)
          if (e.shiftKey || e.metaKey || e.ctrlKey) {
            store.setSelection(new Set([...store.selectedIds, ...hits]))
          } else {
            store.setSelection(hits)
          }
        }
        setMarquee(null)
      }
    },
    [flushMove, marquee, onAfterDrawCommit, setDraft, store]
  )

  // Cancel any in-flight rAF on unmount so we don't fire flushMove
  // against a torn-down store.
  useEffect(
    () => () => {
      if (moveRafRef.current !== null) {
        cancelAnimationFrame(moveRafRef.current)
        moveRafRef.current = null
      }
      pendingMoveRef.current = null
    },
    []
  )

  const onPointerLeave = useCallback(() => {
    startTransition(() => {
      setEmptyCanvasHover(false)
      setRoomEdgeHover(null)
      setRoomVertexHover(null)
    })
  }, [])

  const onContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault()
    },
    []
  )

  return {
    draftRect: draft ? normalizeRect(draft.anchor, draft.current) : null,
    draftKind: draft ? draft.kind : null,
    placementHoverRect: placementHover?.rect ?? null,
    placementHoverKind: placementHover?.kind ?? null,
    placementHoverRotation: placementHover?.rotation ?? 0,
    marqueeRect: marquee
      ? normalizeRect(marquee.anchor, marquee.current)
      : null,
    rotating,
    roomGestureActive,
    roomVertexDragActive,
    roomEdgeHover,
    roomVertexHover,
    objectGestureActive,
    boothLayoutGestureActive,
    emptyCanvasHover,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onContextMenu,
  }
}

/**
 * Pick the least-used category from `eventCategoryNames` based on
 * existing booth assignments in the doc. Ties break toward the
 * earlier entry in `eventCategoryNames` so coordinators get a
 * predictable rotation. Returns `null` when no categories are
 * defined yet — the caller leaves the booth untagged in that case.
 */
function pickLeastUsedCategory(
  store: FloorPlanDocStore,
  eventCategoryNames: ReadonlyArray<string> | undefined
): string | null {
  if (!eventCategoryNames || eventCategoryNames.length === 0) return null
  const counts = new Map<string, number>()
  for (const name of eventCategoryNames) counts.set(name, 0)
  for (const obj of store.doc.objects) {
    if (obj.kind !== 'booth') continue
    const cat = obj.categoryName
    if (!cat) continue
    if (counts.has(cat)) counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  let bestName = eventCategoryNames[0]!
  let bestCount = counts.get(bestName) ?? 0
  for (const name of eventCategoryNames) {
    const c = counts.get(name) ?? 0
    if (c < bestCount) {
      bestName = name
      bestCount = c
    }
  }
  return bestName
}

function commitDraft(
  store: FloorPlanDocStore,
  kind: PlacedObject['kind'],
  rect: Rect,
  eventCategoryNames?: ReadonlyArray<string>,
  roomId?: string | null,
  onProximityViolation?: (info: {
    category: string
    dxColumns: number
    dyRows: number
  }) => void,
  onOverlapViolation?: () => void,
  defaultBoothTableSpec?: TableSizeSpec,
  debugLog?: (message: string) => void,
  enforceCategorySeparation = true,
  amenityType?: AmenityType,
  onDrawPlacementRejected?: (message: string) => void
): void {
  const log = debugLog ?? (() => {})
  const resolved = resolveDrawCommitRect(
    kind,
    rect,
    store.doc.snapFt,
    defaultBoothTableSpec,
    amenityType
  )
  const id = `obj-${crypto.randomUUID()}`
  const base = {
    id,
    x: resolved.x,
    y: resolved.y,
    width: resolved.width,
    height: resolved.height,
    rotation: 0,
  }
  let obj: PlacedObject
  switch (kind) {
    case 'booth': {
      if (
        defaultBoothTableSpec != null &&
        isTentTableSpec(defaultBoothTableSpec) &&
        !isOutdoorVenueProfile(venueProfileForRoom(store.doc, roomId))
      ) {
        onDrawPlacementRejected?.(TENT_OUTDOOR_ONLY_TOOLTIP)
        return
      }
      const isGuestTable = defaultBoothTableSpec?.purpose === 'guest'
      // Vendor booths get a category seed for the proximity mix rule;
      // patron seating tables stay untagged.
      const seedCategory = isGuestTable
        ? null
        : pickLeastUsedCategory(store, eventCategoryNames)
      const sizeSnapshot =
        defaultBoothTableSpec != null
          ? boothPatchForTableSize(base, defaultBoothTableSpec)
          : null
      obj = {
        ...base,
        kind: 'booth',
        accentColor: null,
        ...(sizeSnapshot ?? {}),
        ...(seedCategory ? { categoryName: seedCategory } : {}),
      }
      break
    }
    case 'wall':
      obj = { ...base, kind: 'wall' }
      break
    case 'open_wall':
      // Default counter depth = 1.5 ft (a typical pass-through
      // ledge). The inspector lets coordinators tune this per
      // window, and the renderer falls back to this default when
      // the field is absent — see canvas-objects.tsx.
      obj = { ...base, kind: 'open_wall', counterDepthFt: 1.5 }
      break
    case 'food_truck':
      obj = { ...base, kind: 'food_truck', label: 'Food truck' }
      break
    case 'stage':
      obj = {
        ...base,
        kind: 'stage',
        label: nextStageLabel(store.doc.objects),
      }
      break
    case 'food_court':
      obj = {
        ...base,
        kind: 'food_court',
        label: nextFoodCourtLabel(store.doc.objects),
      }
      break
    case 'amenity': {
      const type = amenityType ?? 'bouncy_castle'
      obj = {
        ...base,
        kind: 'amenity',
        amenityType: type,
        label: nextAmenityLabel(store.doc.objects, type),
      }
      break
    }
    case 'door':
      obj = { ...base, kind: 'door', doorType: 'entrance' }
      break
    case 'emergency_exit':
      obj = { ...base, kind: 'emergency_exit', label: 'EXIT' }
      break
    case 'label':
      obj = { ...base, kind: 'label', text: 'Label' }
      break
    default:
      return
  }
  // Wall-orientation snap for vendor booths near perimeter walls.
  if (isVendorBoothObject(obj)) {
    const snapFt = store.doc.snapFt > 0 ? store.doc.snapFt : 1
    obj = {
      ...obj,
      ...boothLayoutCommitPatch(obj as BoothObject, store.doc, {
        snapFt,
        activeRoomId: roomId ?? null,
      }),
    } as PlacedObject
  }
  const placementRoomId =
    roomId ??
    resolvePlacementRoomIdForObject(store.doc, obj, null)
  if (isStructuralWallSnapKind(obj.kind)) {
    const frame = placementRoomId
      ? store.doc.rooms?.find((r) => r.id === placementRoomId)
      : null
    if (frame) {
      obj = { ...obj, ...snapStructuralAssetToRoomFrame(obj, frame) } as PlacedObject
    }
  }
  const canvasOpen = isCanvasOpenPlacementKind(obj.kind)
  if (
    (!canvasOpen && !placementRoomId) ||
    !isValidObjectPlacement(store.doc, obj, placementRoomId)
  ) {
    log(
      `Placement rejected (${obj.kind}): center=(${objectCenter(obj).x},${objectCenter(obj).y}) room=${placementRoomId ?? 'none'}`
    )
    onOverlapViolation?.()
    return
  }
  if (
    enforceCategorySeparation &&
    obj.kind === 'booth' &&
    !isGuestTableBooth(obj as BoothObject)
  ) {
    const violation = findBoothProximityViolation(
      obj as BoothObject,
      store.doc.objects,
      store.doc.gridSpacingFt || 1
    )
    if (violation) {
      log(
        `Placement rejected (${obj.kind}): proximity category=${violation.category}`
      )
      onProximityViolation?.({
        category: violation.category,
        dxColumns: violation.dxColumns,
        dyRows: violation.dyRows,
      })
      return
    }
  }
  log(
    `Placement committed (${obj.kind}): ${formatPlacementProbe(obj)} room=${placementRoomId ?? 'open-canvas'}`
  )
  store.addObject(obj, {
    select: true,
    roomId: placementRoomId ?? undefined,
  })
}
