'use client'

import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import {
  CalculateOptimalPath,
  type PathPoint,
} from '../engine/PathfindingService'
import { mergedZoneRingsForRoom } from '../engine/BoothArrangementEngine'
import type { PlacementRing } from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc } from '../state/types'

export interface UsePathfindingOptions {
  /** When false, returns an empty path without running A*. */
  enabled?: boolean
  /** Grid resolution — feet per cell (default: doc.snapFt or 1). */
  cellFt?: number
  /** Extra clearance around booth/stage/wall footprints (ft). */
  obstacleBufferFt?: number
  /** Vendor booths to visit (defaults to vendor booths in the active room). */
  booths?: ReadonlyArray<BoothObject>
  /** Walkable boundary — merged_zone rings (defaults to room merged surface). */
  roomBoundary?: ReadonlyArray<PlacementRing>
}

/**
 * Computes the optimal patron path through walkable merged-zone cells,
 * visiting every booth in nearest-neighbor order with A* legs.
 *
 * Pathfinding is deferred (`useDeferredValue` + transition) so urgent
 * canvas mutations (delete, grid edits) paint before A* / TSP work runs.
 */
export function usePathfinding(
  doc: FloorPlanDoc,
  roomId: string | null | undefined,
  options: UsePathfindingOptions = {}
): PathPoint[] {
  const {
    enabled = true,
    cellFt,
    obstacleBufferFt,
    booths,
    roomBoundary,
  } = options

  const deferredDoc = useDeferredValue(doc)
  const deferredRoomId = useDeferredValue(roomId)
  const deferredEnabled = useDeferredValue(enabled)
  const deferredCellFt = useDeferredValue(cellFt)
  const deferredBooths = useDeferredValue(booths)
  const deferredRoomBoundary = useDeferredValue(roomBoundary)

  const [path, setPath] = useState<PathPoint[]>([])

  useEffect(() => {
    if (!deferredEnabled || !deferredRoomId) {
      setPath([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      startTransition(() => {
        if (cancelled) return
        const resolvedBoundary =
          deferredRoomBoundary ??
          (deferredRoomId
            ? mergedZoneRingsForRoom(deferredDoc, deferredRoomId)
            : [])
        const result = CalculateOptimalPath(deferredDoc, deferredRoomId, {
          cellFt: deferredCellFt,
          obstacleBufferFt,
          booths: deferredBooths ? [...deferredBooths] : undefined,
          roomBoundary: resolvedBoundary,
        })
        if (!cancelled) {
          setPath(result?.path ?? [])
        }
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    deferredDoc,
    deferredRoomId,
    deferredEnabled,
    deferredCellFt,
    obstacleBufferFt,
    deferredBooths,
    deferredRoomBoundary,
  ])

  return path
}
