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
import { createClient } from '@/lib/supabase/client'
import { persistLayoutDraft } from '@/lib/wizard/wizard-autosave'
import { layoutPayloadFromRooms } from '@/lib/booth-planner/layout-rooms'
import { cn } from '@/lib/utils'
import { FloorPlanCanvas } from './canvas/floor-plan-canvas'
import { PropertyInspector } from './inspector/property-inspector'
import { ToolPalette } from './tools/tool-palette'
import { DEFAULT_TOOL_STATE, type DrawShape, type ToolId } from './tools/types'
import { docFromLegacyRoom, legacyRoomFromDoc } from './state/legacy-bridge'
import { useFloorPlanDoc } from './state/use-floor-plan-doc'
import type { FloorPlanDoc, PlacedObject } from './state/types'
import { canvasClampDelta } from './interactions/geometry'
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
 * a group, preserving the relative geometry.
 */
type ClipboardEntry = {
  template: Omit<PlacedObject, 'id'>
  relX: number
  relY: number
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
  /** Optional sidebar slot — wizard injects QA findings here. */
  rightSidebarExtra?: React.ReactNode
  className?: string
}

/**
 * Floor Plan v2 — the new free-form canvas surface.
 *
 * This component is intentionally lean. It does not import any of the
 * legacy preset / capacity / auto-plan / pathfinding / stroller-clearance
 * / overlap-detection modules. Those systems can still ship to other
 * surfaces, but they are not consulted here.
 *
 * Behavior contract (verbatim from the goal):
 *   - No automatic preset behaviors.
 *   - No capacity clamps.
 *   - Hand / Select / Draw tools.
 *   - Unconstrained object placement.
 *   - Property inspector instead of blocking validators.
 */
export function FloorPlanV2({
  eventId,
  layoutRooms,
  layoutActiveRoomId,
  onLayoutRoomsChange,
  saveLayoutRef,
  rightSidebarExtra,
  className,
}: FloorPlanV2Props) {
  const activeRoom = useMemo(
    () =>
      layoutRooms.find((r) => r.id === layoutActiveRoomId) ?? layoutRooms[0],
    [layoutRooms, layoutActiveRoomId]
  )

  const initialDoc = useMemo<FloorPlanDoc>(
    () => docFromLegacyRoom(activeRoom ?? null),
    // We deliberately depend only on the room id — re-hydrating on every
    // object change would clobber in-flight edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRoom?.id]
  )

  const store = useFloorPlanDoc(initialDoc)
  const [tool, setTool] = useState<ToolId>(DEFAULT_TOOL_STATE.tool)
  const [drawShape, setDrawShape] = useState<DrawShape>(
    DEFAULT_TOOL_STATE.drawShape
  )

  // When the active room changes, re-hydrate.
  const lastRoomIdRef = useRef<string | undefined>(activeRoom?.id)
  useEffect(() => {
    if (lastRoomIdRef.current === activeRoom?.id) return
    lastRoomIdRef.current = activeRoom?.id
    store.resetDoc(docFromLegacyRoom(activeRoom ?? null))
  }, [activeRoom, store])

  const handleToolChange = useCallback((next: ToolId) => {
    setTool(next)
  }, [])

  const handleDrawShapeChange = useCallback((next: DrawShape) => {
    setDrawShape(next)
  }, [])

  // Sticky draw: after each placement, the active tool stays on Draw so
  // the user can place the next object without re-selecting the tool.
  // Switching to Select / Hand requires an explicit tool button click or
  // the V / H keyboard shortcut. Pressing Escape also drops back to
  // Select for convenience.

  const handleClearAll = useCallback(() => {
    store.replaceObjects([])
    toast.success('Canvas cleared')
  }, [store])

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
  /**
   * React-visible mirror of "clipboard has content" so the toolbar
   * Paste button can flip from disabled to enabled the moment the
   * user copies. The ref alone isn't enough — refs don't trigger
   * re-renders.
   */
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

    const entries: ClipboardEntry[] = selected.map((o) => {
      // Deep-clone all properties except id. JSON round-trip is safe
      // here because PlacedObject only carries primitives + plain
      // string/number/boolean fields — no functions, no Dates, no
      // Maps. The id is intentionally dropped; we mint a new one on
      // paste so duplicates never collide with the source.
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
  }, [store.doc.objects, store.selectedIds])

  const handlePaste = useCallback(() => {
    const clip = clipboardRef.current
    if (!clip || clip.entries.length === 0) return false

    // Each successive paste of the same clipboard is offset further so
    // copies don't pile up on top of each other (Figma / Sketch style).
    const step = clip.pasteCount + 1
    const offset = PASTE_OFFSET_FT * step
    const baseX = clip.originX + offset
    const baseY = clip.originY + offset

    const cw = store.doc.canvasWidthFt
    const cl = store.doc.canvasLengthFt

    const newObjects: PlacedObject[] = clip.entries.map((entry) => {
      const candidate = {
        ...(entry.template as Omit<PlacedObject, 'id'>),
        id: `obj-${crypto.randomUUID()}`,
        x: baseX + entry.relX,
        y: baseY + entry.relY,
      } as PlacedObject
      // Boundary clamp: if the paste offset (or the original copy
      // position, for items already near the edge) pushed the new
      // object's rotated AABB outside the canvas, pull it back in by
      // the smallest delta that fits. Items larger than the canvas
      // pin to the top-left edge.
      const { dx, dy } = canvasClampDelta(candidate, cw, cl)
      return { ...candidate, x: candidate.x + dx, y: candidate.y + dy } as PlacedObject
    })

    store.addObjects(newObjects, { select: true })
    clipboardRef.current = { ...clip, pasteCount: step }
    setTool('select')
    toast.success(
      `Pasted ${newObjects.length} object${newObjects.length === 1 ? '' : 's'}`,
      { duration: 1500 }
    )
    return true
  }, [store])

  /**
   * Rotate every selected object by `delta` degrees around its own
   * center, then translate it back inside the canvas if the new
   * rotated AABB poked out of bounds. We rotate each object
   * independently (rather than around a group origin) so behaviour
   * matches the on-canvas rotate handle.
   */
  const handleRotateBy = useCallback(
    (delta: number) => {
      const ids = Array.from(store.selectedIds)
      if (ids.length === 0) return false
      const cw = store.doc.canvasWidthFt
      const cl = store.doc.canvasLengthFt
      const idSet = new Set(ids)
      const patches: Array<{ id: string; patch: Partial<PlacedObject> }> = []
      for (const obj of store.doc.objects) {
        if (!idSet.has(obj.id)) continue
        if (obj.locked) continue
        // Normalize into (-180, 180] so the rotation field stays
        // tidy across many incremental rotations.
        let next = ((obj.rotation || 0) + delta) % 360
        if (next > 180) next -= 360
        if (next <= -180) next += 360
        const probe: PlacedObject = { ...obj, rotation: next }
        const { dx, dy } = canvasClampDelta(probe, cw, cl)
        patches.push({
          id: obj.id,
          patch: { rotation: next, x: obj.x + dx, y: obj.y + dy },
        })
      }
      if (patches.length === 0) return false
      store.updateObjects(patches)
      return true
    },
    [store]
  )

  // Keyboard shortcuts. Scoped to the canvas surface — these activate
  // when the canvas wrapper has focus, which it does after the user
  // clicks anywhere in it.
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

      // Copy / paste. We only intercept these when the user is
      // actually focused on the canvas surface (not in a property
      // inspector input — that's already handled by the early-return
      // for tag === 'input' above). Returning early without
      // preventDefault lets the browser do its native copy/paste in
      // text fields.
      if (cmd && key === 'c') {
        if (handleCopy()) e.preventDefault()
        return
      }
      if (cmd && key === 'v') {
        if (handlePaste()) e.preventDefault()
        return
      }
      // Convenience: Ctrl/Cmd+D = duplicate-in-place (copy + paste in
      // one keystroke). Common in design tools.
      if (cmd && key === 'd') {
        if (handleCopy() && handlePaste()) e.preventDefault()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.size > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
        return
      }

      // Rotate shortcut: `r` rotates the selection +15°,
      // `Shift+R` rotates -15°. Modifier-free so it doesn't
      // collide with browser/OS Cmd+R refresh.
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
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCopy, handleDeleteSelected, handlePaste, handleRotateBy, store])

  // Wire the wizard save ref to a v2-aware persistence function.
  useEffect(() => {
    if (!saveLayoutRef) return
    saveLayoutRef.current = async () => {
      if (!eventId) {
        toast.error('Save event details before saving the layout')
        return false
      }
      if (!activeRoom) return false

      const projected = legacyRoomFromDoc(activeRoom, store.doc)
      const nextRooms = layoutRooms.map((r) =>
        r.id === activeRoom.id ? projected : r
      )
      onLayoutRoomsChange(nextRooms, activeRoom.id)

      const supabase = createClient()
      const payload = layoutPayloadFromRooms(
        eventId,
        nextRooms,
        activeRoom.id
      )
      const { error } = await persistLayoutDraft(supabase, eventId, payload)
      if (error) {
        toast.error(`Save failed — ${error.message}`)
        return false
      }
      toast.success('Floor plan saved')
      return true
    }
    return () => {
      if (saveLayoutRef.current) saveLayoutRef.current = null
    }
  }, [
    activeRoom,
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

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 pb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-stone-900">
            Floor plan canvas
          </h2>
          <p className="text-[11px] text-stone-500">
            Free-form. The active tool stays selected until you switch — draw
            multiple objects without round-tripping. Press{' '}
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
              Ctrl+C
            </kbd>{' '}
            /{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              Ctrl+V
            </kbd>{' '}
            copy / paste,{' '}
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
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
        {/*
          Canvas height is fluid on mobile so the wizard's "Save floor
          plan & deploy" CTA is always reachable below the fold without
          forcing a long scroll past a 640px box. We anchor a sane
          minimum (so the canvas doesn't collapse on tiny landscape
          screens), let it grow with viewport height, and cap it at
          720px to preserve the desktop look.
          - mobile portrait (~667h): ~52vh → ~347px canvas
          - mobile landscape (~375h): clamps up to 320px min
          - desktop:                    full 720px
        */}
        <div className="relative h-[clamp(320px,52vh,720px)] overflow-hidden rounded-lg border border-stone-200 bg-stone-100 lg:h-[720px]">
          <FloorPlanCanvas store={store} toolState={{ tool, drawShape }} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <PropertyInspector store={store} />
          {rightSidebarExtra}
        </div>
      </div>
    </div>
  )
}
