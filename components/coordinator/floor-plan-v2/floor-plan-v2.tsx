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
import type { LayoutRoomPresetId } from '@/lib/booth-planner/layout-room-presets'
import { createClient } from '@/lib/supabase/client'
import { persistLayoutDraft } from '@/lib/wizard/wizard-autosave'
import { layoutPayloadFromRooms } from '@/lib/booth-planner/layout-rooms'
import { cn } from '@/lib/utils'
import { FloorPlanCanvas } from './canvas/floor-plan-canvas'
import { CanvasLegend } from './canvas/canvas-legend'
import type { ViewportApi } from './canvas/use-viewport'
import { PropertyInspector } from './inspector/property-inspector'
import { LayoutRoomBar } from '../layout-room-bar'
import { ToolPalette } from './tools/tool-palette'
import { DEFAULT_TOOL_STATE, type DrawShape, type ToolId } from './tools/types'
import { autoArrange } from './engine/auto-arrange'
import {
  docFromLegacyRooms,
  legacyRoomsFromDoc,
  unifiedCanvasExtents,
} from './state/legacy-bridge'
import {
  clearMultiRoomDraft,
  loadMultiRoomDraft,
  saveMultiRoomDraft,
} from './state/local-draft'
import { useFloorPlanDoc } from './state/use-floor-plan-doc'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from './state/types'
import {
  aabbFitsCanvas,
  canvasClampDelta,
  groupCanvasClampDelta,
  rotatedAabb,
} from './interactions/geometry'
import type { LayoutRoom } from '@/types/database'

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
  className?: string
}

/**
 * Floor Plan v2 — the unified multi-room canvas surface.
 *
 * Architecture:
 *   - Every `LayoutRoom` from the wizard is projected onto a single
 *     `FloorPlanDoc` whose `objects` array carries every booth /
 *     wall / door / stage / aisle / label across every room, all in
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
export function FloorPlanV2({
  eventId,
  layoutRooms,
  layoutActiveRoomId,
  onLayoutRoomsChange,
  saveLayoutRef,
  eventCategoryNames,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  className,
}: FloorPlanV2Props) {
  // Initial unified doc — seed from server-loaded rooms first; if a
  // fresher crash-recovery draft exists in localStorage for this
  // event, prefer that.
  const initialDoc = useMemo<FloorPlanDoc>(() => {
    const seeded = docFromLegacyRooms(layoutRooms)
    if (!eventId) return seeded
    const cached = loadMultiRoomDraft(eventId)
    return cached?.doc ?? seeded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const store = useFloorPlanDoc(initialDoc)
  const [tool, setTool] = useState<ToolId>(DEFAULT_TOOL_STATE.tool)
  const [drawShape, setDrawShape] = useState<DrawShape>(
    DEFAULT_TOOL_STATE.drawShape
  )

  // The wizard's room list is the canonical source of (rooms, names,
  // dims). The unified doc's `rooms` field is updated whenever the
  // wizard list changes — but we DON'T blow away in-progress object
  // edits, only re-sync the room frame metadata. This preserves the
  // user's draws and drags across add-room / rename-room flows.
  const lastRoomIdsKeyRef = useRef<string | null>(null)
  useEffect(() => {
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
      return {
        ...existing,
        name: wf.name,
        widthFt: wf.widthFt,
        lengthFt: wf.lengthFt,
      }
    })

    // First sync after mount: if the wizard already had server-loaded
    // rooms with origins set, prefer the doc's seeded frames as-is.
    if (isFirstSync && docFrames.length > 0) {
      // No re-sync needed — initial doc already used wizardFrames.
      return
    }

    const sameFrames =
      merged.length === docFrames.length &&
      merged.every((m, i) => {
        const d = docFrames[i]
        return (
          d &&
          d.id === m.id &&
          d.name === m.name &&
          d.widthFt === m.widthFt &&
          d.lengthFt === m.lengthFt &&
          d.originX === m.originX &&
          d.originY === m.originY
        )
      })

    if (sameFrames) return

    const extents = unifiedCanvasExtents(merged)
    store.patchDoc(
      {
        rooms: merged,
        canvasWidthFt: Math.max(extents.width, 50),
        canvasLengthFt: Math.max(extents.length, 50),
      },
      { pushHistory: false }
    )
    // Note: any objects that belonged to a now-deleted room get left
    // in the doc orphaned; the save bridge folds them into the first
    // surviving room as a safety net.
  }, [layoutRooms, store])

  // The "active room" follows the wizard's `layoutActiveRoomId` so
  // sidebar selections in the parent flow keep working. Selection of
  // a room *frame* on the canvas (the new "click the wall to drag
  // the room" gesture) is a separate piece of state — we only mark
  // a frame as the canvas selection while the user is interacting
  // with it.
  const activeRoomId = layoutActiveRoomId
  const [rawSelectedRoomId, setSelectedRoomId] = useState<string | null>(null)
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
    // Clearing is scoped to the active room so coordinators don't
    // accidentally wipe other rooms' work in a multi-room layout.
    const activeId = activeRoomId
    const objectRoom = store.doc.objectRoom ?? {}
    const remaining = store.doc.objects.filter(
      (o) => objectRoom[o.id] && objectRoom[o.id] !== activeId
    )
    store.replaceObjects(remaining)
    toast.success('Active room cleared')
  }, [activeRoomId, store])

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(store.selectedIds)
    if (ids.length === 0) return
    store.removeObjects(ids)
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
    const buckets = new Map<string, PlacedObject[]>()
    for (const entry of clip.entries) {
      const roomId = entry.roomId ?? activeRoomId
      const candidate = {
        ...(entry.template as Omit<PlacedObject, 'id'>),
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
  }, [activeRoomId, store])

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
      return true
    },
    [store]
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

      if (e.key === 'h') setTool('hand')
      else if (e.key === 'v') setTool('select')
      else if (e.key === 'd') setTool('draw')
      else if (e.key === 'Escape') {
        setTool('select')
        store.clearSelection()
        setSelectedRoomId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCopy, handleDeleteSelected, handlePaste, handleRotateBy, store])

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

  const handleRotateLeft = useCallback(() => {
    handleRotateBy(-ROTATE_STEP_DEG)
  }, [handleRotateBy])
  const handleRotateRight = useCallback(() => {
    handleRotateBy(ROTATE_STEP_DEG)
  }, [handleRotateBy])

  const viewportApiRef = useRef<ViewportApi | null>(null)
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
  }, [])
  const handleCenterView = useCallback(() => {
    viewportApiRef.current?.centerView()
  }, [])

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

  const handleAutoArrange = useCallback(() => {
    if (boothCount === 0) {
      toast.message('Nothing to arrange — draw at least one booth first.')
      return
    }
    const frame = (store.doc.rooms ?? []).find((f) => f.id === activeRoomId)
    if (!frame) return
    const objectRoom = store.doc.objectRoom ?? {}
    const inRoom = store.doc.objects.filter(
      (o) => objectRoom[o.id] === activeRoomId
    )
    const others = store.doc.objects.filter(
      (o) => objectRoom[o.id] !== activeRoomId
    )
    const localObjects = inRoom.map(
      (o) => ({ ...o, x: o.x - frame.originX, y: o.y - frame.originY }) as PlacedObject
    )
    const localDoc: FloorPlanDoc = {
      canvasWidthFt: frame.widthFt,
      canvasLengthFt: frame.lengthFt,
      gridSpacingFt: store.doc.gridSpacingFt,
      snapFt: store.doc.snapFt,
      objects: localObjects,
    }
    const result = autoArrange(localDoc, { eventCategoryNames })
    if (result.placedCount === 0) {
      toast.error('Auto-Arrange could not fit any booths inside the room.')
      return
    }
    const reglobal = result.doc.objects.map(
      (o) => ({ ...o, x: o.x + frame.originX, y: o.y + frame.originY }) as PlacedObject
    )
    store.replaceObjects([...others, ...reglobal])
    if (result.droppedCount > 0) {
      toast.warning(
        `Auto-arranged ${result.placedCount} booth${result.placedCount === 1 ? '' : 's'} — ${result.droppedCount} did not fit and were dropped.`
      )
    } else {
      toast.success(
        `Auto-arranged ${result.placedCount} booth${result.placedCount === 1 ? '' : 's'} with clearance.`
      )
    }
  }, [activeRoomId, boothCount, eventCategoryNames, store])

  const handleSelectRoom = useCallback(
    (roomId: string) => {
      // Selecting a room from the sidebar updates both the wizard's
      // active room id (so capacity and other surfaces follow) and
      // clears any in-canvas selection so the user can start working
      // in the freshly-focused room.
      onLayoutRoomsChange(layoutRooms, roomId)
      store.clearSelection()
    },
    [layoutRooms, onLayoutRoomsChange, store]
  )

  const handleRoomFrameClick = useCallback(
    (roomId: string) => {
      setSelectedRoomId(roomId)
      // Promote the clicked frame to the active room so subsequent
      // draws / auto-arrange / property-inspector edits target it.
      if (roomId !== activeRoomId) {
        onLayoutRoomsChange(layoutRooms, roomId)
      }
    },
    [activeRoomId, layoutRooms, onLayoutRoomsChange]
  )

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 pb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-stone-900">
            Floor plan canvas
          </h2>
          <p className="text-[11px] text-stone-500">
            Multi-room. Click a room wall to drag the whole room. Touching
            walls automatically merge. Press{' '}
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
            for tools,{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              Ctrl+Z
            </kbd>{' '}
            undo,{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              R
            </kbd>{' '}
            /{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              Shift+R
            </kbd>{' '}
            rotate ±15°.
          </p>
        </div>
        <div className="ml-auto rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700">
          {placedCount} object{placedCount === 1 ? '' : 's'} placed
          {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
        </div>
      </header>

      <ToolPalette
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
        zoom={currentZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onCenterView={handleCenterView}
        onAutoArrange={handleAutoArrange}
        canAutoArrange={boothCount > 0}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
        {/*
          Canvas height is fluid on mobile so the wizard's "Save floor
          plan & deploy" CTA is always reachable below the fold without
          forcing a long scroll past a 640px box.
        */}
        <div className="relative h-[clamp(320px,52vh,720px)] overflow-hidden rounded-lg border border-stone-200 bg-stone-100 lg:h-[720px]">
          <FloorPlanCanvas
            store={store}
            toolState={{ tool, drawShape }}
            activeRoomId={activeRoomId}
            selectedRoomId={selectedRoomId}
            onRoomFrameClick={handleRoomFrameClick}
            onViewportReady={handleViewportReady}
            onZoomChange={setCurrentZoom}
            eventCategoryNames={eventCategoryNames}
          />
          {/*
            Persistent allocation legend — overlaid on the canvas
            wrapper (NOT inside the scroll container) so it stays
            pinned to the bottom-left corner regardless of pan/zoom.
            Decodes the green/red status grammar that booths and
            zone overlays use to communicate placement validity.
          */}
          <CanvasLegend />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {/*
            In-canvas Rooms panel. Replaces the old "ROOMS / ZONES"
            top-of-canvas bar — the wizard now mounts this strip on
            the right rail so the canvas itself can grow into the
            real estate previously consumed by the standalone bar.
            Clicking a row selects + activates the room (and focuses
            the inspector); the canvas frame chrome lights up to
            match.
          */}
          {onAddRoom && onRenameRoom && onDeleteRoom ? (
            <LayoutRoomBar
              rooms={layoutRooms}
              activeRoomId={selectedRoomId ?? activeRoomId}
              onSelectRoom={handleSelectRoom}
              onAddRoom={onAddRoom}
              onRenameRoom={onRenameRoom}
              onDeleteRoom={onDeleteRoom}
              compact
            />
          ) : null}
          <PropertyInspector
            store={store}
            eventCategoryNames={eventCategoryNames}
          />
        </div>
      </div>
    </div>
  )
}
