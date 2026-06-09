'use client'

import { useMemo } from 'react'
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

  const resolvedBoundary = useMemo(
    () =>
      roomBoundary ?? (roomId ? mergedZoneRingsForRoom(doc, roomId) : []),
    [doc, roomId, roomBoundary]
  )

  return useMemo(() => {
    if (!enabled || !roomId) return []
    const result = CalculateOptimalPath(doc, roomId, {
      cellFt,
      obstacleBufferFt,
      booths: booths ? [...booths] : undefined,
      roomBoundary: resolvedBoundary,
    })
    return result?.path ?? []
  }, [
    doc,
    roomId,
    enabled,
    cellFt,
    obstacleBufferFt,
    booths,
    resolvedBoundary,
  ])
}
