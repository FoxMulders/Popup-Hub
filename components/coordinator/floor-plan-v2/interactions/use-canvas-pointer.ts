'use client'

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import type { PlacedObject } from '../state/types'
import type { ToolState } from '../tools/types'
import {
  canvasClampDelta,
  normalizeRect,
  objectCenter,
  rectsIntersect,
  rotatedAabb,
  snapPoint,
  snapToGrid,
  type Point,
  type Rect,
  type ViewportTransform,
} from './geometry'

interface UseCanvasPointerOptions {
  store: FloorPlanDocStore
  toolState: ToolState
  scrollRef: RefObject<HTMLElement | null>
  surfaceRef: RefObject<SVGSVGElement | null>
  transform: ViewportTransform
  /**
   * When true the canvas's own pointer pipeline yields to whatever
   * external pan/zoom hook is attached (e.g. middle-button pan, two-
   * finger touch pan). Currently used to skip pointer handling while a
   * pinch is active.
   */
  panActive: boolean
  /**
   * Called whenever a draw gesture commits a new object. Lets the host
   * snap the active tool back to Select after a single placement.
   */
  onAfterDrawCommit?: () => void
}

type DrawDraft =
  | null
  | {
      anchor: Point
      current: Point
      kind: PlacedObject['kind']
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
 * `initialAngle` is the angle (degrees) from the object center to the
 * initial pointer position. We accumulate `currentRotation - initialRotation`
 * relative to that, so the handle stays under the pointer regardless of
 * which screen direction the user drags.
 */
type RotateState =
  | null
  | {
      pointerId: number
      objectId: string
      centerFt: Point
      initialRotation: number
      initialAngleDeg: number
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

export interface CanvasPointerApi {
  draftRect: Rect | null
  draftKind: PlacedObject['kind'] | null
  marqueeRect: Rect | null
  /** True while the user is actively dragging an on-canvas rotate handle. */
  rotating: boolean
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void
  onContextMenu: (e: React.MouseEvent<SVGSVGElement>) => void
}

export function useCanvasPointer(
  options: UseCanvasPointerOptions
): CanvasPointerApi {
  const { store, toolState, scrollRef, surfaceRef, transform, panActive } =
    options
  const onAfterDrawCommit = options.onAfterDrawCommit

  const [draft, setDraft] = useState<DrawDraft>(null)
  const dragRef = useRef<DragState>(null)
  const [marquee, setMarquee] = useState<MarqueeState>(null)
  const rotateRef = useRef<RotateState>(null)
  const [rotating, setRotating] = useState(false)

  const ftAt = useCallback(
    (clientX: number, clientY: number): Point => {
      const surface = surfaceRef.current
      const scroll = scrollRef.current
      if (!surface || !scroll) return { x: 0, y: 0 }
      const rect = surface.getBoundingClientRect()
      // The SVG element renders at the scaled (zoomed) size already. Its
      // client rect is the viewport position; client coords minus that
      // origin gives us a position inside the surface in pixels.
      const px = clientX - rect.left
      const py = clientY - rect.top
      const ratio = transform.basePxPerFt * transform.zoom
      if (ratio === 0) return { x: 0, y: 0 }
      return { x: px / ratio, y: py / ratio }
    },
    [scrollRef, surfaceRef, transform.basePxPerFt, transform.zoom]
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
    },
    [store.doc.objects]
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (panActive) return
      // Only react to primary mouse / pen / touch.
      if (e.button !== 0 && e.pointerType === 'mouse') return

      const ft = ftAt(e.clientX, e.clientY)

      if (toolState.tool === 'hand') {
        // Hand mode is a no-op at this layer — pan-zoom hook handles motion.
        return
      }

      if (toolState.tool === 'draw') {
        e.currentTarget.setPointerCapture(e.pointerId)
        const snapped = snapPoint(ft, store.doc.snapFt)
        setDraft({
          anchor: snapped,
          current: snapped,
          kind: toolState.drawShape,
        })
        return
      }

      // SELECT
      const target = e.target as Element | null

      // Rotate handle takes priority over the underlying object hit-
      // test. The handle carries `data-rotate-handle="true"` and
      // `data-object-id` so we can pick up the right object without
      // walking the doc.
      const rotateHandle = target?.closest('[data-rotate-handle="true"]')
      if (rotateHandle && toolState.tool === 'select') {
        const handleObjectId = rotateHandle.getAttribute('data-object-id')
        const obj =
          handleObjectId &&
          store.doc.objects.find((o) => o.id === handleObjectId)
        if (obj) {
          e.currentTarget.setPointerCapture(e.pointerId)
          const center = objectCenter(obj)
          rotateRef.current = {
            pointerId: e.pointerId,
            objectId: obj.id,
            centerFt: center,
            initialRotation: obj.rotation || 0,
            initialAngleDeg: angleDegFromCenter(center, ft),
          }
          setRotating(true)
          return
        }
      }

      const objectId = target?.closest('[data-object-id]')?.getAttribute(
        'data-object-id'
      )
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
        e.currentTarget.setPointerCapture(e.pointerId)
        beginDrag(e.pointerId, ft, targetIds)
        return
      }

      // Empty canvas in select mode → marquee.
      e.currentTarget.setPointerCapture(e.pointerId)
      if (!(e.shiftKey || e.metaKey || e.ctrlKey)) {
        store.clearSelection()
      }
      setMarquee({ pointerId: e.pointerId, anchor: ft, current: ft })
    },
    [
      beginDrag,
      ftAt,
      panActive,
      store,
      toolState.drawShape,
      toolState.tool,
    ]
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (panActive) return

      const drag = dragRef.current
      const rotate = rotateRef.current
      const ft = ftAt(e.clientX, e.clientY)

      if (rotate && rotate.pointerId === e.pointerId) {
        const angleNow = angleDegFromCenter(rotate.centerFt, ft)
        const delta = angleNow - rotate.initialAngleDeg
        let nextRotation = rotate.initialRotation + delta
        if (!e.shiftKey) {
          // Default: snap to ROTATE_SNAP_DEG (15°). Shift = freeform.
          nextRotation =
            Math.round(nextRotation / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG
        }
        nextRotation = normalizeDegrees(nextRotation)
        // Push the rotation, then clamp the object back inside the
        // canvas if the new rotated AABB pokes out of bounds. We
        // translate rather than refuse the rotation so the gesture
        // always feels responsive.
        const obj = store.doc.objects.find((o) => o.id === rotate.objectId)
        if (obj) {
          const probe = { ...obj, rotation: nextRotation }
          const { dx, dy } = canvasClampDelta(
            probe,
            store.doc.canvasWidthFt,
            store.doc.canvasLengthFt
          )
          store.updateObject(
            rotate.objectId,
            {
              rotation: nextRotation,
              x: obj.x + dx,
              y: obj.y + dy,
            },
            { pushHistory: false }
          )
        }
        return
      }

      if (draft) {
        const snapped = snapPoint(ft, store.doc.snapFt)
        setDraft({
          anchor: draft.anchor,
          current: snapped,
          kind: draft.kind,
        })
        return
      }

      if (drag && drag.pointerId === e.pointerId) {
        const dx = ft.x - drag.origin.x
        const dy = ft.y - drag.origin.y
        const moved =
          drag.moved || Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05
        dragRef.current = { ...drag, lastFt: ft, moved }
        if (!moved) return
        const patches: Array<{
          id: string
          patch: Partial<PlacedObject>
        }> = []
        const snap = store.doc.snapFt
        const cw = store.doc.canvasWidthFt
        const cl = store.doc.canvasLengthFt
        const objById = new Map(store.doc.objects.map((o) => [o.id, o]))
        for (const id of drag.ids) {
          const orig = drag.originals.get(id)
          if (!orig) continue
          const obj = objById.get(id)
          if (!obj) continue
          const proposedX = snapToGrid(orig.x + dx, snap)
          const proposedY = snapToGrid(orig.y + dy, snap)
          // Clamp the proposed position against the rotated AABB so
          // the object can't be dragged past the canvas edge.
          const probe: PlacedObject = { ...obj, x: proposedX, y: proposedY }
          const clampDelta = canvasClampDelta(probe, cw, cl)
          patches.push({
            id,
            patch: {
              x: proposedX + clampDelta.dx,
              y: proposedY + clampDelta.dy,
            },
          })
        }
        // Don't push a history entry on every frame. We'll push one at
        // pointerup if `moved` is true.
        store.updateObjects(patches, { pushHistory: false })
        return
      }

      if (marquee && marquee.pointerId === e.pointerId) {
        setMarquee({ ...marquee, current: ft })
      }
    },
    [draft, ftAt, marquee, panActive, store]
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      const rotate = rotateRef.current
      if (rotate && rotate.pointerId === e.pointerId) {
        const obj = store.doc.objects.find((o) => o.id === rotate.objectId)
        if (
          obj &&
          (obj.rotation || 0) !== rotate.initialRotation
        ) {
          // Single history entry that captures the final rotation +
          // translation. We've been mutating without history during
          // the gesture; snapshot once on release.
          store.updateObject(
            rotate.objectId,
            { rotation: obj.rotation, x: obj.x, y: obj.y },
            { pushHistory: true }
          )
        }
        rotateRef.current = null
        setRotating(false)
        return
      }

      if (draft) {
        const rect = normalizeRect(draft.anchor, draft.current)
        if (
          rect.width >= store.doc.snapFt ||
          rect.height >= store.doc.snapFt
        ) {
          // A click without drag still produces a 1ft × 1ft object so the
          // user gets immediate visual feedback. Only commit when there's
          // at least one snap-unit of extent — guards against accidental
          // 0-area objects when the user just taps and lifts.
          commitDraft(store, draft.kind, rect)
          onAfterDrawCommit?.()
        }
        setDraft(null)
        return
      }

      const drag = dragRef.current
      if (drag && drag.pointerId === e.pointerId) {
        if (drag.moved) {
          // Commit the move with a single history entry. We've been
          // mutating without history during the gesture; now snapshot.
          const finalPatches: Array<{
            id: string
            patch: Partial<PlacedObject>
          }> = []
          for (const obj of store.doc.objects) {
            if (drag.ids.includes(obj.id)) {
              finalPatches.push({
                id: obj.id,
                patch: { x: obj.x, y: obj.y },
              })
            }
          }
          store.updateObjects(finalPatches, { pushHistory: true })
        }
        dragRef.current = null
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
    [draft, marquee, onAfterDrawCommit, store]
  )

  const onContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault()
    },
    []
  )

  return {
    draftRect: draft ? normalizeRect(draft.anchor, draft.current) : null,
    draftKind: draft ? draft.kind : null,
    marqueeRect: marquee
      ? normalizeRect(marquee.anchor, marquee.current)
      : null,
    rotating,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
  }
}

function commitDraft(
  store: FloorPlanDocStore,
  kind: PlacedObject['kind'],
  rect: Rect
): void {
  const id = `obj-${crypto.randomUUID()}`
  const base = {
    id,
    x: rect.x,
    y: rect.y,
    width: Math.max(store.doc.snapFt || 1, rect.width),
    height: Math.max(store.doc.snapFt || 1, rect.height),
    rotation: 0,
  }
  let obj: PlacedObject
  switch (kind) {
    case 'booth':
      obj = { ...base, kind: 'booth', accentColor: '#fde68a' }
      break
    case 'wall':
      obj = { ...base, kind: 'wall' }
      break
    case 'aisle':
      obj = { ...base, kind: 'aisle' }
      break
    case 'stage':
      obj = { ...base, kind: 'stage' }
      break
    case 'door':
      obj = { ...base, kind: 'door', doorType: 'entrance' }
      break
    case 'label':
      obj = { ...base, kind: 'label', text: 'Label' }
      break
  }
  store.addObject(obj, { select: true })
}
