'use client'

import { memo } from 'react'
import type {
  AisleObject,
  BoothObject,
  DoorObject,
  EmergencyExitObject,
  LabelObject,
  OpenWallObject,
  PlacedObject,
  StageObject,
  WallObject,
} from '../state/types'
import { paletteForCategory, DEFAULT_BOOTH_PALETTE } from './category-palette'

interface CanvasObjectsProps {
  objects: ReadonlyArray<PlacedObject>
  selectedIds: ReadonlySet<string>
  pxPerFt: number
  /**
   * Object whose label is currently being edited inline. The editing
   * input is rendered as a sibling overlay; we suppress the static
   * SVG label here so the two don't double up.
   */
  editingObjectId?: string | null
  /**
   * Sorted list of event-defined category names. Forwarded to the
   * palette lookup so colors are picked by category INDEX (the
   * canonical, no-collision mapping) rather than the deterministic
   * name-hash fallback.
   */
  eventCategoryNames?: ReadonlyArray<string>
}

function fillForObject(
  obj: PlacedObject,
  eventCategoryNames?: ReadonlyArray<string>
): string {
  switch (obj.kind) {
    case 'booth': {
      const booth = obj as BoothObject
      // Explicit override wins; otherwise fall through to the deterministic
      // category palette so booths read by category color.
      if (booth.accentColor) return booth.accentColor
      return paletteForCategory(booth.categoryName, eventCategoryNames).fill
    }
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      // Pale travertine fill — visually softer than the solid wall
      // so the cutout reads as an opening rather than a closed
      // surface. The dashed counter line drawn on top provides the
      // "service window" cue.
      return '#fef3c7'
    case 'aisle':
      return '#fafaf9'
    case 'stage':
      return '#fbcfe8'
    case 'door':
      return obj.doorType === 'entrance' ? '#22c55e' : '#ef4444'
    case 'emergency_exit':
      return '#fca5a5'
    case 'label':
      return 'transparent'
  }
}

function strokeForObject(
  obj: PlacedObject,
  isSelected: boolean,
  eventCategoryNames?: ReadonlyArray<string>
): string {
  if (isSelected) return '#0f766e'
  switch (obj.kind) {
    case 'booth': {
      const booth = obj as BoothObject
      // When the user has set a custom accentColor, keep the legacy
      // amber stroke so contrast stays readable. Otherwise pull the
      // stroke straight from the category palette.
      if (booth.accentColor) return DEFAULT_BOOTH_PALETTE.stroke
      return paletteForCategory(booth.categoryName, eventCategoryNames).stroke
    }
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      return '#92400e'
    case 'aisle':
      return '#a8a29e'
    case 'stage':
      return '#9d174d'
    case 'door':
      return obj.doorType === 'entrance' ? '#15803d' : '#b91c1c'
    case 'emergency_exit':
      return '#991b1b'
    case 'label':
      return '#57534e'
  }
}

/** Default counter-depth (ft) when an open-wall doesn't specify one. */
const OPEN_WALL_DEFAULT_COUNTER_DEPTH_FT = 1.5

/**
 * Object kinds that carve a path opening through a wall when they
 * overlap it. Doors and emergency exits are explicit "openings" by
 * definition — placing one over a wall must dissolve the
 * intersected wall section so the egress vector is visually
 * continuous, and dragging it away must heal the wall back to a
 * solid border line.
 *
 * Open-walls (`open_wall`) are NOT in this set: they are their own
 * architectural fixture with a built-in dashed cutout. Stages,
 * booths, aisles, labels never carve walls.
 */
const WALL_CARVING_KINDS: ReadonlySet<PlacedObject['kind']> = new Set<
  PlacedObject['kind']
>(['door', 'emergency_exit'])

/** A 1-D interval `[from, to]` along a wall's long axis (in pixels). */
interface WallInterval {
  from: number
  to: number
}

/**
 * Return the visible sub-segments for `wall` after subtracting the
 * overlap intervals contributed by all carving objects (doors,
 * emergency exits) currently overlapping its AABB.
 *
 * Returns `null` when the wall is rotated off-axis (rotation !== 0)
 * or the wall is too small to carve safely — callers should fall
 * back to rendering a single rect in those cases.
 *
 * The returned segments are expressed in canvas-pixel coordinates
 * along the wall's long axis. Rendering recomposes them into rects
 * by combining the long-axis interval with the wall's fixed
 * short-axis extent.
 *
 * Door and exit AABBs are projected (axis-aligned) onto the wall's
 * long axis. Rotated doors degrade gracefully: their bounding-box
 * projection is used, which carves slightly more than the rotated
 * shape — acceptable because the alternative (no carve) is a
 * worse UX (a door overlapping a solid wall reads broken).
 */
function computeWallSegments(
  wall: PlacedObject,
  allObjects: ReadonlyArray<PlacedObject>,
  pxPerFt: number
): WallInterval[] | null {
  if (wall.kind !== 'wall') return null
  // Skip carving for rotated walls — interval math assumes the
  // wall is axis-aligned. The wall still renders as a single rect
  // via the fallback path.
  if (wall.rotation && Math.abs(wall.rotation) > 0.5) return null

  const wallX = wall.x * pxPerFt
  const wallY = wall.y * pxPerFt
  const wallW = wall.width * pxPerFt
  const wallH = wall.height * pxPerFt
  const isHorizontal = wallW >= wallH
  const wallStart = isHorizontal ? wallX : wallY
  const wallEnd = isHorizontal ? wallX + wallW : wallY + wallH
  const wallShortFrom = isHorizontal ? wallY : wallX
  const wallShortTo = isHorizontal ? wallY + wallH : wallX + wallW

  const carveIntervals: WallInterval[] = []
  for (const other of allObjects) {
    if (!WALL_CARVING_KINDS.has(other.kind)) continue
    if (other.id === wall.id) continue
    const ox = other.x * pxPerFt
    const oy = other.y * pxPerFt
    const ow = other.width * pxPerFt
    const oh = other.height * pxPerFt
    // Short-axis must intersect for an overlap to count. We use a
    // small tolerance so a door drawn flush against the wall's
    // outer face (zero overlap on short axis) still carves a path.
    const shortTolerance = Math.max(2, pxPerFt * 0.25)
    const shortHit = isHorizontal
      ? oy + oh >= wallShortFrom - shortTolerance &&
        oy <= wallShortTo + shortTolerance
      : ox + ow >= wallShortFrom - shortTolerance &&
        ox <= wallShortTo + shortTolerance
    if (!shortHit) continue
    const longFrom = isHorizontal ? ox : oy
    const longTo = isHorizontal ? ox + ow : oy + oh
    const carveFrom = Math.max(wallStart, longFrom)
    const carveTo = Math.min(wallEnd, longTo)
    if (carveTo > carveFrom) {
      carveIntervals.push({ from: carveFrom, to: carveTo })
    }
  }

  if (carveIntervals.length === 0) {
    return [{ from: wallStart, to: wallEnd }]
  }

  // Merge overlapping carve intervals so neighbouring doors don't
  // produce zero-width slivers in the output.
  carveIntervals.sort((a, b) => a.from - b.from)
  const merged: WallInterval[] = [carveIntervals[0]!]
  for (let i = 1; i < carveIntervals.length; i++) {
    const last = merged[merged.length - 1]!
    const cur = carveIntervals[i]!
    if (cur.from <= last.to) {
      last.to = Math.max(last.to, cur.to)
    } else {
      merged.push({ ...cur })
    }
  }

  // Subtract merged intervals from [wallStart, wallEnd].
  const visible: WallInterval[] = []
  let cursor = wallStart
  for (const c of merged) {
    if (c.from > cursor) visible.push({ from: cursor, to: c.from })
    cursor = Math.max(cursor, c.to)
  }
  if (cursor < wallEnd) visible.push({ from: cursor, to: wallEnd })
  // Drop slivers below 1 px so we don't paint visual noise.
  return visible.filter((iv) => iv.to - iv.from > 1)
}

function CanvasObjectsBase({
  objects,
  selectedIds,
  pxPerFt,
  editingObjectId,
  eventCategoryNames,
}: CanvasObjectsProps) {
  return (
    <g>
      {objects.map((obj) => {
        const x = obj.x * pxPerFt
        const y = obj.y * pxPerFt
        const w = obj.width * pxPerFt
        const h = obj.height * pxPerFt
        const isSelected = selectedIds.has(obj.id)
        const fill = fillForObject(obj, eventCategoryNames)
        // When the object is part of an explicit join group its
        // perimeter is no longer "owned" by the object — the
        // dissolved zone polygon (rendered in <RoomFrames>) draws
        // the unified outer wall. Suppress the per-object stroke
        // so the two boundaries don't double up.
        const isJoined = !!obj.joinGroupId
        const stroke = isJoined && !isSelected
          ? 'transparent'
          : strokeForObject(obj, isSelected, eventCategoryNames)
        const strokeWidth = isSelected ? 2.5 : isJoined ? 0 : 1.5
        const transform =
          obj.rotation && obj.rotation !== 0
            ? `rotate(${obj.rotation} ${x + w / 2} ${y + h / 2})`
            : undefined
        const labelText =
          obj.kind === 'label'
            ? (obj as LabelObject).text || obj.label || ''
            : obj.label || objectFallbackLabel(obj)
        const isEditing = editingObjectId === obj.id

        // Wall carving: when a door / emergency exit overlaps a
        // wall we render the wall as multiple sub-rects so the
        // door's path opening dissolves the intersected wall
        // section. Moving the door away naturally heals the wall
        // because the carve list re-derives from current geometry
        // every render. Rotated walls and non-wall kinds always
        // fall back to a single rect.
        const wallSegments =
          obj.kind === 'wall'
            ? computeWallSegments(obj, objects, pxPerFt)
            : null
        const isHorizontalWall = obj.kind === 'wall' && w >= h

        return (
          <g
            key={obj.id}
            transform={transform}
            data-object-id={obj.id}
            data-kind={obj.kind}
            data-locked={obj.locked ? 'true' : 'false'}
          >
            {wallSegments && wallSegments.length > 0 ? (
              wallSegments.map((seg, idx) => {
                const segX = isHorizontalWall ? seg.from : x
                const segY = isHorizontalWall ? y : seg.from
                const segW = isHorizontalWall ? seg.to - seg.from : w
                const segH = isHorizontalWall ? h : seg.to - seg.from
                return (
                  <rect
                    key={`${obj.id}-seg-${idx}`}
                    x={segX}
                    y={segY}
                    width={segW}
                    height={segH}
                    fill={fill}
                    fillOpacity={0.85}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    pointerEvents="all"
                    shapeRendering="crispEdges"
                  />
                )
              })
            ) : (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={fill}
                fillOpacity={obj.kind === 'aisle' ? 0.4 : 0.85}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={
                  obj.kind === 'aisle'
                    ? '4 3'
                    : obj.kind === 'emergency_exit'
                      ? '6 3'
                      : undefined
                }
                pointerEvents="all"
                shapeRendering="crispEdges"
              />
            )}
            {/* Walls fully consumed by door/exit overlaps still need
                a transparent hit target so the wall stays selectable
                and so it can keep the carved-state visual without
                the user losing the ability to undo or move it. */}
            {wallSegments && wallSegments.length === 0 ? (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="transparent"
                stroke={isSelected ? stroke : 'transparent'}
                strokeWidth={isSelected ? 1.5 : 0}
                strokeDasharray="4 3"
                pointerEvents="all"
                shapeRendering="crispEdges"
              />
            ) : null}
            {/*
              Emergency-exit chevron — universal egress motif, drawn
              over the dashed-red rect so the fixture reads as
              fire-egress at any zoom level.
            */}
            {obj.kind === 'emergency_exit' ? (
              <polyline
                points={`${x + w * 0.25},${y + h * 0.5} ${x + w * 0.55},${y + h * 0.25} ${x + w * 0.55},${y + h * 0.75} ${x + w * 0.25},${y + h * 0.5}`}
                fill="#991b1b"
                stroke="#7f1d1d"
                strokeWidth={1}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ) : null}
            {/*
              Open-wall service window — the wall rectangle is
              already painted by the base <rect> above. Here we add:
                * a dashed inner cutout running along the LONG axis
                  of the wall (the "service line" patrons step up
                  to), insetting by the configured counter depth, and
                * two short tick marks at the ends of the cutout to
                  signal where the wall resumes.
              The cutout always tracks the wall's longer dimension
              so a 12'×1' counter shows the dashed line horizontally
              and a 1'×8' window shows it vertically without the
              coordinator having to flip orientation by hand.
            */}
            {obj.kind === 'open_wall' ? (
              (() => {
                const ow = obj as OpenWallObject
                const counterDepthFt =
                  ow.counterDepthFt && ow.counterDepthFt > 0
                    ? ow.counterDepthFt
                    : OPEN_WALL_DEFAULT_COUNTER_DEPTH_FT
                const counterDepthPx = counterDepthFt * pxPerFt
                const isLandscape = w >= h
                // Inset the cutout by counterDepth along the SHORT
                // axis, and pad ~10% along the LONG axis so the
                // service line doesn't run wall-to-wall.
                const longPad = (isLandscape ? w : h) * 0.1
                const shortInset = Math.min(
                  isLandscape ? h - 1 : w - 1,
                  Math.max(0.3 * pxPerFt, counterDepthPx)
                )
                const cutX1 = isLandscape ? x + longPad : x + shortInset
                const cutX2 = isLandscape ? x + w - longPad : x + shortInset
                const cutY1 = isLandscape ? y + shortInset : y + longPad
                const cutY2 = isLandscape ? y + shortInset : y + h - longPad
                return (
                  <g pointerEvents="none">
                    {/* Service-counter line (the open portion). */}
                    <line
                      x1={cutX1}
                      y1={cutY1}
                      x2={cutX2}
                      y2={cutY2}
                      stroke="#92400e"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      strokeLinecap="round"
                    />
                    {/* End-cap ticks marking where the wall resumes. */}
                    <line
                      x1={isLandscape ? cutX1 : cutX1 - 4}
                      y1={isLandscape ? cutY1 - 4 : cutY1}
                      x2={isLandscape ? cutX1 : cutX1 + 4}
                      y2={isLandscape ? cutY1 + 4 : cutY1}
                      stroke="#92400e"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={isLandscape ? cutX2 : cutX2 - 4}
                      y1={isLandscape ? cutY2 - 4 : cutY2}
                      x2={isLandscape ? cutX2 : cutX2 + 4}
                      y2={isLandscape ? cutY2 + 4 : cutY2}
                      stroke="#92400e"
                      strokeWidth={1.5}
                    />
                  </g>
                )
              })()
            ) : null}
            {labelText && !isEditing
              ? renderObjectLabel(obj, { x, y, w, h, labelText })
              : null}
          </g>
        )
      })}
    </g>
  )
}

function textFillForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'wall':
      return '#fafaf9'
    case 'open_wall':
      return '#92400e'
    case 'aisle':
      return '#57534e'
    case 'door':
      return '#fafaf9'
    case 'emergency_exit':
      return '#7f1d1d'
    default:
      return '#1c1917'
  }
}

/**
 * Object kinds whose labels must render OUTSIDE the perimeter
 * bounding stroke. These are structural fixtures (walls, doors,
 * emergency exits, open-walls) where an inline center label would
 * sit directly on top of the physical wall vector and obscure the
 * fixture's geometry.
 */
const EXTERIOR_LABEL_KINDS: ReadonlySet<PlacedObject['kind']> = new Set<
  PlacedObject['kind']
>(['wall', 'door', 'emergency_exit', 'open_wall'])

/**
 * Render an object's label. Structural fixtures get their labels
 * pushed onto the exterior margin (above for landscape, to the
 * left for portrait) with an opaque pill backing so the wall
 * vector underneath stays unobscured. Other kinds (booth, stage,
 * aisle, label) keep the centered inline placement that reads as
 * "this is the contents of this region".
 *
 * The exterior margin is:
 *   - for w >= h: center-top of the rect, lifted by `gap` pixels
 *     so the bottom of the label pill clears the perimeter stroke
 *   - for w  < h: center-left of the rect, shifted left by the
 *     pill's measured width + `gap`
 *
 * Pill width is approximated from the truncated label length
 * (cheap glyph-advance estimate is fine for short fixture labels).
 */
function renderObjectLabel(
  obj: PlacedObject,
  geom: { x: number; y: number; w: number; h: number; labelText: string }
) {
  const { x, y, w, h, labelText } = geom
  const truncated = truncate(labelText, 18)
  if (EXTERIOR_LABEL_KINDS.has(obj.kind)) {
    const isLandscape = w >= h
    const fontSize = 11
    const padX = 6
    const padY = 3
    const approxCharW = fontSize * 0.6
    const tagW = approxCharW * truncated.length + padX * 2
    const tagH = fontSize + padY * 2
    const gap = 6
    let tagX: number
    let tagY: number
    if (isLandscape) {
      tagX = x + w / 2 - tagW / 2
      tagY = y - tagH - gap
    } else {
      tagX = x - tagW - gap
      tagY = y + h / 2 - tagH / 2
    }
    const pillFill = pillFillForObject(obj)
    const pillStroke = pillStrokeForObject(obj)
    const pillTextFill = pillTextFillForObject(obj)
    return (
      <g pointerEvents="none">
        <rect
          x={tagX}
          y={tagY}
          width={tagW}
          height={tagH}
          rx={3}
          fill={pillFill}
          fillOpacity={0.96}
          stroke={pillStroke}
          strokeWidth={1}
        />
        <text
          x={tagX + padX}
          y={tagY + tagH - padY - 1}
          fontSize={fontSize}
          fontWeight={700}
          fill={pillTextFill}
        >
          {truncated}
        </text>
      </g>
    )
  }
  // Non-structural objects keep the inline center label.
  return (
    <text
      x={x + w / 2}
      y={y + h / 2 + 4}
      textAnchor="middle"
      fontSize={Math.min(14, Math.max(8, w * 0.18))}
      fontWeight={700}
      fill={textFillForObject(obj)}
      pointerEvents="none"
    >
      {truncated}
    </text>
  )
}

function pillFillForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'wall':
      return '#fafaf9'
    case 'open_wall':
      return '#fef3c7'
    case 'door':
      return obj.doorType === 'entrance' ? '#dcfce7' : '#fee2e2'
    case 'emergency_exit':
      return '#fee2e2'
    default:
      return '#fafaf9'
  }
}

function pillStrokeForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      return '#92400e'
    case 'door':
      return obj.doorType === 'entrance' ? '#15803d' : '#b91c1c'
    case 'emergency_exit':
      return '#991b1b'
    default:
      return '#57534e'
  }
}

function pillTextFillForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      return '#7c2d12'
    case 'door':
      return obj.doorType === 'entrance' ? '#14532d' : '#7f1d1d'
    case 'emergency_exit':
      return '#7f1d1d'
    default:
      return '#1c1917'
  }
}

function objectFallbackLabel(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'booth':
      return (obj as BoothObject).vendorId ? '' : 'Booth'
    case 'wall':
      return (obj as WallObject).label || 'Perimeter wall'
    case 'open_wall':
      return (obj as OpenWallObject).label || 'Open wall'
    case 'aisle':
      return (obj as AisleObject).label || 'Aisle'
    case 'stage':
      return (obj as StageObject).label || 'Stage'
    case 'door':
      return (obj as DoorObject).label
        ? (obj as DoorObject).label!
        : (obj as DoorObject).doorType === 'entrance'
          ? 'Door · IN'
          : 'Door · OUT'
    case 'emergency_exit':
      return (obj as EmergencyExitObject).label || 'Emergency Exit'
    case 'label':
      return ''
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(1, max - 1))}…`
}

export const CanvasObjects = memo(CanvasObjectsBase)
