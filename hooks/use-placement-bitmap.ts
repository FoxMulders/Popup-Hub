'use client'

import { useMemo } from 'react'
import type { BoothCell, VenueElement } from '@/types/database'
import { SpatialBitGrid } from '@/lib/booth-planner/spatial-bitmap'
import { placementLayoutFingerprint } from '@/lib/booth-planner/placement-layout-fingerprint'

/** Memoized occupancy bitmap — avoids rebuilding on every placement check. */
export function usePlacementBitmap(
  cols: number,
  rows: number,
  venueElements: VenueElement[],
  boothCells: BoothCell[],
  excludeBoothId?: string
) {
  const fingerprint = useMemo(
    () => placementLayoutFingerprint(cols, rows, venueElements, boothCells, excludeBoothId),
    [cols, rows, venueElements, boothCells, excludeBoothId]
  )

  return useMemo(
    () => SpatialBitGrid.fromLayout(cols, rows, venueElements, boothCells, excludeBoothId),
    [fingerprint, cols, rows, venueElements, boothCells, excludeBoothId]
  )
}
