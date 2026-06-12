'use client'

import { memo, useMemo } from 'react'
import type {
  BoothObject,
  DoorObject,
  EmergencyExitObject,
  LabelObject,
  MergedZoneObject,
  OpenWallObject,
  PlacedObject,
  RoomFrame,
  StageObject,
  WallObject,
} from '../state/types'
import { ringsToSvgPathD } from '@/lib/floor-plan/shape-union'
import {
  VENDOR_BOOTH_PALETTE,
  PATRON_TABLE_PALETTE,
} from './category-palette'
import { EXTERIOR_LABEL_OFFSET_PX, objectCenter } from '../interactions/geometry'
import { BOOTH_EQUIPMENT_DEPTH_FT } from '@/lib/booth-planner/table-space'
import { boothHasTableCluster } from '../state/table-cluster-layout'
import { PERIMETER_WALL_LABEL } from '../interactions/perimeter-walls'
import { PLACEMENT_VIOLATION } from './placement-theme'
import {
  BOOTH_STATUS_THEME,
  type BoothPlacementStatus,
} from '@/lib/coordinator/booth-placement-status'
import { isJoinableObject } from '../state/room-joins'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import { fitTextInContainer, wrapTextInContainer } from './canvas-label-text'
import {
  BOOTH_CLEARANCE_THEMES,
  vendorBoothBoundaryWarningBand,
} from '@/lib/coordinator/booth-clearance-visual'
import { isVendorBoothObject } from '../interactions/vendor-booth-placement'
import type { FloorPlanDoc } from '../state/types'
import type { LayoutSpringPose } from '../hooks/use-layout-spring'
import {
  resolveBoothMapLabelText,
  type BoothMapLabelMode,
} from '@/lib/coordinator/booth-map-label'

interface CanvasObjectsProps {
  objects: ReadonlyArray<PlacedObject>
  /** Interpolated poses during auto-arrange spring animation. */
  layoutSpringPoses?: ReadonlyMap<string, LayoutSpringPose> | null
  selectedIds: ReadonlySet<string>
  pxPerFt: number
  /** When false, hide architectural overlay labels (walls, doors, exits). */
  showLabels?: boolean
  /** Dashboard booth fill overrides (unassigned / paid / VIP). */
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
  /** Vendor booth inline label mode (vendor name, category, or booth id). */
  boothMapLabelMode?: BoothMapLabelMode
  boothMapLabelByObjectId?: ReadonlyMap<string, { vendorName: string; category: string }>
  /** Object ids currently overlapping another placed object. */
  overlappingIds?: ReadonlySet<string>
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
  /** Room frames — used to detect dissolved perimeter join groups. */
  rooms?: ReadonlyArray<RoomFrame>
  objectRoom?: FloorPlanDoc['objectRoom']
  /** Highlight clearance bands while dragging booths. */
  emphasizeClearance?: boolean
  /** When false, vendor booths use payment/status fill instead of aisle bands. */
  showClearanceWarnings?: boolean
  /** Stage ids whose inner wall is dissolved into a room union perimeter. */
  dissolvedStageIds?: ReadonlySet<string>
  /**
   * Split render pass — `merged_zone` is painted under room frames and
   * furniture when the host mounts two instances.
   */
  renderLayer?: 'all' | 'merged_zone' | 'placable'
}

function fillForObject(
  obj: PlacedObject,
  eventCategoryNames?: ReadonlyArray<string>,
  isOverlapping?: boolean,
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
): string {
  if (isOverlapping) return PLACEMENT_VIOLATION.fill
  switch (obj.kind) {
    case 'booth': {
      const booth = obj as BoothObject
      const isPatron = isGuestTableBooth(booth)
      if (booth.accentColor && !isPatron) return booth.accentColor
      if (isPatron) return PATRON_TABLE_PALETTE.fill
      const status = boothPlacementStatusByObjectId?.get(obj.id)
      if (status) {
        if (status === 'unassigned') return VENDOR_BOOTH_PALETTE.fill
        return BOOTH_STATUS_THEME[status].fill
      }
      return VENDOR_BOOTH_PALETTE.fill
    }
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      // Pale travertine fill — visually softer than the solid wall
      // so the cutout reads as an opening rather than a closed
      // surface. The dashed counter line drawn on top provides the
      // "service window" cue.
      return '#fef3c7'
    case 'stage':
      return 'transparent'
    case 'food_truck':
      return '#fed7aa'
    case 'door':
      return obj.doorType === 'entrance' ? '#22c55e' : '#ef4444'
    case 'emergency_exit':
      return '#fca5a5'
    case 'label':
      return 'transparent'
    case 'merged_zone':
      return '#ccfbf1'
  }
}

function strokeForObject(
  obj: PlacedObject,
  isSelected: boolean,
  eventCategoryNames?: ReadonlyArray<string>,
  isOverlapping?: boolean,
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
): string {
  if (isOverlapping) return PLACEMENT_VIOLATION.stroke
  if (isSelected) return '#0f766e'
  switch (obj.kind) {
    case 'booth': {
      const booth = obj as BoothObject
      const isPatron = isGuestTableBooth(booth)
      if (isPatron) return PATRON_TABLE_PALETTE.stroke
      const status = boothPlacementStatusByObjectId?.get(obj.id)
      if (status) {
        if (status === 'unassigned') return VENDOR_BOOTH_PALETTE.stroke
        return BOOTH_STATUS_THEME[status].stroke
      }
      return VENDOR_BOOTH_PALETTE.stroke
    }
    case 'wall':
      return '#1c1917'
    case 'open_wall':
      return '#92400e'
    case 'stage':
      return '#9d174d'
    case 'food_truck':
      return '#c2410c'
    case 'door':
      return obj.doorType === 'entrance' ? '#15803d' : '#b91c1c'
    case 'emergency_exit':
      return '#991b1b'
    case 'label':
      return '#57534e'
    case 'merged_zone':
      return '#0f766e'
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
 * booths, labels never carve walls.
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

function isMacroPerimeterWall(obj: PlacedObject): boolean {
  return (
    obj.kind === 'wall' &&
    (obj.label ?? '').toLowerCase() === PERIMETER_WALL_LABEL.toLowerCase()
  )
}

function aabbTouches(
  a: PlacedObject,
  b: PlacedObject,
  tolFt: number
): boolean {
  return !(
    a.x + a.width < b.x - tolFt ||
    b.x + b.width < a.x - tolFt ||
    a.y + a.height < b.y - tolFt ||
    b.y + b.height < a.y - tolFt
  )
}

/** Cluster macro perimeter walls; each group gets one exterior label. */
function macroPerimeterWallGroups(
  objects: ReadonlyArray<PlacedObject>
): Array<{ ids: Set<string>; minX: number; minY: number; maxX: number; maxY: number }> {
  const walls = objects.filter(isMacroPerimeterWall)
  if (walls.length === 0) return []

  const parent = new Map<string, string>()
  for (const w of walls) parent.set(w.id, w.id)
  function find(id: string): string {
    let root = parent.get(id)!
    while (root !== parent.get(root)) root = parent.get(root)!
    parent.set(id, root)
    return root
  }
  function unite(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  const tolFt = 0.5
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i]!
      const b = walls[j]!
      if (aabbTouches(a, b, tolFt)) unite(a.id, b.id)
    }
  }

  const byRoot = new Map<
    string,
    { ids: Set<string>; minX: number; minY: number; maxX: number; maxY: number }
  >()
  for (const w of walls) {
    const root = find(w.id)
    const minX = w.x
    const minY = w.y
    const maxX = w.x + w.width
    const maxY = w.y + w.height
    const existing = byRoot.get(root)
    if (!existing) {
      byRoot.set(root, {
        ids: new Set([w.id]),
        minX,
        minY,
        maxX,
        maxY,
      })
    } else {
      existing.ids.add(w.id)
      existing.minX = Math.min(existing.minX, minX)
      existing.minY = Math.min(existing.minY, minY)
      existing.maxX = Math.max(existing.maxX, maxX)
      existing.maxY = Math.max(existing.maxY, maxY)
    }
  }
  return Array.from(byRoot.values())
}

function renderGlobalPerimeterLabel(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  pxPerFt: number
) {
  const x = bounds.minX * pxPerFt
  const y = bounds.minY * pxPerFt
  const w = (bounds.maxX - bounds.minX) * pxPerFt
  const labelText = 'Perimeter Wall'
  const truncated = truncate(labelText, 18)
  const fontSize = 11
  const padX = 6
  const padY = 3
  const approxCharW = fontSize * 0.6
  const tagW = approxCharW * truncated.length + padX * 2
  const tagH = fontSize + padY * 2
  const tagX = x + w / 2 - tagW / 2
  const tagY = y - tagH - EXTERIOR_LABEL_OFFSET_PX
  return (
    <g pointerEvents="none">
      <rect
        x={tagX}
        y={tagY}
        width={tagW}
        height={tagH}
        rx={3}
        fill="#fafaf9"
        fillOpacity={0.96}
        stroke="#1c1917"
        strokeWidth={1}
      />
      <text
        x={tagX + padX}
        y={tagY + tagH - padY - 1}
        fontSize={fontSize}
        fontWeight={700}
        fill="#1c1917"
      >
        {truncated}
      </text>
    </g>
  )
}


function boothStatusLabel(
  obj: PlacedObject,
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
): string | null {
  const status = boothPlacementStatusByObjectId?.get(obj.id)
  if (!status) return null
  return BOOTH_STATUS_THEME[status].label
}

function boothFocusProps(
  obj: PlacedObject,
  boothPlacementStatusByObjectId?: ReadonlyMap<string, BoothPlacementStatus>
): Record<string, string | number> {
  if (obj.kind !== 'booth') return {}
  const label = obj.label || objectFallbackLabel(obj)
  const status = boothStatusLabel(obj, boothPlacementStatusByObjectId)
  return {
    tabIndex: 0,
    focusable: 'true',
    role: 'button',
    'data-object-id': obj.id,
    'aria-label': status ? `${label}, ${status}` : label,
  }
}

function resolveSpringObject(
  obj: PlacedObject,
  layoutSpringPoses?: ReadonlyMap<string, LayoutSpringPose> | null
): PlacedObject {
  const pose = layoutSpringPoses?.get(obj.id)
  if (!pose) return obj
  return { ...obj, x: pose.x, y: pose.y, rotation: pose.rotation }
}

function CanvasObjectsBase({
  objects,
  layoutSpringPoses,
  selectedIds,
  pxPerFt,
  showLabels = true,
  boothPlacementStatusByObjectId,
  boothMapLabelMode = 'vendor',
  boothMapLabelByObjectId,
  overlappingIds,
  editingObjectId,
  eventCategoryNames,
  rooms,
  objectRoom,
  emphasizeClearance = false,
  showClearanceWarnings = true,
  dissolvedStageIds,
  renderLayer = 'all',
}: CanvasObjectsProps) {
  const dissolvedJoinGroupIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rooms ?? []) {
      if (!r.joinGroupId) continue
      counts.set(r.joinGroupId, (counts.get(r.joinGroupId) ?? 0) + 1)
    }
    for (const o of objects) {
      if (!o.joinGroupId || !isJoinableObject(o)) continue
      counts.set(o.joinGroupId, (counts.get(o.joinGroupId) ?? 0) + 1)
    }
    return new Set(
      [...counts.entries()].filter(([, n]) => n >= 2).map(([id]) => id)
    )
  }, [objects, rooms])

  const macroPerimeterGroups = useMemo(
    () => (showLabels ? macroPerimeterWallGroups(objects) : []),
    [objects, showLabels]
  )
  const suppressedPerimeterIds = useMemo(() => {
    const out = new Set<string>()
    for (const group of macroPerimeterGroups) {
      for (const id of group.ids) out.add(id)
    }
    return out
  }, [macroPerimeterGroups])

  const { mergedZoneObjects, placableObjects } = useMemo(() => {
    const merged: MergedZoneObject[] = []
    const placable: PlacedObject[] = []
    for (const obj of objects) {
      if (obj.kind === 'merged_zone') {
        merged.push(obj as MergedZoneObject)
      } else {
        placable.push(obj)
      }
    }
    return { mergedZoneObjects: merged, placableObjects: placable }
  }, [objects])

  const showMergedLayer = renderLayer === 'all' || renderLayer === 'merged_zone'
  const showPlacableLayer = renderLayer === 'all' || renderLayer === 'placable'

  return (
    <g>
      {showMergedLayer ? (
        <g
          className="canvas-merged-zone-layer canvas-overlay-layer"
          pointerEvents="none"
          aria-hidden={mergedZoneObjects.length > 0 ? undefined : true}
        >
          {mergedZoneObjects.map((obj) => (
            <MergedZoneNode
              key={obj.id}
              obj={obj}
              pxPerFt={pxPerFt}
              isSelected={selectedIds.has(obj.id)}
              isOverlapping={overlappingIds?.has(obj.id) ?? false}
              showLabels={showLabels}
            />
          ))}
        </g>
      ) : null}
      {showPlacableLayer
        ? placableObjects.map((rawObj) => {
        const obj = resolveSpringObject(rawObj, layoutSpringPoses)
        const x = obj.x * pxPerFt
        const y = obj.y * pxPerFt
        const w = obj.width * pxPerFt
        const h = obj.height * pxPerFt
        const isSelected = selectedIds.has(obj.id)
        const isOverlapping = overlappingIds?.has(obj.id) ?? false
        const placementStatus =
          obj.kind === 'booth' && isGuestTableBooth(obj as BoothObject)
            ? undefined
            : boothPlacementStatusByObjectId?.get(obj.id)
        let fill = fillForObject(
          obj,
          eventCategoryNames,
          isOverlapping,
          boothPlacementStatusByObjectId
        )
        let clearanceStroke: string | undefined
        let clearanceFillOpacity: number | undefined

        if (
          showClearanceWarnings &&
          obj.kind === 'booth' &&
          isVendorBoothObject(obj) &&
          !isOverlapping
        ) {
          const band = vendorBoothBoundaryWarningBand(
            obj as BoothObject,
            objects,
            rooms,
            objectRoom
          )
          const theme = BOOTH_CLEARANCE_THEMES[band]
          fill = theme.fill
          clearanceStroke = theme.stroke
          clearanceFillOpacity = theme.fillOpacity
        }
        // Vendor booths use solid yellow — payment status is shown via label text.
        // When the object is part of an explicit join group its
        // perimeter is no longer "owned" by the object — the
        // dissolved zone polygon (rendered in <RoomFrames>) draws
        // the unified outer wall. Suppress the per-object stroke
        // so the two boundaries don't double up.
        const isJoined = Boolean(
          (obj.joinGroupId && dissolvedJoinGroupIds.has(obj.joinGroupId)) ||
            (obj.kind === 'stage' && dissolvedStageIds?.has(obj.id))
        )
        const hideJoinedFixtureBody =
          isJoined && isJoinableObject(obj) && obj.kind !== 'stage'
        const displayFill = hideJoinedFixtureBody ? 'transparent' : fill
        const displayFillOpacity =
          hideJoinedFixtureBody || obj.kind === 'stage'
            ? 0
            : clearanceFillOpacity ?? 0.85
        const stroke =
          clearanceStroke ??
          (isJoined && !isSelected && !isOverlapping && obj.kind !== 'stage'
            ? 'transparent'
            : strokeForObject(
              obj,
              isSelected,
              eventCategoryNames,
              isOverlapping,
              boothPlacementStatusByObjectId
            ))
        const strokeWidth = isOverlapping ? 2.5 : isSelected ? 2.5 : isJoined ? 0 : 1.5
        const isTableClusterBooth =
          obj.kind === 'booth' && boothHasTableCluster(obj as BoothObject)
        const isPatronTableBooth =
          obj.kind === 'booth' && isGuestTableBooth(obj as BoothObject)
        const isRoundBooth =
          isPatronTableBooth &&
          (obj as BoothObject).tableShape === 'round' &&
          !isTableClusterBooth
        const isGuestRectBooth =
          isPatronTableBooth &&
          (obj as BoothObject).tableShape !== 'round' &&
          !isTableClusterBooth
        const transform =
          !isTableClusterBooth && obj.rotation && obj.rotation !== 0
            ? `rotate(${obj.rotation} ${x + w / 2} ${y + h / 2})`
            : undefined
        const vendorBoothLabelMeta =
          obj.kind === 'booth' && isVendorBoothObject(obj)
            ? boothMapLabelByObjectId?.get(obj.id)
            : undefined
        const labelText =
          obj.kind === 'label'
            ? (obj as LabelObject).text || obj.label || ''
            : vendorBoothLabelMeta
              ? resolveBoothMapLabelText(
                  boothMapLabelMode,
                  obj.label || objectFallbackLabel(obj),
                  vendorBoothLabelMeta.vendorName,
                  vendorBoothLabelMeta.category
                )
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
            ) : isTableClusterBooth ? (
              <TableClusterShapes
                booth={obj as BoothObject}
                pxPerFt={pxPerFt}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                isSelected={isSelected}
                compoundX={x}
                compoundY={y}
                compoundW={w}
                compoundH={h}
              />
            ) : isRoundBooth ? (
              <>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="transparent"
                  pointerEvents="all"
                />
                <ellipse
                  cx={x + w / 2}
                  cy={y + h / 2}
                  rx={w / 2}
                  ry={h / 2}
                  fill={displayFill}
                  fillOpacity={displayFillOpacity}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  pointerEvents="none"
                />
              </>
            ) : isGuestRectBooth ? (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={displayFill}
                fillOpacity={displayFillOpacity * 0.9}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray="3 2"
                pointerEvents="all"
                shapeRendering="crispEdges"
              />
            ) : obj.kind === 'food_truck' ? (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={Math.min(6, w * 0.06, h * 0.12)}
                fill={displayFill}
                fillOpacity={displayFillOpacity}
                stroke={stroke}
                strokeWidth={strokeWidth}
                pointerEvents="all"
              />
            ) : obj.kind === 'stage' ? (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                fillOpacity={0}
                stroke={stroke}
                strokeWidth={strokeWidth}
                pointerEvents="all"
                style={{ cursor: 'move' }}
                shapeRendering="crispEdges"
              />
            ) : (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={displayFill}
                fillOpacity={displayFillOpacity}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={
                  obj.kind === 'emergency_exit'
                    ? '6 3'
                    : placementStatus === 'assigned_unpaid'
                      ? '4 2'
                      : undefined
                }
                pointerEvents="all"
                shapeRendering="crispEdges"
                {...(obj.kind === 'booth'
                  ? boothFocusProps(obj, boothPlacementStatusByObjectId)
                  : {})}
              />
            )}
            {obj.kind === 'booth' &&
            placementStatus &&
            !isEditing &&
            !vendorBoothLabelMeta ? (
              (() => {
                const statusLabel =
                  boothStatusLabel(obj, boothPlacementStatusByObjectId) ?? ''
                const bandHeight = Math.min(h * 0.55, Math.max(18, h * 0.42))
                const wrapped = wrapTextInContainer(
                  statusLabel,
                  w,
                  bandHeight,
                  {
                    baseFontSize: Math.min(10, Math.max(6, w * 0.14)),
                    minFontSize: 5,
                    padX: 2,
                    padY: 1,
                    charWidthRatio: 0.52,
                  }
                )
                const startY =
                  y +
                  h -
                  Math.min(10, h * 0.12) -
                  (wrapped.lines.length - 1) * wrapped.lineHeight
                return (
                  <text
                    x={x + w / 2}
                    y={startY}
                    textAnchor="middle"
                    fontSize={wrapped.fontSize}
                    fontWeight={700}
                    fill={
                      placementStatus === 'paid'
                        ? BOOTH_STATUS_THEME.paid.stroke
                        : placementStatus === 'assigned_unpaid'
                          ? BOOTH_STATUS_THEME.assigned_unpaid.stroke
                          : VENDOR_BOOTH_PALETTE.stroke
                    }
                    pointerEvents="none"
                  >
                    {wrapped.lines.map((line, i) => (
                      <tspan key={i} x={x + w / 2} dy={i === 0 ? 0 : wrapped.lineHeight}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )
              })()
            ) : null}
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
            {showLabels &&
            labelText &&
            !isEditing &&
            !(obj.kind === 'wall' && suppressedPerimeterIds.has(obj.id))
              ? renderObjectLabel(obj, {
                  x,
                  y,
                  w,
                  h,
                  labelText,
                  reserveBottomPx:
                    obj.kind === 'booth' &&
                    placementStatus &&
                    !vendorBoothLabelMeta
                      ? Math.min(h * 0.45, Math.max(16, h * 0.35))
                      : 0,
                })
              : null}
          </g>
        )
      })
        : null}
      {showPlacableLayer && showLabels
        ? macroPerimeterGroups.map((group, idx) => (
            <g key={`perimeter-label-${idx}`}>
              {renderGlobalPerimeterLabel(group, pxPerFt)}
            </g>
          ))
        : null}
    </g>
  )
}

function textFillForObject(obj: PlacedObject): string {
  switch (obj.kind) {
    case 'wall':
      return '#fafaf9'
    case 'open_wall':
      return '#92400e'
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
 * label) keep the centered inline placement that reads as
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
  geom: {
    x: number
    y: number
    w: number
    h: number
    labelText: string
    reserveBottomPx?: number
  }
) {
  const { x, y, w, h, labelText, reserveBottomPx = 0 } = geom
  if (EXTERIOR_LABEL_KINDS.has(obj.kind)) {
    const isLandscape = w >= h
    const baseFontSize = 11
    const padX = 6
    const padY = 3
    const fitted = fitTextInContainer(labelText, w, h, {
      baseFontSize,
      minFontSize: 7,
      padX,
      padY,
    })
    const approxCharW = fitted.fontSize * 0.58
    const tagW = Math.min(w, approxCharW * fitted.text.length + padX * 2)
    const tagH = fitted.fontSize + padY * 2
    const gap = EXTERIOR_LABEL_OFFSET_PX
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
          fontSize={fitted.fontSize}
          fontWeight={700}
          fill={pillTextFill}
        >
          {fitted.text}
        </text>
      </g>
    )
  }
  const baseFontSize = Math.min(14, Math.max(8, w * 0.18))
  const labelHeight = Math.max(8, h - reserveBottomPx)
  const wrapped = wrapTextInContainer(labelText, w, labelHeight, {
    baseFontSize,
    minFontSize: 6,
    padX: 4,
    padY: 2,
  })
  const labelBlockHeight = wrapped.lines.length * wrapped.lineHeight
  const startY =
    y + (labelHeight - labelBlockHeight) / 2 + wrapped.fontSize * 0.35
  return (
    <text
      x={x + w / 2}
      y={startY}
      textAnchor="middle"
      fontSize={wrapped.fontSize}
      fontWeight={700}
      fill={textFillForObject(obj)}
      pointerEvents="none"
    >
      {wrapped.lines.map((line, i) => (
        <tspan key={i} x={x + w / 2} dy={i === 0 ? 0 : wrapped.lineHeight}>
          {line}
        </tspan>
      ))}
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
    case 'booth': {
      const booth = obj as BoothObject
      if (booth.vendorId) return ''
      return booth.tablePurpose === 'guest' ? 'Patron' : 'Vendor'
    }
    case 'wall':
      return (obj as WallObject).label || 'Perimeter wall'
    case 'open_wall':
      return (obj as OpenWallObject).label || 'Open wall'
    case 'stage':
      return (obj as StageObject).label || 'Stage'
    case 'food_truck':
      return obj.label || 'Food truck'
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
    case 'merged_zone':
      return (obj as MergedZoneObject).label || 'Merged'
  }
}

function MergedZoneNode({
  obj,
  pxPerFt,
  isSelected,
  isOverlapping,
  showLabels,
}: {
  obj: MergedZoneObject
  pxPerFt: number
  isSelected: boolean
  isOverlapping: boolean
  showLabels: boolean
}) {
  const localRings = obj.rings.map((ring) =>
    ring.map(([px, py]) => [px, py] as [number, number])
  )
  const pathD = ringsToSvgPathD(localRings, pxPerFt)
  const offsetX = obj.x * pxPerFt
  const offsetY = obj.y * pxPerFt
  const fill = obj.fill ?? '#0f766e'
  const stroke = isOverlapping
    ? PLACEMENT_VIOLATION.stroke
    : isSelected
      ? '#0f766e'
      : obj.stroke ?? '#1c1917'
  const strokeWidth = isOverlapping || isSelected ? 3 : 2

  return (
    <g
      transform={`translate(${offsetX} ${offsetY})`}
      data-object-id={obj.id}
      data-kind="merged_zone"
      data-locked={obj.locked ? 'true' : 'false'}
      className="merged-zone-decorative"
      pointerEvents="none"
      style={{ pointerEvents: 'none' }}
    >
      <path
        d={pathD}
        fill={fill}
        fillOpacity={0}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
        strokeLinecap="square"
        shapeRendering="geometricPrecision"
        pointerEvents="none"
        style={{ pointerEvents: 'none' }}
      />
      {showLabels && obj.label ? (
        <text
          x={8}
          y={16}
          fontSize={11}
          fontWeight={700}
          fill="#fafaf9"
          pointerEvents="none"
        >
          {obj.label}
        </text>
      ) : null}
    </g>
  )
}

function TableClusterShapes({
  booth,
  pxPerFt,
  fill,
  stroke,
  strokeWidth,
  isSelected,
  compoundX,
  compoundY,
  compoundW,
  compoundH,
}: {
  booth: BoothObject
  pxPerFt: number
  fill: string
  stroke: string
  strokeWidth: number
  isSelected: boolean
  compoundX: number
  compoundY: number
  compoundW: number
  compoundH: number
}) {
  const cluster = booth.tableCluster!
  const center = objectCenter(booth)
  const cx = center.x * pxPerFt
  const cy = center.y * pxPerFt
  const clusterRot = booth.rotation ?? 0
  const depthPx = BOOTH_EQUIPMENT_DEPTH_FT * pxPerFt

  return (
    <>
      <rect
        x={compoundX}
        y={compoundY}
        width={compoundW}
        height={compoundH}
        fill="transparent"
        pointerEvents="all"
      />
      <g transform={`translate(${cx} ${cy}) rotate(${clusterRot})`}>
        {cluster.subTables.map((sub) => {
          const tw = sub.tableLengthFt * pxPerFt
          const lx = sub.localCenterX * pxPerFt
          const ly = sub.localCenterY * pxPerFt
          return (
            <g
              key={`${booth.id}-${sub.id}`}
              transform={`translate(${lx} ${ly}) rotate(${sub.rotationOffsetDeg})`}
            >
              <rect
                x={-tw / 2}
                y={-depthPx / 2}
                width={tw}
                height={depthPx}
                fill={fill}
                fillOpacity={0.85}
                stroke={stroke}
                strokeWidth={strokeWidth}
                pointerEvents="all"
                shapeRendering="crispEdges"
              />
            </g>
          )
        })}
        {cluster.subTables.length > 1
          ? cluster.subTables.slice(0, -1).map((sub) => {
              const boundaryX = (sub.localCenterX + sub.tableLengthFt / 2) * pxPerFt
              return (
                <line
                  key={`${booth.id}-divider-${sub.id}`}
                  x1={boundaryX}
                  y1={-depthPx / 2}
                  x2={boundaryX}
                  y2={depthPx / 2}
                  stroke={stroke}
                  strokeWidth={Math.max(1, strokeWidth)}
                  pointerEvents="none"
                />
              )
            })
          : null}
      </g>
      {isSelected ? (
        <rect
          x={compoundX}
          y={compoundY}
          width={compoundW}
          height={compoundH}
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      ) : null}
    </>
  )
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(1, max - 1))}…`
}

export const CanvasObjects = memo(CanvasObjectsBase)
