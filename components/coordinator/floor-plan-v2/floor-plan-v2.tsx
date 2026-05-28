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
import { CanvasCommandBar } from './tools/canvas-command-bar'
import { CanvasLeftDock } from './tools/canvas-left-dock'
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
import {
  isAuxiliaryRoom,
  isJoinableObject,
  joinableGroups,
  mixedNeighborsOf,
  neighborsOf,
} from './state/room-joins'
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
  canvasClampDelta,
  groupCanvasClampDelta,
  groupRotatedAabb,
  rotatedAabb,
} from './interactions/geometry'
import {
  buildPerimeterWalls,
  resolvePerimeterTarget,
  targetHasPerimeterWalls,
} from './interactions/perimeter-walls'
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
  const [leftDockOpen, setLeftDockOpen] = useState(true)
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true)

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
    // Structural walls are explicitly preserved across the clear —
    // they're treated as architecture, not décor.
    const activeId = activeRoomId
    const objectRoom = store.doc.objectRoom ?? {}
    const remaining = store.doc.objects.filter((o) => {
      if (o.kind === 'wall') return true
      return objectRoom[o.id] && objectRoom[o.id] !== activeId
    })
    store.replaceObjects(remaining)
    toast.success('Active room cleared')
  }, [activeRoomId, store])

  /**
   * Delete-selected hard-blocks structural perimeter walls. Walls
   * (`kind: 'wall'`) cannot be removed via direct manipulation —
   * keyboard Delete/Backspace, the toolbar Delete button, and any
   * future delete entry-point all funnel through this callback, so
   * the type-guard here is the single chokepoint that keeps walls
   * immutable on the canvas grid.
   *
   * Locked objects (any kind with `locked === true`) are also held
   * back so coordinators don't accidentally lose pinned fixtures
   * during a multi-select delete.
   *
   * The action is silent on a wall-only selection (no toast, no
   * change) so it stays out of the way during normal editing; we
   * surface a single toast only when the user appears to be trying
   * to delete walls explicitly.
   */
  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(store.selectedIds)
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const selectedObjects = store.doc.objects.filter((o) => idSet.has(o.id))
    if (selectedObjects.length === 0) return
    const wallSelected = selectedObjects.filter((o) => o.kind === 'wall')
    const lockedSelected = selectedObjects.filter(
      (o) => o.kind !== 'wall' && o.locked === true
    )
    const removable = selectedObjects.filter(
      (o) => o.kind !== 'wall' && o.locked !== true
    )
    if (removable.length === 0) {
      if (wallSelected.length > 0) {
        toast.message(
          'Walls are structural fixtures and cannot be deleted.',
          { duration: 1800 }
        )
      } else if (lockedSelected.length > 0) {
        toast.message(
          'Selection is locked. Unlock to delete.',
          { duration: 1500 }
        )
      }
      return
    }
    store.removeObjects(removable.map((o) => o.id))
    if (wallSelected.length > 0) {
      toast.message(
        `Walls retained — ${wallSelected.length} structural fixture${wallSelected.length === 1 ? ' is' : 's are'} immutable.`,
        { duration: 1800 }
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
      return true
    },
    [store]
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
        e.preventDefault()
        setLeftDockOpen((open) => !open)
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
        setTool('select')
        store.clearSelection()
        setSelectedRoomId(null)
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
    const bbox = groupRotatedAabb(store.doc.objects)
    if (!bbox) {
      api.centerView()
      return
    }
    api.fitToBounds(
      {
        minX: bbox.x,
        minY: bbox.y,
        maxX: bbox.x + bbox.width,
        maxY: bbox.y + bbox.height,
      },
      { padding: 0.1 }
    )
  }, [store.doc.objects])


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

  /**
   * Macro: emit four locked perimeter wall rects matching the active
   * room's bounding box (or the canvas rect if there's no active
   * room). Walls are tagged with `PERIMETER_WALL_LABEL` and
   * `locked: true` so the wall-immutability gate in
   * `handleDeleteSelected` and `handleClearAll` keeps them intact
   * across the rest of the editing session. If the active target
   * already has a complete macro perimeter the call is a no-op
   * (toast feedback informs the user) so re-clicks don't double-
   * stack walls.
   */
  const handleAddPerimeterWalls = useCallback(() => {
    const target = resolvePerimeterTarget(
      store.doc.rooms,
      activeRoomId,
      store.doc.canvasWidthFt,
      store.doc.canvasLengthFt
    )
    if (target.widthFt <= 0 || target.lengthFt <= 0) {
      toast.error('Cannot add perimeter walls — invalid room dimensions.')
      return
    }
    if (targetHasPerimeterWalls(target, store.doc.objects)) {
      toast.message('Perimeter walls are already in place.')
      return
    }
    const walls = buildPerimeterWalls(target)
    const ids = store.addObjects(walls, {
      select: false,
      pushHistory: true,
      roomId: activeRoomId ?? undefined,
    })
    if (ids.length === 4) {
      toast.success('Sealed the room with four perimeter walls.', {
        duration: 1800,
      })
    } else {
      toast.warning(
        `Added ${ids.length} of 4 perimeter walls — some failed to fit.`
      )
    }
  }, [activeRoomId, store])

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

  /**
   * Eligibility for the canvas-bar "Join" action.
   *
   * Asset-type gate (deliberate restriction):
   * The Join action is *only* available when the deliberate initiator
   * is one of the following architectural fixtures:
   *   1. A joinable `PlacedObject` (currently `stage`) that overlaps
   *      or touches a room's perimeter wall, OR
   *   2. An auxiliary `RoomFrame` (Kitchen, Storage, Washroom,
   *      Corridor, Hallway, Annex, Outdoor Stage — anything matching
   *      `isAuxiliaryRoom`) that has at least one overlapping or
   *      touching neighbour.
   *
   * Standard vendor booths, tables, walls, doors, labels, exits, and
   * generic floor assets are explicitly blocked from triggering a
   * join — the button stays disabled when one is selected. The
   * primary "Main Hall" can be a join *target* (an annex extends it)
   * but it can't be the initiator on its own.
   *
   * Selection precedence:
   *   1. A single joinable `PlacedObject` (e.g. a stage) → object
   *      initiator, finds room/object neighbours.
   *   2. Otherwise: the active/selected `RoomFrame` is the initiator,
   *      gated on `isAuxiliaryRoom`.
   *
   * The structural intent: "Join" represents an architectural
   * extension of the perimeter wall, not a generic grouping op.
   */
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

    // -------------------------------------------------------------
    // Initiator detection. A single selection is required so the
    // join action has unambiguous semantics.
    // -------------------------------------------------------------
    const selectedIdsArray = Array.from(store.selectedIds)
    const singleSelectedObj =
      selectedIdsArray.length === 1
        ? objects.find((o) => o.id === selectedIdsArray[0]!)
        : null

    // Case A: a `PlacedObject` is selected.
    if (singleSelectedObj) {
      // Standard floor assets block the action entirely.
      if (!isJoinableObject(singleSelectedObj)) {
        return {
          ...empty,
          blockedReason: `${singleSelectedObj.kind} can't extend the perimeter`,
        }
      }
      const initiatorGroupId = singleSelectedObj.joinGroupId ?? null
      const neighbors = mixedNeighborsOf(
        { kind: 'object', id: singleSelectedObj.id },
        frames,
        objects
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

    // Case B: no single object — fall back to the active/selected
    // room frame, gated on the auxiliary-room rule.
    const joinTargetRoomId = selectedRoomId ?? activeRoomId
    if (!joinTargetRoomId || frames.length < 2) {
      return empty
    }
    const target = frames.find((f) => f.id === joinTargetRoomId)
    if (!target) return empty

    if (!isAuxiliaryRoom(target)) {
      // Main Hall can't initiate — coordinators must select the
      // auxiliary annex (or the stage) to express the intent.
      return {
        ...empty,
        unjoinGroupId: target.joinGroupId ?? null,
        blockedReason:
          'Select an auxiliary room (Kitchen / Storage / Washroom / Annex / Stage) to extend the perimeter',
      }
    }

    const targetGroupId = target.joinGroupId ?? null
    // Use the mixed-neighbour search so an auxiliary room can also
    // pull in a touching joinable object (e.g. a stage parked on
    // the kitchen edge).
    const neighbors = mixedNeighborsOf(
      { kind: 'room', id: target.id },
      frames,
      objects
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
      blockedReason: null as string | null,
    }
  }, [
    store.doc.rooms,
    store.doc.objects,
    store.selectedIds,
    selectedRoomId,
    activeRoomId,
  ])

  /**
   * Total number of distinct joined zones currently on the canvas.
   * Surfaced in the workspace header so coordinators can see at a
   * glance that the doc contains fused rooms even when the active
   * frame isn't part of one.
   */
  const joinedZoneCount = useMemo(
    () => joinableGroups(store.doc.rooms ?? []).length,
    [store.doc.rooms]
  )

  const handleJoinRooms = useCallback(() => {
    if (!joinPlan.canJoin) return
    const totalParticipants =
      joinPlan.joinRoomIds.length + joinPlan.joinObjectIds.length
    if (totalParticipants < 2) return
    const groupId = store.joinSelection({
      roomIds: joinPlan.joinRoomIds,
      objectIds: joinPlan.joinObjectIds,
    })
    if (!groupId) return
    const roomCount = joinPlan.joinRoomIds.length
    const objectCount = joinPlan.joinObjectIds.length
    const summary =
      objectCount > 0
        ? `Joined ${roomCount} room${roomCount === 1 ? '' : 's'} + ${objectCount} fixture${objectCount === 1 ? '' : 's'} — perimeter walls extended.`
        : `Joined ${roomCount} rooms into one zone — interior walls dissolved.`
    toast.success(summary, { duration: 1800 })
  }, [joinPlan, store])

  const handleUnjoinRoom = useCallback(() => {
    const groupId = joinPlan.unjoinGroupId
    if (!groupId) return
    store.unjoinRooms(groupId)
    toast.message('Joined zone split — each member is standalone again.', {
      duration: 1500,
    })
  }, [joinPlan.unjoinGroupId, store])

  return (
    <div id="floor-plan-workspace" className={cn('flex flex-col gap-2 min-h-0', className)}>
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 pb-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-stone-900">
            Floor plan canvas
          </h2>
          <p className="text-[11px] text-stone-500">
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              [
            </kbd>{' '}
            /{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              ]
            </kbd>{' '}
            toggle panels ·{' '}
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

      {/* Sticky-pinned action bars: even though the workspace is
          height-constrained so the page itself shouldn't scroll on
          most viewports, very small devices (height < ~640 px) can
          still nudge the page into overflow. `sticky top-0` keeps
          the command ribbon and rooms row anchored to the viewport
          top in that fallback case so coordinators never lose their
          tools while scrolling. Both bars share one sticky container
          so they slide together rather than jittering past each
          other. The `bg-stone-50` opaque backdrop matches the
          page background and prevents canvas content from showing
          through on the sticky ribbon. */}
      <div className="sticky top-0 z-40 -mx-2 px-2 -mt-2 pt-2 bg-stone-50 shrink-0">
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
          onAlignVertical={handleAlignVertical}
          onAlignHorizontal={handleAlignHorizontal}
          zoom={currentZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onCenterView={handleCenterView}
          onAutoArrange={handleAutoArrange}
          canAutoArrange={boothCount > 0}
          onJoinRooms={handleJoinRooms}
          canJoinRooms={joinPlan.canJoin}
          joinCandidateCount={
            joinPlan.canJoin
              ? joinPlan.joinRoomIds.length + joinPlan.joinObjectIds.length
              : undefined
          }
          joinBlockedReason={joinPlan.blockedReason}
          onUnjoinRoom={handleUnjoinRoom}
          canUnjoinRoom={joinPlan.unjoinGroupId !== null}
        />

        {onAddRoom && onRenameRoom && onDeleteRoom ? (
          <div className="mt-2">
            <LayoutRoomBar
              rooms={layoutRooms}
              activeRoomId={selectedRoomId ?? activeRoomId}
              onSelectRoom={handleSelectRoom}
              onAddRoom={onAddRoom}
              onRenameRoom={onRenameRoom}
              onDeleteRoom={onDeleteRoom}
              slim
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0 gap-2">
        <div className="relative flex shrink-0">
          {!leftDockOpen ? (
            <button
              type="button"
              onClick={() => setLeftDockOpen(true)}
              title="Show tool palette ([)"
              aria-label="Show tool palette"
              className="flex h-full w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setLeftDockOpen(false)}
                title="Hide tool palette ([)"
                aria-label="Hide tool palette"
                className="absolute -right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm hover:bg-stone-50"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <CanvasLeftDock
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
                onAlignVertical={handleAlignVertical}
                onAlignHorizontal={handleAlignHorizontal}
                zoom={currentZoom}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={handleZoomReset}
                onCenterView={handleCenterView}
                onAutoArrange={handleAutoArrange}
                canAutoArrange={boothCount > 0}
                onAddPerimeterWalls={handleAddPerimeterWalls}
              />
            </div>
          )}
        </div>

        <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
          <FloorPlanCanvas
            store={store}
            toolState={{ tool, drawShape }}
            activeRoomId={activeRoomId}
            selectedRoomId={selectedRoomId}
            onRoomFrameClick={handleRoomFrameClick}
            onViewportReady={handleViewportReady}
            onZoomChange={setCurrentZoom}
            eventCategoryNames={eventCategoryNames}
            onProximityViolation={(info) => {
              toast.error(
                `Same-category booths must be at least 5 columns or 2 rows apart — "${info.category}" placement reverted.`,
                { duration: 2400 }
              )
            }}
          />
          <CanvasLegend />
        </div>

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
            <div className="relative w-[min(100%,260px)]">
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
                className="h-full max-h-full overflow-y-auto"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
