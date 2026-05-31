'use client'

/**
 * Layout builder state facade — immutable `doc.rooms` + viewport safeguards.
 */

import { useCallback } from 'react'
import {
  ensureLayoutNotVoid,
  isValidPlacementLocation,
  layoutRooms,
  unionRoomBounds,
} from './layout-builder-core'
import type { FloorPlanDoc, PlacedObject } from './types'
import type { FloorPlanDocStore } from './use-floor-plan-doc'

export function useLayoutBuilder(store: FloorPlanDocStore) {
  const rooms = layoutRooms(store.doc)

  const validatePlacement = useCallback(
    (
      probeFt: { x: number; y: number },
      obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
    ) => isValidPlacementLocation(store.doc, probeFt, obj),
    [store.doc]
  )

  const commitSafeguarded = useCallback(
    (next: FloorPlanDoc, options?: { pushHistory?: boolean }) => {
      const safe = ensureLayoutNotVoid(next)
      store.patchDoc(
        {
          rooms: safe.rooms,
          canvasWidthFt: safe.canvasWidthFt,
          canvasLengthFt: safe.canvasLengthFt,
          objectRoom: safe.objectRoom,
        },
        options
      )
    },
    [store]
  )

  const roomBounds = unionRoomBounds(store.doc)

  return {
    rooms,
    roomBounds,
    validatePlacement,
    commitSafeguarded,
    ensureNotVoid: ensureLayoutNotVoid,
  }
}

export type LayoutBuilderApi = ReturnType<typeof useLayoutBuilder>
