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
  normalizeRect,
  objectRect,
  rectsIntersect,
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

export interface CanvasPointerApi {
  draftRect: Rect | null
  draftKind: PlacedObject['kind'] | null
  marqueeRect: Rect | null
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
      const ft = ftAt(e.clientX, e.clientY)

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
        for (const id of drag.ids) {
          const orig = drag.originals.get(id)
          if (!orig) continue
          const nextX = snapToGrid(orig.x + dx, snap)
          const nextY = snapToGrid(orig.y + dy, snap)
          patches.push({ id, patch: { x: nextX, y: nextY } })
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
          const hits = store.doc.objects
            .filter((o) => rectsIntersect(rect, objectRect(o)))
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
