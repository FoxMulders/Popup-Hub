'use client'

import { memo, useMemo } from 'react'
import { activeDropZoneRooms } from '../geometry/is-point-in-room'
import { frameToRing } from '../state/placement-surface'
import type { FloorPlanDoc, RoomFrame } from '../state/types'

function ringToPathD(
  ring: ReadonlyArray<readonly [number, number]>,
  pxPerFt: number
): string {
  if (ring.length === 0) return ''
  const first = ring[0]!
  let d = `M ${first[0] * pxPerFt} ${first[1] * pxPerFt}`
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i]!
    if (
      i === ring.length - 1 &&
      p[0] === first[0] &&
      p[1] === first[1]
    ) {
      continue
    }
    d += ` L ${p[0] * pxPerFt} ${p[1] * pxPerFt}`
  }
  return `${d} Z`
}

function ringsForFrame(frame: RoomFrame) {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return frame.perimeterRing
  }
  return frameToRing(frame)
}

export interface RoomDropZonesProps {
  doc: FloorPlanDoc
  pxPerFt: number
  activeRoomId?: string | null
}

/**
 * SVG clip masks + drop surfaces — room interior is the only interactive
 * placement region (background is visually de-emphasized).
 */
function RoomDropZonesBase({
  doc,
  pxPerFt,
  activeRoomId,
}: RoomDropZonesProps) {
  const zones = useMemo(() => {
    return activeDropZoneRooms(doc).map((frame) => {
      const ring = ringsForFrame(frame)
      return {
        frame,
        ring,
        pathD: ringToPathD(ring, pxPerFt),
        clipId: `room-clip-${frame.id}`,
      }
    })
  }, [doc, pxPerFt])

  if (zones.length === 0) return null

  return (
    <g aria-label="Room drop zones" className="canvas-overlay-layer" pointerEvents="none">
      <defs>
        {zones.map((z) => (
          <clipPath key={z.clipId} id={z.clipId}>
            <path d={z.pathD} />
          </clipPath>
        ))}
      </defs>
      {zones.map((z) => {
        const isActive = activeRoomId === z.frame.id
        return (
          <g key={z.frame.id} clipPath={`url(#${z.clipId})`}>
            <path
              d={z.pathD}
              fill={isActive ? '#0f766e' : '#1c1917'}
              fillOpacity={isActive ? 0.07 : 0.03}
              stroke="none"
              pointerEvents="none"
              data-drop-zone={z.frame.id}
              data-room-grid-container="true"
            />
          </g>
        )
      })}
      {zones.map((z) => (
        <path
          key={`edge-${z.frame.id}`}
          d={z.pathD}
          fill="none"
          stroke={activeRoomId === z.frame.id ? '#0f766e' : '#a8a29e'}
          strokeWidth={1.5}
          strokeOpacity={0.85}
          pointerEvents="none"
        />
      ))}
    </g>
  )
}

export const RoomDropZones = memo(RoomDropZonesBase)
