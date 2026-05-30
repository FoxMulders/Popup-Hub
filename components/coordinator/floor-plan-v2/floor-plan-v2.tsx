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
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { createClient } from '@/lib/supabase/client'
import { persistLayoutDraft } from '@/lib/wizard/wizard-autosave'
import { layoutPayloadFromRooms } from '@/lib/booth-planner/layout-rooms'
import { cn } from '@/lib/utils'
import { FloorPlanCanvas } from './canvas/floor-plan-canvas'
import { CanvasLegend } from './canvas/canvas-legend'
import type { ViewportApi } from './canvas/use-viewport'
import { PropertyInspector } from './inspector/property-inspector'
import { CanvasCommandBar } from './tools/canvas-command-bar'
import { DEFAULT_TOOL_STATE, type DrawShape, type ToolId } from './tools/types'
import { autoArrangeInRoom, type AutoArrangeMode } from './engine/auto-arrange'
import {
  docFromLegacyRooms,
  legacyRoomsFromDoc,
} from './state/legacy-bridge'
import {
  activeRoomFramingBounds,
  reconcileCanvasExtents,
  unionCanvasContentBounds,
} from './state/room-canvas'
import {
  clearMultiRoomDraft,
  loadMultiRoomDraft,
  saveMultiRoomDraft,
} from './state/local-draft'
import { useFloorPlanDoc } from './state/use-floor-plan-doc'
import {
  DEFAULT_TOUCH_EPSILON_FT,
  isJoinableObject,
  mixedNeighborsOf,
  neighborsOf,
  roomIdsFormConnectedComponent,
} from './state/room-joins'
import { vendorTableMetaFromApplications } from '@/lib/booth-planner/table-booth-consolidation'
import { planTableSizeChange } from './state/table-size-selection'
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
  detectPlacedObjectOverlaps,
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
import type { LayoutRoomPresetId } from '@/lib/booth-planner/layout-room-presets'
import type { FloorPlanDocStore } from './state/use-floor-plan-doc'
import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
import { useCommandCenterFullscreen } from '@/components/coordinator/dashboard/command-center-fullscreen-context'

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
  /**
   * Wizard-owned baseline table length for the active room (one
   * size per hall). The toolbar pill above the canvas binds to this
   * — when omitted, the pill hides and live booth rescaling is
   * skipped. Forwarding both fields keeps Step 3 the single source
   * of truth for table sizing now that the Step 2 selector has been
   * retired.
   */
  baselineTableLengthFt?: LayoutBaselineTableLengthFt
  onBaselineTableLengthChange?: (ft: LayoutBaselineTableLengthFt) => void
  /**
   * Hard structural booth ceiling from Step 2 — already accounts
   * for walking aisles and emergency fire paths via the
   * `WALKING_AISLE_RESERVE_RATIO` deduction in
   * `calculateNetUsableFloorSpace`. Forwarded to Auto-Arrange so it
   * never lays out more booths than the venue can safely host.
   */
  layoutCapacity?: number
  /**
   * Approved vendor applications — used to read `table_count` when
   * consolidating multi-table booths during Auto-Arrange.
   */
  applications?: ReadonlyArray<{
    id: string
    vendor_id?: string
    table_count?: number
    status?: string
  }>
  className?: string
  /** Notifies the host when the layout has unresolved object overlaps. */
  onOverlapChange?: (hasOverlap: boolean) => void
  /** Wizard Step 3 — triggers save + deploy from the top ribbon. */
  onSaveMarket?: () => void
  saveMarketDisabled?: boolean
  saveMarketLoading?: boolean
  /** Dashboard embed — compact chrome, telemetry-driven booth fills. */
  variant?: 'wizard' | 'dashboard'
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
  onStoreReady?: (store: FloorPlanDocStore | null) => void
  onSelectionChange?: (store: FloorPlanDocStore) => void
  onVendorDrop?: (applicationId: string, canvasX: number, canvasY: number) => void
}

/**
 * Floor Plan v2 — the unified multi-room canvas surface.
 *
 * Architecture:
 *   - Every `LayoutRoom` from the wizard is projected onto a single
 *     `FloorPlanDoc` whose `objects` array carries every booth /
 *     wall / door / stage / label across every room, all in
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
  baselineTableLengthFt,
  onBaselineTableLengthChange,
  layoutCapacity,
  applications,
  className,
  onOverlapChange,
  onSaveMarket,
  saveMarketDisabled,
  saveMarketLoading,
  variant = 'wizard',
  boothPlacementStatusByObjectId,
  onStoreReady,
  onSelectionChange,
  onVendorDrop,
}: FloorPlanV2Props) {
  // Initial unified doc — seed from server-loaded rooms first; if a
  // fresher crash-recovery draft exists in localStorage for this
  // event, prefer that.
  const initialDoc = useMemo<FloorPlanDoc>(() => {
    const seeded = docFromLegacyRooms(layoutRooms)
    const reconcileDoc = (doc: FloorPlanDoc): FloorPlanDoc => {
      const frames = doc.rooms ?? []
      if (frames.length === 0) return doc
      const extents = reconcileCanvasExtents(frames)
      return {
        ...doc,
        canvasWidthFt: Math.max(extents.canvasWidthFt, doc.canvasWidthFt, 50),
        canvasLengthFt: Math.max(extents.canvasLengthFt, doc.canvasLengthFt, 50),
      }
    }
    if (!eventId) return reconcileDoc(seeded)
    const cached = loadMultiRoomDraft(eventId)
    return reconcileDoc(cached?.doc ?? seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const store = useFloorPlanDoc(initialDoc)
  const isDashboard = variant === 'dashboard'
  const commandCenterFullscreen = useCommandCenterFullscreen()

  useEffect(() => {
    onStoreReady?.(store)
    return () => onStoreReady?.(null)
  }, [onStoreReady, store])

  useEffect(() => {
    onSelectionChange?.(store)
  }, [onSelectionChange, store, store.selectedIds])
  const layoutOverlaps = useMemo(
    () => detectPlacedObjectOverlaps(store.doc.objects),
    [store.doc.objects]
  )
  useEffect(() => {
    onOverlapChange?.(layoutOverlaps.size > 0)
  }, [layoutOverlaps.size, onOverlapChange])
  const [tool, setTool] = useState<ToolId>(DEFAULT_TOOL_STATE.tool)
  const [drawShape, setDrawShape] = useState<DrawShape>(
    DEFAULT_TOOL_STATE.drawShape
  )
  const [autoArrangeMode, setAutoArrangeMode] = useState<AutoArrangeMode>(
    isDashboard ? 'perimeter-only' : 'center-out'
  )
  const [rightInspectorOpen, setRightInspectorOpen] = useState(!isDashboard)
  const [showLabels, setShowLabels] = useState(true)

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
      // Keep canvas geometry (drag, resize, rotate). Wizard only
      // updates the display name while the editor is open.
      return {
        ...existing,
        name: wf.name,
      }
    })

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

    // First sync after mount: when wizard and doc already agree on the
    // same room ids, only reconcile canvas extents (crash-recovery
    // drafts can undersize the workspace vs room union). When the
    // wizard has rooms the doc doesn't know about yet, fall through
    // and merge normally so secondary rooms aren't trapped inside the
    // primary hall bounds.
    if (isFirstSync && docFrames.length > 0) {
      const wizardIdSet = new Set(wizardFrames.map((f) => f.id))
      const sameRoomSet =
        wizardIdSet.size === docFrames.length &&
        docFrames.every((f) => wizardIdSet.has(f.id))
      if (sameRoomSet) {
        const extents = reconcileCanvasExtents(merged)
        if (
          store.doc.canvasWidthFt !== extents.canvasWidthFt ||
          store.doc.canvasLengthFt !== extents.canvasLengthFt ||
          !sameFrames
        ) {
          store.patchDoc(
            {
              rooms: merged,
              canvasWidthFt: extents.canvasWidthFt,
              canvasLengthFt: extents.canvasLengthFt,
            },
            { pushHistory: false }
          )
        }
        return
      }
    }

    if (sameFrames) return

    const extents = reconcileCanvasExtents(merged)
    store.patchDoc(
      {
        rooms: merged,
        canvasWidthFt: extents.canvasWidthFt,
        canvasLengthFt: extents.canvasLengthFt,
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
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(
    () => new Set()
  )
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

  const highlightedRoomId = selectedRoomId ?? activeRoomId
  const highlightedRoomMetrics = useMemo(() => {
    const frame = (store.doc.rooms ?? []).find((r) => r.id === highlightedRoomId)
    if (!frame) return null
    return {
      name: frame.name,
      widthFt: frame.widthFt,
      lengthFt: frame.lengthFt,
    }
  }, [store.doc.rooms, highlightedRoomId])

  // Validated copy of the wizard-owned baseline table length. The
  // command-bar pill binds to this; upstream the value comes from
  // `activeRoom.baseline_table_length_ft` so the ribbon always
  // reflects the active room's size. Unrecognised lengths fall back
  // to the default rather than blowing up the selector. When the
  // wizard hasn't supplied a value at all we still pre-select 6′
  // so the pill is operational on first paint and any drag-time
  // booth math has a real footprint to scale against — coordinators
  // never see an empty / undefined baseline.
  const safeTableSizeFt = useMemo<LayoutBaselineTableLengthFt>(() => {
    if (baselineTableLengthFt != null && isLayoutBaselineTableLengthFt(baselineTableLengthFt)) {
      return baselineTableLengthFt
    }
    return DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  }, [baselineTableLengthFt])

  // Footprint for the next booth draw when nothing is selected.
  const [defaultPlacementSizeFt, setDefaultPlacementSizeFt] =
    useState<LayoutBaselineTableLengthFt>(safeTableSizeFt)

  useEffect(() => {
    setDefaultPlacementSizeFt(safeTableSizeFt)
  }, [safeTableSizeFt])

  const tableSizePillValue = useMemo<LayoutBaselineTableLengthFt>(() => {
    const selected = Array.from(store.selectedIds)
    if (selected.length !== 1) return defaultPlacementSizeFt
    const obj = store.doc.objects.find((o) => o.id === selected[0])
    if (obj?.kind !== 'booth') return defaultPlacementSizeFt
    const booth = obj as BoothObject
    if (
      booth.tableLengthFt != null &&
      isLayoutBaselineTableLengthFt(booth.tableLengthFt)
    ) {
      return booth.tableLengthFt
    }
    const longEdge = Math.max(booth.width, booth.height)
    if (isLayoutBaselineTableLengthFt(longEdge)) return longEdge
    return defaultPlacementSizeFt
  }, [store.selectedIds, store.doc.objects, defaultPlacementSizeFt])

  const handleTableSizeChange = useCallback(
    (ft: LayoutBaselineTableLengthFt) => {
      const { objectPatches, nextDefaultPlacementSizeFt } = planTableSizeChange({
        objects: store.doc.objects,
        selectedIds: store.selectedIds,
        ft,
      })
      if (objectPatches.length > 0) {
        store.updateObjects(objectPatches)
        return
      }
      if (nextDefaultPlacementSizeFt != null) {
        setDefaultPlacementSizeFt(nextDefaultPlacementSizeFt)
        onBaselineTableLengthChange?.(nextDefaultPlacementSizeFt)
      }
    },
    [store.doc.objects, store.selectedIds, store, onBaselineTableLengthChange]
  )

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
    // Clearing is scoped to the active room. Locked perimeter walls stay.
    const activeId = activeRoomId
    const objectRoom = store.doc.objectRoom ?? {}
    const remaining = store.doc.objects.filter((o) => {
      if (objectRoom[o.id] && objectRoom[o.id] !== activeId) return true
      if (o.locked === true) return true
      return false
    })
    store.replaceObjects(remaining)
    toast.success('Active room cleared')
  }, [activeRoomId, store])

  /** Delete selected objects; locked macro perimeter walls are kept. */
  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(store.selectedIds)
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const selectedObjects = store.doc.objects.filter((o) => idSet.has(o.id))
    if (selectedObjects.length === 0) return
    const lockedSelected = selectedObjects.filter((o) => o.locked === true)
    const removable = selectedObjects.filter((o) => o.locked !== true)
    if (removable.length === 0) {
      if (lockedSelected.length > 0) {
        toast.message(
          'Selection is locked. Unlock to delete.',
          { duration: 1500 }
        )
      }
      return
    }
    store.removeObjects(removable.map((o) => o.id))
    if (lockedSelected.length > 0) {
      toast.message(
        `Locked fixtures retained (${lockedSelected.length}).`,
        { duration: 1500 }
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

  const [wizardCanvasFullscreen, setWizardCanvasFullscreen] = useState(false)
  const canvasFullscreen = isDashboard
    ? commandCenterFullscreen.fullscreen
    : wizardCanvasFullscreen
  const setCanvasFullscreen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      if (isDashboard) {
        const next =
          typeof value === 'function'
            ? value(commandCenterFullscreen.fullscreen)
            : value
        commandCenterFullscreen.setFullscreen(next)
        return
      }
      setWizardCanvasFullscreen(value)
    },
    [commandCenterFullscreen, isDashboard]
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
        if (canvasFullscreen) {
          e.preventDefault()
          setCanvasFullscreen(false)
          return
        }
        setTool('select')
        store.clearSelection()
        setSelectedRoomId(null)
        setSelectedRoomIds(new Set())
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
    canvasFullscreen,
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
  const rotateTargetRoomId = selectedRoomId ?? activeRoomId

  const syncLayoutRoomsFromDoc = useCallback(
    (doc: FloorPlanDoc) => {
      if (layoutRooms.length === 0) return
      const projected = legacyRoomsFromDoc(layoutRooms, doc)
      onLayoutRoomsChange(projected, activeRoomId)
    },
    [activeRoomId, layoutRooms, onLayoutRoomsChange]
  )

  const handleRotateRoomLeft = useCallback(() => {
    if (!rotateTargetRoomId) {
      toast.message('Click the room perimeter on the canvas, then rotate.')
      return
    }
    const nextDoc = store.rotateRoomFrame(rotateTargetRoomId, 'ccw')
    if (!nextDoc) return
    syncLayoutRoomsFromDoc(nextDoc)
    const bounds = activeRoomFramingBounds(
      nextDoc.rooms ?? [],
      rotateTargetRoomId,
      nextDoc.objects,
      nextDoc.objectRoom
    )
    viewportApiRef.current?.fitToBounds(bounds, { padding: 0.08 })
  }, [rotateTargetRoomId, store, syncLayoutRoomsFromDoc])

  const handleRotateRoomRight = useCallback(() => {
    if (!rotateTargetRoomId) {
      toast.message('Click the room perimeter on the canvas, then rotate.')
      return
    }
    const nextDoc = store.rotateRoomFrame(rotateTargetRoomId, 'cw')
    if (!nextDoc) return
    syncLayoutRoomsFromDoc(nextDoc)
    const bounds = activeRoomFramingBounds(
      nextDoc.rooms ?? [],
      rotateTargetRoomId,
      nextDoc.objects,
      nextDoc.objectRoom
    )
    viewportApiRef.current?.fitToBounds(bounds, { padding: 0.08 })
  }, [rotateTargetRoomId, store, syncLayoutRoomsFromDoc])

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

  const vendorTableMetaByKey = useMemo(() => {
    if (!applications?.length) return undefined
    return vendorTableMetaFromApplications(applications, safeTableSizeFt)
  }, [applications, safeTableSizeFt])

  const handleAutoArrange = useCallback(() => {
    if (boothCount === 0) {
      toast.message('Nothing to arrange — draw at least one booth first.')
      return
    }
    const result = autoArrangeInRoom(store.doc, activeRoomId, {
      mode: autoArrangeMode,
      eventCategoryNames,
      baselineTableLengthFt: safeTableSizeFt,
      vendorTableMetaByKey,
      ...(typeof layoutCapacity === 'number' && layoutCapacity > 0
        ? { maxBooths: layoutCapacity }
        : {}),
    })
    if (!result) return
    if (result.placedCount === 0) {
      toast.error('Auto-Arrange could not fit any booths inside the room.')
      return
    }
    store.replaceObjects(result.doc.objects)
    const spaceOverflow = result.overflowCount + result.droppedCount
    if (spaceOverflow > 0) {
      toast.warning(
        `Could not place ${spaceOverflow} booth${spaceOverflow === 1 ? '' : 's'} due to space restrictions.`,
        { duration: 5000 }
      )
    } else if (result.unsatisfiedCategoryCount > 0) {
      // The clearance pass succeeded but the same-category proximity
      // rule (< 5 cols AND < 2 rows) couldn't be honored for every
      // booth — surface the overflow so the coordinator knows their
      // canvas is too tight to disperse every category.
      toast.warning(
        `Auto-arrange complete. ${result.unsatisfiedCategoryCount} booth${result.unsatisfiedCategoryCount === 1 ? '' : 's'} could not meet the 5-space / 2-row separation rule due to space constraints.`,
        { duration: 4500 }
      )
    } else {
      toast.success(
        `Auto-arranged ${result.placedCount} booth${result.placedCount === 1 ? '' : 's'} with clearance.`
      )
    }
  }, [
    activeRoomId,
    autoArrangeMode,
    boothCount,
    eventCategoryNames,
    layoutCapacity,
    safeTableSizeFt,
    store,
    vendorTableMetaByKey,
  ])

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
      onLayoutRoomsChange(layoutRooms, roomId)
      setSelectedRoomId(roomId)
      setSelectedRoomIds(new Set([roomId]))
      store.clearSelection()
    },
    [layoutRooms, onLayoutRoomsChange, store]
  )

  const handleRoomFrameClick = useCallback(
    (roomId: string, options?: { additive?: boolean }) => {
      if (options?.additive) {
        setSelectedRoomIds((prev) => {
          const next = new Set(prev)
          if (next.has(roomId)) next.delete(roomId)
          else next.add(roomId)
          return next
        })
      } else {
        setSelectedRoomIds(new Set([roomId]))
      }
      setSelectedRoomId(roomId)
      if (roomId !== activeRoomId) {
        onLayoutRoomsChange(layoutRooms, roomId)
      }
    },
    [activeRoomId, layoutRooms, onLayoutRoomsChange]
  )

  /** Join eligibility: touching/overlapping rooms (5px tolerance) or stages. */
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
        objects,
        DEFAULT_TOUCH_EPSILON_FT
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

    // Case B: two+ rooms selected on canvas (Shift+click) for explicit join.
    const prunedRoomIds = Array.from(selectedRoomIds).filter((id) =>
      frames.some((f) => f.id === id)
    )
    if (prunedRoomIds.length >= 2) {
      const connected = roomIdsFormConnectedComponent(
        prunedRoomIds,
        frames,
        DEFAULT_TOUCH_EPSILON_FT
      )
      const groupId =
        frames.find((f) => prunedRoomIds.includes(f.id))?.joinGroupId ?? null
      return {
        canJoin: connected,
        joinRoomIds: prunedRoomIds,
        joinObjectIds: [] as string[],
        candidateCount: prunedRoomIds.length,
        unjoinGroupId: groupId,
        blockedReason: connected
          ? null
          : 'Selected rooms must touch or overlap to join',
      }
    }

    // Case C: single selected/active room + geometric neighbours.
    const joinTargetRoomId = selectedRoomId ?? activeRoomId
    if (!joinTargetRoomId || frames.length < 2) {
      return empty
    }
    const target = frames.find((f) => f.id === joinTargetRoomId)
    if (!target) return empty

    const targetGroupId = target.joinGroupId ?? null
    const neighbors = mixedNeighborsOf(
      { kind: 'room', id: target.id },
      frames,
      objects,
      DEFAULT_TOUCH_EPSILON_FT
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
      blockedReason:
        candidateCount > 0
          ? null
          : 'Move rooms flush together (within ~5px), then Join',
    }
  }, [
    store.doc.rooms,
    store.doc.objects,
    store.selectedIds,
    selectedRoomId,
    selectedRoomIds,
    activeRoomId,
  ])

  const joinedZoneCount = useMemo(() => {
    const frames = store.doc.rooms ?? []
    const groupIds = new Set<string>()
    for (const f of frames) {
      if (f.joinGroupId) groupIds.add(f.joinGroupId)
    }
    let count = 0
    for (const gid of groupIds) {
      if (frames.filter((f) => f.joinGroupId === gid).length >= 2) count++
    }
    return count
  }, [store.doc.rooms])

  const handleJoinRooms = useCallback(() => {
    if (!joinPlan.canJoin) {
      if (joinPlan.blockedReason) {
        toast.message(joinPlan.blockedReason, { duration: 2200 })
      }
      return
    }
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
    <div
      id="floor-plan-workspace"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden',
        canvasFullscreen &&
          !isDashboard &&
          'fixed inset-0 z-50 h-screen w-screen bg-stone-50 p-2 sm:p-3',
        className
      )}
    >
      {canvasFullscreen && !isDashboard ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-2">
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-stone-800"
            onClick={() => setCanvasFullscreen(false)}
          >
            Exit Full Screen
            <span className="text-[10px] font-normal text-stone-300">(Esc)</span>
          </button>
        </div>
      ) : null}
      {!isDashboard ? (
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200/80 bg-card/60 px-2 py-2 rounded-lg shrink-0">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold tracking-tight text-forest sm:text-lg">
            Layout tools
          </h2>
          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-stone-300 bg-white px-1 text-[10px] font-semibold">
              ]
            </kbd>{' '}
            toggle inspector ·{' '}
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
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden',
          isDashboard && 'min-h-[min(58vh,640px)]'
        )}
      >
        {!isDashboard ? (
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
            onRotateRoomLeft={handleRotateRoomLeft}
            onRotateRoomRight={handleRotateRoomRight}
            selectedRoomId={selectedRoomId}
            onAlignVertical={handleAlignVertical}
            onAlignHorizontal={handleAlignHorizontal}
            zoom={currentZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onCenterView={handleCenterView}
            onAutoArrange={handleAutoArrange}
            canAutoArrange={boothCount > 0}
            autoArrangeMode={autoArrangeMode}
            onAutoArrangeModeChange={setAutoArrangeMode}
            onAddPerimeterWalls={handleAddPerimeterWalls}
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
            tableSizeFt={tableSizePillValue}
            onTableSizeChange={handleTableSizeChange}
            rooms={onAddRoom && onRenameRoom && onDeleteRoom ? layoutRooms : undefined}
            activeRoomId={selectedRoomId ?? activeRoomId}
            onSelectRoom={handleSelectRoom}
            onAddRoom={onAddRoom}
            onRenameRoom={onRenameRoom}
            onDeleteRoom={onDeleteRoom}
            highlightedRoomMetrics={highlightedRoomMetrics}
            showLabels={showLabels}
            onShowLabelsChange={setShowLabels}
            canvasFullscreen={canvasFullscreen}
            onToggleCanvasFullscreen={() => setCanvasFullscreen((v) => !v)}
            onSaveMarket={onSaveMarket}
            saveMarketDisabled={saveMarketDisabled}
            saveMarketLoading={saveMarketLoading}
          />
        ) : null}

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 overflow-hidden',
            !isDashboard && 'gap-2'
          )}
        >
          <div
            className={cn(
              'relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-stone-200 bg-stone-100',
              isDashboard ? 'min-h-[280px]' : 'min-h-[280px] h-full'
            )}
          >
            <FloorPlanCanvas
              className="absolute inset-0"
              store={store}
              toolState={{ tool, drawShape }}
              defaultBoothTableLengthFt={defaultPlacementSizeFt}
              activeRoomId={activeRoomId}
              selectedRoomId={selectedRoomId}
              onRoomFrameClick={handleRoomFrameClick}
              onViewportReady={handleViewportReady}
              onZoomChange={setCurrentZoom}
              eventCategoryNames={eventCategoryNames}
              boothPlacementStatusByObjectId={boothPlacementStatusByObjectId}
              onVendorDrop={onVendorDrop}
              autoArrangeMode={autoArrangeMode}
              onProximityViolation={(info) => {
                toast.error(
                  `Same-category booths must be at least 5 columns or 2 rows apart — "${info.category}" placement reverted.`,
                  { duration: 2400 }
                )
              }}
              onOverlapViolation={() => {
                toast.error(
                  'Objects cannot overlap — move the selection so it clears other fixtures, then try again.',
                  { duration: 2400 }
                )
              }}
              onRoomCanvasLimitBlocked={() => {
                toast.message(
                  'Canvas limit reached — rooms cannot extend beyond 5× the primary room dimensions.',
                  { duration: 2200 }
                )
              }}
              showLabels={showLabels}
            />
            <CanvasLegend />
          </div>

          {!isDashboard ? (
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
          ) : null}
        </div>

        {isDashboard ? (
        <CanvasCommandBar
          className="max-h-28 shrink-0 overflow-y-auto scrollbar-none"
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
          onRotateRoomLeft={handleRotateRoomLeft}
          onRotateRoomRight={handleRotateRoomRight}
          selectedRoomId={selectedRoomId}
          onAlignVertical={handleAlignVertical}
          onAlignHorizontal={handleAlignHorizontal}
          zoom={currentZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onCenterView={handleCenterView}
          onAutoArrange={handleAutoArrange}
          canAutoArrange={boothCount > 0}
          autoArrangeMode={autoArrangeMode}
          onAutoArrangeModeChange={setAutoArrangeMode}
          onAddPerimeterWalls={handleAddPerimeterWalls}
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
          tableSizeFt={tableSizePillValue}
          onTableSizeChange={handleTableSizeChange}
          rooms={onAddRoom && onRenameRoom && onDeleteRoom ? layoutRooms : undefined}
          activeRoomId={selectedRoomId ?? activeRoomId}
          onSelectRoom={handleSelectRoom}
          onAddRoom={onAddRoom}
          onRenameRoom={onRenameRoom}
          onDeleteRoom={onDeleteRoom}
          highlightedRoomMetrics={highlightedRoomMetrics}
          showLabels={showLabels}
          onShowLabelsChange={setShowLabels}
          canvasFullscreen={canvasFullscreen}
          onToggleCanvasFullscreen={() => setCanvasFullscreen((v) => !v)}
          onSaveMarket={onSaveMarket}
          saveMarketDisabled={saveMarketDisabled}
          saveMarketLoading={saveMarketLoading}
        />
        ) : null}
      </div>
    </div>
  )
}
