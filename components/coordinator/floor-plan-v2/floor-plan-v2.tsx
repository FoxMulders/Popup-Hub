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
import type { FloorPlanDoc } from './state/types'
import type { LayoutRoom } from '@/types/database'

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

  const handleAfterDrawCommit = useCallback(() => {
    // After a single draw, snap back to Select so the user is in editing
    // mode immediately. Held Shift = stay in Draw for rapid placements.
    setTool('select')
  }, [])

  const handleClearAll = useCallback(() => {
    store.replaceObjects([])
    toast.success('Canvas cleared')
  }, [store])

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(store.selectedIds)
    if (ids.length === 0) return
    store.removeObjects(ids)
  }, [store])

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
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        store.undo()
        return
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key === 'y')
      ) {
        e.preventDefault()
        store.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.size > 0) {
          e.preventDefault()
          handleDeleteSelected()
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
  }, [handleDeleteSelected, store])

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

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 pb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-stone-900">
            Floor plan canvas
          </h2>
          <p className="text-[11px] text-stone-500">
            Free-form. No presets, no capacity clamps. Draw, drag, and edit
            objects directly. Press{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              H
            </kbd>{' '}
            for pan,{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              V
            </kbd>{' '}
            for select,{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              D
            </kbd>{' '}
            for draw.
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
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
        <div className="relative h-[640px] overflow-hidden rounded-lg border border-stone-200 bg-stone-100 lg:h-[720px]">
          <FloorPlanCanvas
            store={store}
            toolState={{ tool, drawShape }}
            onAfterDrawCommit={handleAfterDrawCommit}
          />
        </div>
        <div className="flex flex-col gap-2">
          <PropertyInspector store={store} />
          {rightSidebarExtra}
        </div>
      </div>
    </div>
  )
}
