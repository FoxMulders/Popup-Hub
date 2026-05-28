'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FloorPlanDoc, PlacedObject } from './types'

/**
 * useFloorPlanDoc — pure state hook for a v2 floor plan document.
 *
 * What it does:
 * - Owns `doc`, `selectedIds`, and an undo/redo stack.
 * - Exposes immutable update primitives: addObject, updateObject,
 *   removeObjects, replaceObjects, setSelection.
 *
 * What it deliberately does NOT do:
 * - No automatic preset application.
 * - No capacity clamping. The document is allowed to hold any number of
 *   objects of any size at any position.
 * - No structural template painting in response to interaction.
 * - No "blank slate preset rule" or any analogous behavior — the doc is
 *   exactly what the user has put into it, nothing more.
 *
 * History snapshots are pushed eagerly (`pushHistory: true` on every
 * mutating call). Tools that perform a continuous gesture (drag-to-draw,
 * drag-to-move) should pass `pushHistory: false` for intermediate frames
 * and `true` for the commit step.
 */

const HISTORY_LIMIT = 50

interface DocHistory {
  past: FloorPlanDoc[]
  future: FloorPlanDoc[]
}

export interface FloorPlanDocStore {
  doc: FloorPlanDoc
  selectedIds: ReadonlySet<string>
  canUndo: boolean
  canRedo: boolean

  /** Replace the entire document (resets selection + history). */
  resetDoc: (next: FloorPlanDoc) => void

  /**
   * Append one object. Returns the appended object's id.
   *
   * `roomId` (multi-room canvas) tags the new object with its parent
   * `LayoutRoom`. The mapping is folded into the same commit as the
   * object insert so a single undo step clears both the new object
   * and its room association.
   */
  addObject: (
    obj: PlacedObject,
    options?: { pushHistory?: boolean; select?: boolean; roomId?: string }
  ) => string

  /**
   * Append multiple objects in a single immutable pass with one history
   * entry. Used by paste (and any future bulk-create flow) so undo
   * rolls back the entire group atomically. `roomId` applies the same
   * parent-room association to every appended object.
   */
  addObjects: (
    objs: ReadonlyArray<PlacedObject>,
    options?: { pushHistory?: boolean; select?: boolean; roomId?: string }
  ) => string[]

  /** Patch a single object by id. */
  updateObject: (
    id: string,
    patch: Partial<PlacedObject>,
    options?: { pushHistory?: boolean }
  ) => void

  /** Patch multiple objects in one immutable pass. */
  updateObjects: (
    patches: Array<{ id: string; patch: Partial<PlacedObject> }>,
    options?: { pushHistory?: boolean }
  ) => void

  /** Remove zero or more objects by id. Clears selection on those ids. */
  removeObjects: (
    ids: ReadonlyArray<string>,
    options?: { pushHistory?: boolean }
  ) => void

  /** Replace the full object list (used by "clear all"). */
  replaceObjects: (
    next: PlacedObject[],
    options?: { pushHistory?: boolean }
  ) => void

  /** Patch top-level document fields (canvas extents, grid, snap). */
  patchDoc: (
    patch: Partial<Omit<FloorPlanDoc, 'objects'>>,
    options?: { pushHistory?: boolean }
  ) => void

  /**
   * Translate a room frame and every object tagged with that room id
   * by `(dx, dy)` in a single immutable pass with one history entry.
   * Used by the macro-level room drag in the multi-room canvas — undo
   * restores both the room origin and the child positions atomically.
   * The unified canvas extents are recomputed from the new room union
   * so the visible frame keeps hugging the rightmost / bottommost
   * corner.
   */
  moveRoomFrame: (
    roomId: string,
    dx: number,
    dy: number,
    options?: { pushHistory?: boolean }
  ) => void

  /**
   * Fuse a list of room frames into a single dissolved zone. Every
   * listed frame is tagged with a freshly minted `joinGroupId` (or
   * an existing group id when one of the frames is already part of
   * a group — the new members fold into the existing group). One
   * history entry covers the entire merge so a single Ctrl+Z undoes
   * the join.
   *
   * Returns the resulting `joinGroupId`, or `null` when no frames
   * matched (defensive — a no-op shouldn't push history).
   */
  joinRooms: (
    roomIds: ReadonlyArray<string>,
    options?: { pushHistory?: boolean }
  ) => string | null

  /**
   * Reverse of `joinRooms`: clears the `joinGroupId` from every
   * member of the named group so each room reverts to a standalone
   * frame.
   */
  unjoinRooms: (
    groupId: string,
    options?: { pushHistory?: boolean }
  ) => void

  setSelection: (ids: Iterable<string>) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void

  undo: () => void
  redo: () => void
}

export function useFloorPlanDoc(initial: FloorPlanDoc): FloorPlanDocStore {
  const [doc, setDoc] = useState<FloorPlanDoc>(initial)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [history, setHistory] = useState<DocHistory>({ past: [], future: [] })

  // Mirror `doc` into a ref so callbacks see the latest value without
  // re-binding on every change. Written from an effect so we don't
  // mutate refs during render.
  const docRef = useRef(doc)
  useEffect(() => {
    docRef.current = doc
  }, [doc])

  const pushPast = useCallback((prev: FloorPlanDoc) => {
    setHistory((h) => {
      const past = [...h.past, prev]
      if (past.length > HISTORY_LIMIT) past.shift()
      return { past, future: [] }
    })
  }, [])

  const commit = useCallback(
    (next: FloorPlanDoc, pushHistory: boolean) => {
      if (pushHistory) pushPast(docRef.current)
      setDoc(next)
    },
    [pushPast]
  )

  const resetDoc = useCallback((next: FloorPlanDoc) => {
    setDoc(next)
    setSelectedIds(new Set())
    setHistory({ past: [], future: [] })
  }, [])

  const addObject = useCallback<FloorPlanDocStore['addObject']>(
    (obj, options) => {
      const pushHistory = options?.pushHistory ?? true
      const select = options?.select ?? false
      const roomId = options?.roomId
      const current = docRef.current
      const next: FloorPlanDoc = {
        ...current,
        objects: [...current.objects, obj],
        objectRoom: roomId
          ? { ...(current.objectRoom ?? {}), [obj.id]: roomId }
          : current.objectRoom,
      }
      commit(next, pushHistory)
      if (select) setSelectedIds(new Set([obj.id]))
      return obj.id
    },
    [commit]
  )

  const addObjects = useCallback<FloorPlanDocStore['addObjects']>(
    (objs, options) => {
      if (objs.length === 0) return []
      const pushHistory = options?.pushHistory ?? true
      const select = options?.select ?? false
      const roomId = options?.roomId
      const ids = objs.map((o) => o.id)
      const current = docRef.current
      let nextObjectRoom = current.objectRoom
      if (roomId) {
        nextObjectRoom = { ...(current.objectRoom ?? {}) }
        for (const id of ids) nextObjectRoom[id] = roomId
      }
      const next: FloorPlanDoc = {
        ...current,
        objects: [...current.objects, ...objs],
        objectRoom: nextObjectRoom,
      }
      commit(next, pushHistory)
      if (select) setSelectedIds(new Set(ids))
      return ids
    },
    [commit]
  )

  const updateObject = useCallback<FloorPlanDocStore['updateObject']>(
    (id, patch, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      let mutated = false
      const objects = current.objects.map((o) => {
        if (o.id !== id) return o
        mutated = true
        return { ...o, ...patch } as PlacedObject
      })
      if (!mutated) return
      commit({ ...current, objects }, pushHistory)
    },
    [commit]
  )

  const updateObjects = useCallback<FloorPlanDocStore['updateObjects']>(
    (patches, options) => {
      const pushHistory = options?.pushHistory ?? true
      if (patches.length === 0) return
      const patchById = new Map(patches.map((p) => [p.id, p.patch]))
      const current = docRef.current
      let mutated = false
      const objects = current.objects.map((o) => {
        const patch = patchById.get(o.id)
        if (!patch) return o
        mutated = true
        return { ...o, ...patch } as PlacedObject
      })
      if (!mutated) return
      commit({ ...current, objects }, pushHistory)
    },
    [commit]
  )

  const removeObjects = useCallback<FloorPlanDocStore['removeObjects']>(
    (ids, options) => {
      const pushHistory = options?.pushHistory ?? true
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const current = docRef.current
      const objects = current.objects.filter((o) => !idSet.has(o.id))
      if (objects.length === current.objects.length) return
      // Drop the doomed ids from the room sidecar so the map doesn't
      // grow unbounded with stale entries every delete cycle.
      let nextObjectRoom = current.objectRoom
      if (current.objectRoom) {
        nextObjectRoom = { ...current.objectRoom }
        for (const id of ids) delete nextObjectRoom[id]
      }
      commit({ ...current, objects, objectRoom: nextObjectRoom }, pushHistory)
      setSelectedIds((prev) => {
        let changed = false
        const next = new Set(prev)
        for (const id of ids) {
          if (next.delete(id)) changed = true
        }
        return changed ? next : prev
      })
    },
    [commit]
  )

  const replaceObjects = useCallback<FloorPlanDocStore['replaceObjects']>(
    (objects, options) => {
      const pushHistory = options?.pushHistory ?? true
      commit({ ...docRef.current, objects }, pushHistory)
      setSelectedIds(new Set())
    },
    [commit]
  )

  const patchDoc = useCallback<FloorPlanDocStore['patchDoc']>(
    (patch, options) => {
      const pushHistory = options?.pushHistory ?? true
      commit({ ...docRef.current, ...patch }, pushHistory)
    },
    [commit]
  )

  const moveRoomFrame = useCallback<FloorPlanDocStore['moveRoomFrame']>(
    (roomId, dx, dy, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      const frames = current.rooms ?? []
      if (frames.length === 0) return
      if (dx === 0 && dy === 0) return
      const objectRoom = current.objectRoom ?? {}

      const nextFrames = frames.map((f) =>
        f.id === roomId
          ? { ...f, originX: f.originX + dx, originY: f.originY + dy }
          : f
      )
      const nextObjects = current.objects.map((o) => {
        if (objectRoom[o.id] !== roomId) return o
        return { ...o, x: o.x + dx, y: o.y + dy } as PlacedObject
      })

      // Recompute the unified canvas extents from the new frame union
      // so the visible canvas always ends at the far-right / bottom of
      // the rightmost room.
      let maxX = 0
      let maxY = 0
      for (const f of nextFrames) {
        const right = Math.max(0, f.originX) + f.widthFt
        const bottom = Math.max(0, f.originY) + f.lengthFt
        if (right > maxX) maxX = right
        if (bottom > maxY) maxY = bottom
      }

      commit(
        {
          ...current,
          objects: nextObjects,
          rooms: nextFrames,
          canvasWidthFt: Math.max(maxX, current.canvasWidthFt),
          canvasLengthFt: Math.max(maxY, current.canvasLengthFt),
        },
        pushHistory
      )
    },
    [commit]
  )

  const joinRooms = useCallback<FloorPlanDocStore['joinRooms']>(
    (roomIds, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      const frames = current.rooms ?? []
      if (frames.length === 0 || roomIds.length < 2) return null
      const wantedIds = new Set(roomIds)
      const targets = frames.filter((f) => wantedIds.has(f.id))
      if (targets.length < 2) return null

      // If any of the target frames is already part of a join group,
      // fold the new members into the existing group rather than
      // minting a fresh id. When multiple groups intersect the
      // target set we collapse them all into one — the user just
      // declared they should all be a single zone.
      const existingGroupIds = new Set<string>()
      for (const f of targets) {
        if (f.joinGroupId) existingGroupIds.add(f.joinGroupId)
      }
      const groupId =
        existingGroupIds.size > 0
          ? existingGroupIds.values().next().value!
          : `join-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

      // Promote all members of the original groups + the freshly
      // selected frames into the resolved group id.
      const memberIds = new Set<string>(roomIds)
      for (const f of frames) {
        if (f.joinGroupId && existingGroupIds.has(f.joinGroupId)) {
          memberIds.add(f.id)
        }
      }

      let mutated = false
      const nextFrames = frames.map((f) => {
        if (!memberIds.has(f.id)) return f
        if (f.joinGroupId === groupId) return f
        mutated = true
        return { ...f, joinGroupId: groupId }
      })
      if (!mutated) return groupId
      commit({ ...current, rooms: nextFrames }, pushHistory)
      return groupId
    },
    [commit]
  )

  const unjoinRooms = useCallback<FloorPlanDocStore['unjoinRooms']>(
    (groupId, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      const frames = current.rooms ?? []
      if (frames.length === 0) return
      let mutated = false
      const nextFrames = frames.map((f) => {
        if (f.joinGroupId !== groupId) return f
        mutated = true
        const { joinGroupId: _drop, ...rest } = f
        void _drop
        return rest
      })
      if (!mutated) return
      commit({ ...current, rooms: nextFrames }, pushHistory)
    },
    [commit]
  )

  const setSelection = useCallback((ids: Iterable<string>) => {
    setSelectedIds(new Set(ids))
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()))
  }, [])

  /**
   * Drop any ids from `selectedIds` that no longer correspond to an
   * object in the restored doc. Without this, an undo that removes a
   * just-pasted object would leave its id in `selectedIds`, and the
   * "N selected" toolbar counter / property inspector would point at
   * a ghost. Pure helper so it can be reused by both undo and redo.
   */
  const pruneStaleSelection = useCallback((restored: FloorPlanDoc) => {
    const validIds = new Set(restored.objects.map((o) => o.id))
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (validIds.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      const past = [...h.past]
      const previous = past.pop() as FloorPlanDoc
      const future = [docRef.current, ...h.future]
      setDoc(previous)
      pruneStaleSelection(previous)
      return { past, future }
    })
  }, [pruneStaleSelection])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const [next, ...rest] = h.future
      const past = [...h.past, docRef.current]
      setDoc(next)
      pruneStaleSelection(next)
      return { past, future: rest }
    })
  }, [pruneStaleSelection])

  return useMemo<FloorPlanDocStore>(
    () => ({
      doc,
      selectedIds,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      resetDoc,
      addObject,
      addObjects,
      updateObject,
      updateObjects,
      removeObjects,
      replaceObjects,
      patchDoc,
      moveRoomFrame,
      joinRooms,
      unjoinRooms,
      setSelection,
      toggleSelection,
      clearSelection,
      undo,
      redo,
    }),
    [
      doc,
      selectedIds,
      history.past.length,
      history.future.length,
      resetDoc,
      addObject,
      addObjects,
      updateObject,
      updateObjects,
      removeObjects,
      replaceObjects,
      patchDoc,
      moveRoomFrame,
      joinRooms,
      unjoinRooms,
      setSelection,
      toggleSelection,
      clearSelection,
      undo,
      redo,
    ]
  )
}
