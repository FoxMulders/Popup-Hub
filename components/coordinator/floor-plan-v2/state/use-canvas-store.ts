'use client'

/**
 * Unified canvas store — doc.rooms geometry, placement validation, reset, logging.
 */

import { useCallback, useEffect, useMemo } from 'react'
import {
  activeRoomFrames,
  ensureCanvasHasPlaceableRoom,
  isValidPlacementLocation,
  makeDefaultMainHallFrame,
} from '../canvas/canvas-engine'
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
   * Recover from corrupt/empty geometry — 50×50′ Main Hall at origin,
   * zoom-safe doc extents, cleared ghosts.
   */
  resetState: () => void
}

export function useCanvasStore(initial: FloorPlanDoc): CanvasStore {
  const store = useFloorPlanDoc(initial)
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
    logState('resetState(): re-initializing to default Main Hall')
    const hall = makeDefaultMainHallFrame()
    const next = ensureCanvasHasPlaceableRoom({
      ...store.doc,
      rooms: [hall],
      objects: store.doc.objects.filter((o) => o.kind !== 'merged_zone'),
      objectRoom: {},
    })
    store.resetDoc(next)
    logState(`resetState() complete: ${serializeRooms(next)}`)
  }, [logState, store])

  useEffect(() => {
    const active = activeRoomFrames(store.doc)
    if (!roomsGeometryValid(active)) {
      logState('Invalid doc.rooms detected — running resetState()')
      resetState()
    }
  }, [logState, resetState, store.doc])

  return {
    ...store,
    rooms,
    logState,
    validatePlacement,
    resetState,
  }
}
