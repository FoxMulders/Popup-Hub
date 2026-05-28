'use client'

import { memo } from 'react'
import {
  computeRoomWallSegments,
  detectMergedRoomPairs,
} from '../interactions/geometry'
import type { RoomFrame } from '../state/types'

interface RoomFramesProps {
  frames: ReadonlyArray<RoomFrame>
  /** Active room (highlighted; child edits are routed here by default). */
  activeRoomId: string | null
  /** Currently selected room (clicked-to-select for drag). */
  selectedRoomId: string | null
  pxPerFt: number
}

const PERIMETER_STROKE = '#1c1917'
const PERIMETER_STROKE_ACTIVE = '#0f766e'
const PERIMETER_STROKE_SELECTED = '#0f766e'
const PERIMETER_STROKE_MERGED = '#15803d'
const PERIMETER_WIDTH = 2.5
const PERIMETER_WIDTH_SELECTED = 3.5

/**
 * Renders one perimeter group per room frame on the unified canvas.
 *
 * Responsibilities:
 *   1. Paint a faint floor fill so coordinators can tell at a glance
 *      where a room's interior begins and ends.
 *   2. Paint the perimeter walls — but with shared portions (where
 *      two rooms touch) suppressed so adjacent rooms read as one
 *      combined interior.
 *   3. Surface the room name at the top-left of every frame.
 *   4. Tag each frame with `data-room-id` + `data-room-stroke` so
 *      the canvas pointer hook can detect a click on the wall and
 *      promote it into a macro-level room drag.
 *   5. Render a "Joined" badge under the name when the room shares
 *      at least one wall with a neighbour.
 *
 * The wall geometry is recomputed every render in pixel space —
 * cheap because rooms are small in count (typically <=10) and the
 * underlying interval math is O(rooms * 4 * 4 * neighbours).
 */
function RoomFramesBase({
  frames,
  activeRoomId,
  selectedRoomId,
  pxPerFt,
}: RoomFramesProps) {
  if (frames.length === 0) return null

  // Visible wall segments per room (with merged sections subtracted).
  const wallSegments = computeRoomWallSegments(frames)
  // Pairs of rooms that share at least one wall — drives the
  // "Joined" badge under the name.
  const mergedPairs = detectMergedRoomPairs(frames)
  const joinedNeighbors = new Map<string, Set<string>>()
  for (const { a, b } of mergedPairs) {
    if (!joinedNeighbors.has(a)) joinedNeighbors.set(a, new Set())
    if (!joinedNeighbors.has(b)) joinedNeighbors.set(b, new Set())
    joinedNeighbors.get(a)!.add(b)
    joinedNeighbors.get(b)!.add(a)
  }
  const nameById = new Map(frames.map((f) => [f.id, f.name]))

  return (
    <g aria-hidden>
      {frames.map((frame) => {
        const x = frame.originX * pxPerFt
        const y = frame.originY * pxPerFt
        const w = frame.widthFt * pxPerFt
        const h = frame.lengthFt * pxPerFt
        const isActive = activeRoomId === frame.id
        const isSelected = selectedRoomId === frame.id
        const isMerged = (joinedNeighbors.get(frame.id)?.size ?? 0) > 0
        const stroke = isSelected
          ? PERIMETER_STROKE_SELECTED
          : isMerged
            ? PERIMETER_STROKE_MERGED
            : isActive
              ? PERIMETER_STROKE_ACTIVE
              : PERIMETER_STROKE
        const strokeWidth = isSelected
          ? PERIMETER_WIDTH_SELECTED
          : PERIMETER_WIDTH
        const fillOpacity = isActive ? 0.06 : 0.025
        const segments = wallSegments.get(frame.id) ?? []
        const neighborNames = isMerged
          ? Array.from(joinedNeighbors.get(frame.id) ?? [])
              .map((id) => nameById.get(id))
              .filter(Boolean)
              .join(', ')
          : ''

        return (
          <g key={`frame-${frame.id}`} data-room-id={frame.id}>
            {/* Interior floor fill — extremely faint so booths still
                read clearly on top. Pointer-events are disabled so a
                click on the interior falls through to whatever booth
                / aisle / wall sits on top; only the perimeter stroke
                hit target promotes a click into a frame-level drag. */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={isActive ? '#0f766e' : '#1c1917'}
              fillOpacity={fillOpacity}
              pointerEvents="none"
              shapeRendering="crispEdges"
            />

            {/* Visible perimeter walls — segmented, with shared edges
                subtracted out so two adjacent rooms render as a
                single combined interior pathway. */}
            {segments.map((seg, idx) => {
              const isHorizontal = seg.axis === 'horizontal'
              const x1 = (isHorizontal ? seg.from : seg.coord) * pxPerFt
              const y1 = (isHorizontal ? seg.coord : seg.from) * pxPerFt
              const x2 = (isHorizontal ? seg.to : seg.coord) * pxPerFt
              const y2 = (isHorizontal ? seg.coord : seg.to) * pxPerFt
              return (
                <line
                  key={`${frame.id}-edge-${idx}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="square"
                  data-room-id={frame.id}
                  data-room-stroke="true"
                  data-room-side={seg.side}
                  pointerEvents="stroke"
                  style={{ cursor: 'grab' }}
                />
              )
            })}

            {/* Room name at the top-left of the frame. Pointer events
                bubble through to the underlying perimeter stroke
                hit-target so coordinators can grab the label too. */}
            <g pointerEvents="none">
              <rect
                x={x + 6}
                y={y + 6}
                width={Math.min(180, Math.max(60, frame.name.length * 7 + 30))}
                height={22}
                rx={4}
                fill={isSelected ? '#0f766e' : isMerged ? '#15803d' : '#1c1917'}
                fillOpacity={isSelected || isMerged ? 0.92 : 0.75}
              />
              <text
                x={x + 14}
                y={y + 22}
                fontSize={12}
                fontWeight={700}
                fill="#fafaf9"
              >
                {frame.name}
              </text>
              {isMerged ? (
                <g>
                  <rect
                    x={x + 6}
                    y={y + 30}
                    width={Math.min(220, Math.max(90, neighborNames.length * 6.5 + 50))}
                    height={18}
                    rx={3}
                    fill="#dcfce7"
                    fillOpacity={0.96}
                    stroke="#15803d"
                    strokeWidth={1}
                  />
                  <text
                    x={x + 12}
                    y={y + 43}
                    fontSize={10}
                    fontWeight={600}
                    fill="#166534"
                  >
                    {`Joined to ${neighborNames}`}
                  </text>
                </g>
              ) : null}
            </g>
          </g>
        )
      })}
    </g>
  )
}

export const RoomFrames = memo(RoomFramesBase)
