'use client'

/**
 * Wizard Step 3 canvas store — no auto Main Hall seed; interactive blank start.
 */

import { useCallback, useMemo } from 'react'
import { activeRoomFrames } from '@/components/coordinator/floor-plan-v2/canvas/canvas-engine'
import { forceRecomputeGeometry, isValidPlacementLocation } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import { useDebugLog } from '@/components/coordinator/floor-plan-v2/debug/debug-log-context'
import type { FloorPlanDoc, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  useFloorPlanDoc,
  type FloorPlanDocStore,
} from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { CanvasStore } from '@/components/coordinator/floor-plan-v2/state/use-canvas-store'

export function useCanvasStoreWizardQa(
  initial: FloorPlanDoc,
  eventId?: string
): CanvasStore {
  const store = useFloorPlanDoc(forceRecomputeGeometry(initial), {
    disableAutoMainHall: true,
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
    logState('resetState(): wizard blank canvas')
    const next: FloorPlanDoc = forceRecomputeGeometry({
      ...store.doc,
      rooms: [],
      objects: [],
      objectRoom: {},
    })
    store.resetDoc(next)
  }, [logState, store])

  const seedMainHall = useCallback(() => {
    logState('seedMainHall(): disabled on wizard Step 3')
  }, [logState])

  return {
    ...store,
    rooms,
    logState,
    validatePlacement,
    resetState,
    seedMainHall,
  }
}
