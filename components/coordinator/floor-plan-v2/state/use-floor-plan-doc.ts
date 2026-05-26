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

  /** Append one object. Returns the appended object's id. */
  addObject: (
    obj: PlacedObject,
    options?: { pushHistory?: boolean; select?: boolean }
  ) => string

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
      const next: FloorPlanDoc = {
        ...docRef.current,
        objects: [...docRef.current.objects, obj],
      }
      commit(next, pushHistory)
      if (select) setSelectedIds(new Set([obj.id]))
      return obj.id
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
      commit({ ...current, objects }, pushHistory)
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

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      const past = [...h.past]
      const previous = past.pop() as FloorPlanDoc
      const future = [docRef.current, ...h.future]
      setDoc(previous)
      return { past, future }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const [next, ...rest] = h.future
      const past = [...h.past, docRef.current]
      setDoc(next)
      return { past, future: rest }
    })
  }, [])

  return useMemo<FloorPlanDocStore>(
    () => ({
      doc,
      selectedIds,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      resetDoc,
      addObject,
      updateObject,
      updateObjects,
      removeObjects,
      replaceObjects,
      patchDoc,
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
      updateObject,
      updateObjects,
      removeObjects,
      replaceObjects,
      patchDoc,
      setSelection,
      toggleSelection,
      clearSelection,
      undo,
      redo,
    ]
  )
}
