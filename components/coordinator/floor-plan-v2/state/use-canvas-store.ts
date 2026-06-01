'use client'

/**
 * Unified canvas store — doc.rooms geometry, placement validation, reset, logging.
 */

import { useCallback, useEffect, useMemo } from 'react'
import { activeRoomFrames } from '../canvas/canvas-engine'
import {
  ensureCanvasHasPlaceableRoom,
  makeDefaultMainHallFrame,
} from './canvas-init'
import {
  getSuppressAutoMainHall,
  setSuppressAutoMainHall,
} from './canvas-session-guards'
import { forceRecomputeGeometry, isValidPlacementLocation } from './use-floor-plan-doc'
import { useDebugLog } from '../debug/debug-log-context'
import { serializeRooms } from '../debug/format-geometry-log'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from './types'
import {
  useFloorPlanDoc,
  type FloorPlanDocStore,
} from './use-floor-plan-doc'

function roomsGeometryValid(rooms: RoomFrame[] | undefined): boolean {
  if (!rooms || rooms.length === 0) return false
  return rooms.every(
    (r) =>
      Number.isFinite(r.originX) &&
      Number.isFinite(r.originY) &&
      r.widthFt > 0 &&
      r.lengthFt > 0
  )
}

function buildMainHallDoc(base: FloorPlanDoc): FloorPlanDoc {
  const hall = makeDefaultMainHallFrame()
  return forceRecomputeGeometry(
    ensureCanvasHasPlaceableRoom({
      ...base,
      rooms: [hall],
      objects: [],
      objectRoom: {},
    })
  )
}

export interface CanvasStore extends FloorPlanDocStore {
  /** Active, non-ghost room frames from `doc.rooms`. */
  rooms: RoomFrame[]
  /** Append a timestamped line to the geometry debug console. */
  logState: (message: string) => void
  /** Ray-cast placement gate (inside room polygon only). */
  validatePlacement: (
    probeFt: { x: number; y: number },
    obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
  ) => boolean
  /**
   * Hard reset — clears `rooms`, `objects`, and `objectRoom`.
   * Sets a session flag so auto Main Hall injection stays off until reload.
   */
  resetState: () => void
  /** Bootstrap a default 50×50′ Main Hall (auto-init only). */
  seedMainHall: () => void
}

export interface UseCanvasStoreOptions {
  disableAutoMainHall?: boolean
  eventId?: string
}

export function useCanvasStore(
  initial: FloorPlanDoc,
  options?: UseCanvasStoreOptions
): CanvasStore {
  const disableAutoMainHall = options?.disableAutoMainHall ?? false
  const eventId = options?.eventId
  const store = useFloorPlanDoc(forceRecomputeGeometry(initial), {
    disableAutoMainHall,
    eventId,
  })
  const { addLog } = useDebugLog()

  const logState = useCallback(
    (message: string) => {
      addLog(message)
    },
    [addLog]
  )

  const rooms = useMemo(() => activeRoomFrames(store.doc), [store.doc])

  const validatePlacement = useCallback(
    (
      probeFt: { x: number; y: number },
      obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
    ) => isValidPlacementLocation(store.doc, probeFt, obj),
    [store.doc]
  )

  const resetState = useCallback(() => {
    setSuppressAutoMainHall(true)
    logState('resetState(): hard clear — rooms[], objects[], objectRoom{}')
    const next: FloorPlanDoc = forceRecomputeGeometry({
      ...store.doc,
      rooms: [],
      objects: [],
      objectRoom: {},
    })
    store.resetDoc(next)
    logState('resetState() complete: blank canvas (auto Main Hall suppressed)')
  }, [eventId, logState, store])

  const seedMainHall = useCallback(() => {
    logState('seedMainHall(): injecting default 50×50′ Main Hall')
    const next = buildMainHallDoc(store.doc)
    store.resetDoc(next)
    logState(`seedMainHall() complete: ${serializeRooms(next)}`)
  }, [logState, store])

  useEffect(() => {
    if (disableAutoMainHall || getSuppressAutoMainHall(eventId)) return
    if (activeRoomFrames(store.doc).length === 0) {
      logState('doc.rooms empty on load — seedMainHall()')
      seedMainHall()
      return
    }
    if (!roomsGeometryValid(store.doc.rooms)) {
      logState('Invalid doc.rooms on load — seedMainHall()')
      seedMainHall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (disableAutoMainHall || getSuppressAutoMainHall(eventId)) return
    const active = activeRoomFrames(store.doc)
    if (active.length === 0) {
      logState('doc.rooms became empty — seedMainHall()')
      seedMainHall()
    } else if (!roomsGeometryValid(active)) {
      logState('Invalid doc.rooms detected — seedMainHall()')
      seedMainHall()
    }
  }, [logState, seedMainHall, store.doc])

  return {
    ...store,
    rooms,
    logState,
    validatePlacement,
    resetState,
    seedMainHall,
  }
}
