'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampRoomMoveDelta,
  clampRoomResizePatch,
  canvasDimensionLimits,
  reconcileCanvasExtents,
  roomUnionBounds,
  type RoomResizePatch,
} from './room-canvas'
import {
  finalizeDocGeometry,
  rotateRoomContentsAroundPivot,
  rotateRoomFrameAroundPivot,
  roomRotationPivot,
} from './placement-surface'
import {
  reconcileRoomPerimeterChildren,
  stripMacroPerimeterWallsFromDoc,
  transformObjectsOnRoomResize,
} from '../interactions/room-perimeter-sync'
import type { BoothObject, FloorPlanDoc, PlacedObject } from './types'
import { applyBoothObjectPatch } from './table-cluster-layout'
import { mergeUnionSelectionInDoc } from './merge-selection-union'
import {
  clearDestructiveMergeInDoc,
  destructiveMergeInDoc,
} from './destructive-merge'
import { ensureCanvasHasPlaceableRoom } from '../canvas/canvas-engine'

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
  ) => boolean

  /**
   * Resize a room frame (origin + width/length). Child objects keep
   * their global coords. Returns false only when no frames exist.
   */
  resizeRoomFrame: (
    roomId: string,
    patch: RoomResizePatch,
    options?: { pushHistory?: boolean }
  ) => boolean

  /**
   * Rotate a room frame 90° around its center and spin every object
   * tagged with that room (skipping locked). One history entry covers
   * the frame + child positions. Returns false when the room is
   * missing or the rotated union would exceed canvas limits.
   */
  rotateRoomFrame: (
    roomId: string,
    direction: 'cw' | 'ccw',
    options?: { pushHistory?: boolean }
  ) => FloorPlanDoc | null

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
   * Mixed-target join: fuse rooms AND joinable `PlacedObject`s
   * (e.g. an outdoor stage that overlaps a perimeter wall) into a
   * single dissolved zone. The store does not enforce the
   * "joinable kind" rule — callers must pre-filter with
   * `isJoinableObject` from `state/room-joins.ts` so booths, walls,
   * and other generic floor assets are never included.
   *
   * One history entry covers the entire commit so a single Ctrl+Z
   * undoes both the room and object group assignments atomically.
   *
   * Returns the resulting `joinGroupId`, or `null` when fewer than
   * two participants were resolved (no-op).
   */
  joinSelection: (
    selection: {
      roomIds?: ReadonlyArray<string>
      objectIds?: ReadonlyArray<string>
    },
    options?: { pushHistory?: boolean }
  ) => string | null

  /**
   * Reverse of `joinRooms`: clears the `joinGroupId` from every
   * member of the named group so each room reverts to a standalone
   * frame. Also clears the field from any `PlacedObject` that was
   * annexed into the same group (mixed-type unjoin).
   */
  unjoinRooms: (
    groupId: string,
    options?: { pushHistory?: boolean }
  ) => void

  /**
   * Boolean Merge: replace 2+ selected architectural shapes with one
   * `merged_zone` path (union perimeter, interior edges removed).
   */
  mergeUnionSelection: (
    objectIds: ReadonlyArray<string>,
    options?: { pushHistory?: boolean; select?: boolean }
  ) => { mergedId: string | null; reason?: string }

  /**
   * Boolean union for rooms + stages: one `merged_zone` path, originals
   * hidden/removed from the canvas.
   */
  destructiveMerge: (
    selection: {
      roomIds?: ReadonlyArray<string>
      objectIds?: ReadonlyArray<string>
    },
    options?: { pushHistory?: boolean; select?: boolean }
  ) => { mergedId: string | null; reason?: string }

  splitDestructiveMerge: (
    mergedObjectId: string,
    options?: { pushHistory?: boolean }
  ) => void

  setSelection: (ids: Iterable<string>) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void

  undo: () => void
  redo: () => void
}

export function useFloorPlanDoc(initial: FloorPlanDoc): FloorPlanDocStore {
  const [doc, setDoc] = useState<FloorPlanDoc>(() =>
    stripMacroPerimeterWallsFromDoc(initial)
  )
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
      docRef.current = next
      setDoc(next)
    },
    [pushPast]
  )

  const resetDoc = useCallback((next: FloorPlanDoc) => {
    setDoc(stripMacroPerimeterWallsFromDoc(next))
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
        if (o.kind === 'booth') {
          return applyBoothObjectPatch(o as BoothObject, patch as Partial<BoothObject>)
        }
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
        if (o.kind === 'booth') {
          return applyBoothObjectPatch(
            o as BoothObject,
            patch as Partial<BoothObject>
          )
        }
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
      let next: FloorPlanDoc = { ...docRef.current, ...patch }
      if (patch.rooms !== undefined || (next.rooms ?? []).length === 0) {
        next = ensureCanvasHasPlaceableRoom(next)
      }
      commit(next, pushHistory)
    },
    [commit]
  )

  const moveRoomFrame = useCallback<FloorPlanDocStore['moveRoomFrame']>(
    (roomId, dx, dy, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      const frames = current.rooms ?? []
      if (frames.length === 0) return false
      if (dx === 0 && dy === 0) return true

      const { dx: clampedDx, dy: clampedDy } = clampRoomMoveDelta(
        frames,
        roomId,
        dx,
        dy,
        {
          canvasWidthFt: current.canvasWidthFt,
          canvasLengthFt: current.canvasLengthFt,
        }
      )
      if (clampedDx === 0 && clampedDy === 0) return false

      const anchor = frames.find((f) => f.id === roomId)
      if (!anchor) return false

      const mergeId = anchor.mergedIntoObjectId
      const groupId = anchor.joinGroupId
      const movingRoomIds = new Set(
        mergeId
          ? frames
              .filter((f) => f.mergedIntoObjectId === mergeId)
              .map((f) => f.id)
          : groupId
            ? frames.filter((f) => f.joinGroupId === groupId).map((f) => f.id)
            : [roomId]
      )

      const objectRoom = current.objectRoom ?? {}
      const nextFrames = frames.map((f) =>
        movingRoomIds.has(f.id)
          ? {
              ...f,
              originX: f.originX + clampedDx,
              originY: f.originY + clampedDy,
            }
          : f
      )
      let nextObjects = current.objects.map((o) => {
        const ownerRoom = objectRoom[o.id]
        if (!ownerRoom || !movingRoomIds.has(ownerRoom)) return o
        return {
          ...o,
          x: o.x + clampedDx,
          y: o.y + clampedDy,
        } as PlacedObject
      })
      if (mergeId) {
        nextObjects = nextObjects.map((o) =>
          o.id === mergeId
            ? { ...o, x: o.x + clampedDx, y: o.y + clampedDy }
            : o
        ) as PlacedObject[]
      }
      const extents = reconcileCanvasExtents(
        nextFrames,
        undefined,
        nextObjects
      )

      let nextDoc: FloorPlanDoc = {
        ...current,
        objects: nextObjects,
        rooms: nextFrames,
        canvasWidthFt: extents.canvasWidthFt,
        canvasLengthFt: extents.canvasLengthFt,
      }
      for (const id of movingRoomIds) {
        nextDoc = reconcileRoomPerimeterChildren(nextDoc, id)
      }

      commit(nextDoc, pushHistory)
      return true
    },
    [commit]
  )

  const resizeRoomFrame = useCallback<FloorPlanDocStore['resizeRoomFrame']>(
    (roomId, patch, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      const frames = current.rooms ?? []
      if (frames.length === 0) return false

      const oldFrame = frames.find((f) => f.id === roomId)
      if (!oldFrame) return false

      const clamped = clampRoomResizePatch(frames, roomId, patch, {
        canvasWidthFt: current.canvasWidthFt,
        canvasLengthFt: current.canvasLengthFt,
      })
      const nextFrame = { ...oldFrame, ...clamped }

      const nextFrames = frames.map((f) => (f.id === roomId ? nextFrame : f))
      const objectRoom = current.objectRoom ?? {}
      const nextObjects = transformObjectsOnRoomResize(
        current.objects,
        objectRoom,
        roomId,
        oldFrame,
        nextFrame
      )
      const extents = reconcileCanvasExtents(nextFrames, undefined, nextObjects)

      const nextDoc = reconcileRoomPerimeterChildren(
        {
          ...current,
          objects: nextObjects,
          rooms: nextFrames,
          canvasWidthFt: extents.canvasWidthFt,
          canvasLengthFt: extents.canvasLengthFt,
        },
        roomId
      )

      commit(nextDoc, pushHistory)
      return true
    },
    [commit]
  )

  const rotateRoomFrame = useCallback<FloorPlanDocStore['rotateRoomFrame']>(
    (roomId, direction, options) => {
      const pushHistory = options?.pushHistory ?? true
      let working = docRef.current
      const frames = working.rooms ?? []
      const anchor = frames.find((f) => f.id === roomId)
      if (!anchor) return null

      const groupId = anchor.joinGroupId
      const rotatingIds = groupId
        ? frames.filter((f) => f.joinGroupId === groupId).map((f) => f.id)
        : [roomId]

      for (const id of rotatingIds) {
        const frame = (working.rooms ?? []).find((f) => f.id === id)
        if (!frame) continue

        const pivot = roomRotationPivot(working, id)
        const rotatedFrame = rotateRoomFrameAroundPivot(frame, pivot, direction)
        const nextFrames = (working.rooms ?? []).map((f) =>
          f.id === id ? rotatedFrame : f
        )
        const nextObjects = rotateRoomContentsAroundPivot(
          working,
          id,
          pivot,
          direction
        )

        working = finalizeDocGeometry({
          ...working,
          objects: nextObjects,
          rooms: nextFrames,
        })
      }

      commit(working, pushHistory)
      return working
    },
    [commit]
  )

  const joinSelection = useCallback<FloorPlanDocStore['joinSelection']>(
    (selection, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      const frames = current.rooms ?? []
      const objects = current.objects ?? []

      const wantedRoomIds = new Set(selection.roomIds ?? [])
      const wantedObjectIds = new Set(selection.objectIds ?? [])

      const targetFrames = frames.filter((f) => wantedRoomIds.has(f.id))
      const targetObjects = objects.filter((o) => wantedObjectIds.has(o.id))
      const totalTargets = targetFrames.length + targetObjects.length
      if (totalTargets < 2) return null

      // Existing-group fold: if any participant (room or object) is
      // already in a join group, prefer that group id so the action
      // is idempotent. Multiple intersecting groups are collapsed
      // into one — the user just declared all of these should be a
      // single zone.
      const existingGroupIds = new Set<string>()
      for (const f of targetFrames) {
        if (f.joinGroupId) existingGroupIds.add(f.joinGroupId)
      }
      for (const o of targetObjects) {
        if (o.joinGroupId) existingGroupIds.add(o.joinGroupId)
      }
      const groupId =
        existingGroupIds.size > 0
          ? existingGroupIds.values().next().value!
          : `join-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

      // Promote all members of any folded-in groups so the merge is
      // transitive — joining A+B when B was already part of {B,C}
      // produces {A,B,C}, not {A,B}+{B,C}.
      const memberRoomIds = new Set<string>(wantedRoomIds)
      const memberObjectIds = new Set<string>(wantedObjectIds)
      for (const f of frames) {
        if (f.joinGroupId && existingGroupIds.has(f.joinGroupId)) {
          memberRoomIds.add(f.id)
        }
      }
      for (const o of objects) {
        if (o.joinGroupId && existingGroupIds.has(o.joinGroupId)) {
          memberObjectIds.add(o.id)
        }
      }

      let mutated = false
      const nextFrames = frames.map((f) => {
        if (!memberRoomIds.has(f.id)) return f
        if (f.joinGroupId === groupId) return f
        mutated = true
        return { ...f, joinGroupId: groupId }
      })
      const nextObjects = objects.map((o) => {
        if (!memberObjectIds.has(o.id)) return o
        if (o.joinGroupId === groupId) return o
        mutated = true
        return { ...o, joinGroupId: groupId } as typeof o
      })
      if (!mutated) return groupId
      commit({ ...current, rooms: nextFrames, objects: nextObjects }, pushHistory)
      return groupId
    },
    [commit]
  )

  const joinRooms = useCallback<FloorPlanDocStore['joinRooms']>(
    (roomIds, options) => {
      // Thin wrapper preserved for backward compatibility — the
      // mixed-target `joinSelection` path is the source of truth.
      if (roomIds.length < 2) return null
      return joinSelection({ roomIds }, options)
    },
    [joinSelection]
  )

  const unjoinRooms = useCallback<FloorPlanDocStore['unjoinRooms']>(
    (groupId, options) => {
      const pushHistory = options?.pushHistory ?? true
      const current = docRef.current
      const frames = current.rooms ?? []
      const objects = current.objects ?? []
      let mutated = false

      const nextFrames = frames.map((f) => {
        if (f.joinGroupId !== groupId) return f
        mutated = true
        const { joinGroupId: _drop, ...rest } = f
        void _drop
        return rest
      })

      // Mixed-type unjoin: also strip `joinGroupId` from any
      // `PlacedObject` that was annexed into this group (e.g. an
      // outdoor stage joined to the Main Hall).
      const nextObjects = objects.map((o) => {
        if (o.joinGroupId !== groupId) return o
        mutated = true
        const { joinGroupId: _drop, ...rest } = o
        void _drop
        return rest as typeof o
      })

      if (!mutated) return
      commit({ ...current, rooms: nextFrames, objects: nextObjects }, pushHistory)
    },
    [commit]
  )

  const mergeUnionSelection = useCallback<FloorPlanDocStore['mergeUnionSelection']>(
    (objectIds, options) => {
      const pushHistory = options?.pushHistory ?? true
      const select = options?.select ?? true
      const { doc: next, mergedId, reason } = mergeUnionSelectionInDoc(
        docRef.current,
        objectIds
      )
      if (!mergedId) return { mergedId: null, reason }
      commit(next, pushHistory)
      if (select) setSelectedIds(new Set([mergedId]))
      return { mergedId }
    },
    [commit]
  )

  const destructiveMerge = useCallback<FloorPlanDocStore['destructiveMerge']>(
    (selection, options) => {
      const pushHistory = options?.pushHistory ?? true
      const select = options?.select ?? true
      const { doc: next, mergedId, reason } = destructiveMergeInDoc(
        docRef.current,
        selection
      )
      if (!mergedId) return { mergedId: null, reason }
      commit(finalizeDocGeometry(next), pushHistory)
      if (select) setSelectedIds(new Set([mergedId]))
      return { mergedId }
    },
    [commit]
  )

  const splitDestructiveMerge = useCallback<
    FloorPlanDocStore['splitDestructiveMerge']
  >(
    (mergedObjectId, options) => {
      const pushHistory = options?.pushHistory ?? true
      const next = clearDestructiveMergeInDoc(docRef.current, mergedObjectId)
      commit(next, pushHistory)
      setSelectedIds(new Set())
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
      resizeRoomFrame,
      rotateRoomFrame,
      joinRooms,
      joinSelection,
      unjoinRooms,
      mergeUnionSelection,
      destructiveMerge,
      splitDestructiveMerge,
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
      resizeRoomFrame,
      rotateRoomFrame,
      joinRooms,
      joinSelection,
      unjoinRooms,
      mergeUnionSelection,
      destructiveMerge,
      splitDestructiveMerge,
      setSelection,
      toggleSelection,
      clearSelection,
      undo,
      redo,
    ]
  )
}
