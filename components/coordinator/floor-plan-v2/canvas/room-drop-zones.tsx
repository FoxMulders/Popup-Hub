'use client'

import { memo } from 'react'
import type { FloorPlanDoc } from '../state/types'

export interface RoomDropZonesProps {
  doc: FloorPlanDoc
  pxPerFt: number
  activeRoomId?: string | null
}

/**
 * Placement regions are derived from `doc.rooms` geometry at pointer-commit
 * time. Room interiors stay blank — perimeter chrome is painted by
 * {@link RoomFrames} only.
 */
function RoomDropZonesBase(_props: RoomDropZonesProps) {
  return null
}

export const RoomDropZones = memo(RoomDropZonesBase)
