'use client'

import { memo, useMemo } from 'react'
import {
  computeRoomWallSegments,
  detectMergedRoomPairs,
} from '../interactions/geometry'
import { buildJoinedZone, isJoinableObject } from '../state/room-joins'
import { EXTERIOR_LABEL_OFFSET_PX } from '../interactions/geometry'
import type { PlacedObject, RoomFrame } from '../state/types'

interface RoomFramesProps {
  frames: ReadonlyArray<RoomFrame>
  /**
   * All placed objects on the canvas. We only consume the ones whose
   * `joinGroupId` matches a frame's join group — those rectangles
   * get folded into the dissolved zone polygon so the perimeter wall
   * extends over them. Standard floor objects pass through
   * untouched.
   */
  objects?: ReadonlyArray<PlacedObject>
  /** Active room (highlighted; child edits are routed here by default). */
  activeRoomId: string | null
  /** Currently selected room (clicked-to-select for drag). */
  selectedRoomId: string | null
  pxPerFt: number
  /** When false, hide room boundary labels and joined-zone badges. */
  showLabels?: boolean
}

const PERIMETER_STROKE = '#1c1917'
const PERIMETER_STROKE_ACTIVE = '#0f766e'
const PERIMETER_STROKE_SELECTED = '#0f766e'
const PERIMETER_STROKE_MERGED = '#15803d'
/** Joined zone uses primary-room chrome (active hall), not stage/fixture colors. */
const JOINED_ZONE_FILL = '#ef4444'
const JOINED_ZONE_STROKE = '#b91c1c'
const PERIMETER_WIDTH = 2.5
const PERIMETER_WIDTH_SELECTED = 3.5
const PERIMETER_WIDTH_JOINED = 3.5
const JOINED_ZONE_FILL_OPACITY = 0.12

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
  objects,
  activeRoomId,
  selectedRoomId,
  pxPerFt,
  showLabels = true,
}: RoomFramesProps) {
  // Pre-compute the joined groups so members can skip their
  // individual perimeter strokes and we render the union polygon
  // once per group instead. `joinGroupId` is set by the canvas
  // toolbar's "Join" action (`state/room-joins`).
  const groupMembers = useMemo(() => {
    const out = new Map<string, RoomFrame[]>()
    for (const f of frames) {
      if (!f.joinGroupId) continue
      if (!out.has(f.joinGroupId)) out.set(f.joinGroupId, [])
      out.get(f.joinGroupId)!.push(f)
    }
    return out
  }, [frames])

  // Same shape as `groupMembers`, but for joinable `PlacedObject`s
  // (currently `stage` only). These rectangles get folded into the
  // dissolved zone polygon so the perimeter wall flows around them.
  const groupObjects = useMemo(() => {
    const out = new Map<string, PlacedObject[]>()
    if (!objects) return out
    for (const o of objects) {
      if (!o.joinGroupId) continue
      if (!isJoinableObject(o)) continue
      if (!out.has(o.joinGroupId)) out.set(o.joinGroupId, [])
      out.get(o.joinGroupId)!.push(o)
    }
    return out
  }, [objects])

  /**
   * Compute the dissolved zone (outer ring + AABB + member ids) for
   * every join group, in canvas-pixel space ready to feed straight
   * into an SVG `<path>`. Memoized so the polygon clipper only runs
   * when room or joinable-object geometry actually changes.
   */
  const joinedZones = useMemo(() => {
    const result: Array<{
      groupId: string
      members: RoomFrame[]
      objects: PlacedObject[]
      pathData: string
      labelX: number
      labelY: number
      width: number
      height: number
    }> = []
    // Walk every group that has at least one room frame OR at least
    // two joinable objects (a stage joined to a stage with no rooms
    // in between is still a valid extension).
    const groupIds = new Set<string>([
      ...groupMembers.keys(),
      ...groupObjects.keys(),
    ])
    for (const groupId of groupIds) {
      const members = groupMembers.get(groupId) ?? []
      const groupObjs = groupObjects.get(groupId) ?? []
      const totalParticipants = members.length + groupObjs.length
      if (totalParticipants < 2) continue
      const zone = buildJoinedZone(groupId, members, groupObjs)
      if (!zone) continue
      // Build the SVG `path` by walking each outer ring; "M" + "L"…
      // + "Z" per ring so multiple disjoint outers (rare but
      // possible after a partial join) all paint correctly.
      const segments: string[] = []
      for (const ring of zone.rings) {
        if (ring.length === 0) continue
        const [first, ...rest] = ring
        segments.push(`M ${first![0] * pxPerFt} ${first![1] * pxPerFt}`)
        for (const [px, py] of rest) {
          segments.push(`L ${px * pxPerFt} ${py * pxPerFt}`)
        }
        segments.push('Z')
      }
      const pathData = segments.join(' ')
      // Anchor the label to the top-left-most participant (room or
      // joinable object), so a stage annexed to the upper edge of
      // a hall can host the label too.
      const labelAnchorRoom = members.reduce<RoomFrame | null>(
        (best, f) => {
          const score = f.originY * 1e6 + f.originX
          if (!best) return f
          const bestScore = best.originY * 1e6 + best.originX
          return score < bestScore ? f : best
        },
        null
      )
      const labelAnchorObj = groupObjs.reduce<PlacedObject | null>(
        (best, o) => {
          const score = o.y * 1e6 + o.x
          if (!best) return o
          const bestScore = best.y * 1e6 + best.x
          return score < bestScore ? o : best
        },
        null
      )
      let anchorX: number
      let anchorY: number
      if (labelAnchorRoom && labelAnchorObj) {
        const roomScore =
          labelAnchorRoom.originY * 1e6 + labelAnchorRoom.originX
        const objScore = labelAnchorObj.y * 1e6 + labelAnchorObj.x
        if (roomScore <= objScore) {
          anchorX = labelAnchorRoom.originX
          anchorY = labelAnchorRoom.originY
        } else {
          anchorX = labelAnchorObj.x
          anchorY = labelAnchorObj.y
        }
      } else if (labelAnchorRoom) {
        anchorX = labelAnchorRoom.originX
        anchorY = labelAnchorRoom.originY
      } else if (labelAnchorObj) {
        anchorX = labelAnchorObj.x
        anchorY = labelAnchorObj.y
      } else {
        anchorX = zone.aabb.minX
        anchorY = zone.aabb.minY
      }
      result.push({
        groupId,
        members,
        objects: groupObjs,
        pathData,
        labelX: anchorX * pxPerFt,
        labelY: anchorY * pxPerFt,
        width: (zone.aabb.maxX - zone.aabb.minX) * pxPerFt,
        height: (zone.aabb.maxY - zone.aabb.minY) * pxPerFt,
      })
    }
    return result
    // pxPerFt is captured in the path; recompute when anything changes.
  }, [groupMembers, groupObjects, pxPerFt])

  if (frames.length === 0) return null

  // Visible wall segments per room (with merged sections subtracted).
  const wallSegments = computeRoomWallSegments(frames)
  // Pairs of rooms that share at least one wall — drives the
  // "Joined" badge under the name (legacy auto-merge for touching
  // rooms; explicit join groups override this rendering).
  const mergedPairs = detectMergedRoomPairs(frames)
  const joinedNeighbors = new Map<string, Set<string>>()
  for (const { a, b } of mergedPairs) {
    if (!joinedNeighbors.has(a)) joinedNeighbors.set(a, new Set())
    if (!joinedNeighbors.has(b)) joinedNeighbors.set(b, new Set())
    joinedNeighbors.get(a)!.add(b)
    joinedNeighbors.get(b)!.add(a)
  }
  const nameById = new Map(frames.map((f) => [f.id, f.name]))
  // Frames that belong to an explicit join group skip their
  // individual perimeter outline — the dissolved zone polygon
  // renders the outer wall instead.
  const joinedFrameIds = new Set<string>()
  for (const members of groupMembers.values()) {
    if (members.length < 2) continue
    for (const m of members) joinedFrameIds.add(m.id)
  }

  return (
    <g aria-hidden>
      {/* Dissolved (joined) zones: one outer ring per group, painted
          underneath the per-frame chrome so individual room labels
          still float on top. */}
      {joinedZones.map((zone) => (
        <g key={`joined-${zone.groupId}`} data-joined-group={zone.groupId}>
          <path
            d={zone.pathData}
            fill={JOINED_ZONE_FILL}
            fillOpacity={JOINED_ZONE_FILL_OPACITY}
            stroke={JOINED_ZONE_STROKE}
            strokeWidth={PERIMETER_WIDTH_JOINED}
            strokeLinejoin="round"
            shapeRendering="geometricPrecision"
            pointerEvents="all"
            data-joined-zone-path={zone.groupId}
          />
          <g pointerEvents="none">
            {showLabels
              ? (() => {
                  const roomCount = zone.members.length
                  const objectCount = zone.objects.length
                  const summary =
                    objectCount > 0
                      ? `Joined zone · ${roomCount} room${roomCount === 1 ? '' : 's'} + ${objectCount} fixture${objectCount === 1 ? '' : 's'}`
                      : `Joined zone · ${roomCount} room${roomCount === 1 ? '' : 's'}`
                  const tagH = 22
                  const tagGap = EXTERIOR_LABEL_OFFSET_PX
                  const tagW = Math.min(320, Math.max(140, summary.length * 7 + 24))
                  const tagY = zone.labelY - tagH - tagGap
                  return (
                    <>
                      <rect
                        x={zone.labelX}
                        y={tagY}
                        width={tagW}
                        height={tagH}
                        rx={4}
                        fill="#0e7490"
                        fillOpacity={0.92}
                      />
                      <text
                        x={zone.labelX + 8}
                        y={tagY + 16}
                        fontSize={12}
                        fontWeight={700}
                        fill="#ecfeff"
                      >
                        {summary}
                      </text>
                    </>
                  )
                })()
              : null}
          </g>
        </g>
      ))}

      {frames.map((frame) => {
        const x = frame.originX * pxPerFt
        const y = frame.originY * pxPerFt
        const w = frame.widthFt * pxPerFt
        const h = frame.lengthFt * pxPerFt
        const isActive = activeRoomId === frame.id
        const isSelected = selectedRoomId === frame.id
        const isJoined = joinedFrameIds.has(frame.id)
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
                hit target promotes a click into a frame-level drag.
                Members of an explicit join group skip the fill so
                the dissolved-zone polygon's tinted fill takes over. */}
            {!isJoined ? (
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
            ) : null}

            {/* Visible perimeter walls — segmented, with shared edges
                subtracted out so two adjacent rooms render as a
                single combined interior pathway. Suppressed entirely
                for members of an explicit join group: their wall is
                the dissolved zone's outer polygon, painted above. */}
            {!isJoined
              ? segments.map((seg, idx) => {
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
                })
              : null}

            {/* For joined frames we still need a transparent hit
                target along the perimeter so the macro-level room
                drag stays grabbable — coordinators must be able to
                slide a room within the joined zone, even though the
                visible wall is suppressed. */}
            {isJoined ? (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="transparent"
                stroke="transparent"
                strokeWidth={Math.max(8, PERIMETER_WIDTH_JOINED * 2)}
                data-room-id={frame.id}
                data-room-stroke="true"
                data-room-side="hit"
                pointerEvents="stroke"
                style={{ cursor: 'grab' }}
              />
            ) : null}

            {/* Room name floated ABOVE the frame so the badge never
                sits on top of the interior usable square footage and
                never obscures the perimeter wall vector. The badge
                anchors at (x, y - badgeHeight - gap) — i.e., the
                tag's bottom edge clears the perimeter stroke by a
                consistent margin at every zoom level. */}
            <g pointerEvents="none">
              {showLabels
                ? (() => {
                    const tagH = 22
                    const tagGap = EXTERIOR_LABEL_OFFSET_PX
                    const tagW = Math.min(180, Math.max(60, frame.name.length * 7 + 30))
                    const tagX = x
                    const tagY = y - tagH - tagGap
                    const mergedH = 18
                    const mergedW = Math.min(
                      220,
                      Math.max(90, neighborNames.length * 6.5 + 50)
                    )
                    const mergedX = x
                    const mergedY = tagY - mergedH - 4
                    return (
                      <>
                        <rect
                          x={tagX}
                          y={tagY}
                          width={tagW}
                          height={tagH}
                          rx={4}
                          fill={isSelected ? '#0f766e' : isMerged ? '#15803d' : '#1c1917'}
                          fillOpacity={isSelected || isMerged ? 0.92 : 0.85}
                        />
                        <text
                          x={tagX + 8}
                          y={tagY + 16}
                          fontSize={12}
                          fontWeight={700}
                          fill="#fafaf9"
                        >
                          {frame.name}
                        </text>
                        {isMerged ? (
                          <g>
                            <rect
                              x={mergedX}
                              y={mergedY}
                              width={mergedW}
                              height={mergedH}
                              rx={3}
                              fill="#dcfce7"
                              fillOpacity={0.96}
                              stroke="#15803d"
                              strokeWidth={1}
                            />
                            <text
                              x={mergedX + 6}
                              y={mergedY + 13}
                              fontSize={10}
                              fontWeight={600}
                              fill="#166534"
                            >
                              {`Joined to ${neighborNames}`}
                            </text>
                          </g>
                        ) : null}
                      </>
                    )
                  })()
                : null}
            </g>
          </g>
        )
      })}
    </g>
  )
}

export const RoomFrames = memo(RoomFramesBase)
