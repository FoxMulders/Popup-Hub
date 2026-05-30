import type { PlacedObject, RoomFrame, WallObject } from '../state/types'

/**
 * Default thickness for macro-generated perimeter walls, in feet.
 * Matches the typical hand-drawn wall thickness used elsewhere in
 * the app and reads cleanly at default zoom (1 ft × pxPerFt = a
 * single grid square wide, so the four walls form a recognisable
 * rectilinear box without dominating the room interior).
 */
export const PERIMETER_WALL_THICKNESS_FT = 1

/**
 * Marker label written into every macro-generated wall. Lets the
 * UI distinguish auto-generated perimeter walls from user-drawn
 * ones (e.g. for an "Are you sure?" prompt before clearing all,
 * or for a future "Regenerate perimeter" affordance).
 */
export const PERIMETER_WALL_LABEL = 'Perimeter wall'

/**
 * Inputs for the perimeter macro. Either a `RoomFrame` (canvas-
 * relative coords carried in `originX`/`originY`) or a plain
 * width/length pair (in canvas-global feet starting at the origin)
 * is acceptable. The plain form is what `makeEmptyDoc()` callers
 * use when there's no explicit room — the perimeter is generated
 * around the canvas rectangle itself.
 */
export interface PerimeterTarget {
  originX: number
  originY: number
  widthFt: number
  lengthFt: number
}

/**
 * Pure generator: given a room (or canvas) rectangle, emit four
 * `WallObject`s tracing the perimeter — top, right, bottom, left.
 * Each wall is locked so direct deletion is blocked at the input
 * layer and the wall-immutability gate in `handleDeleteSelected`
 * reinforces the same constraint at the keyboard/toolbar layer.
 *
 * Coordinate spec (per the design goal):
 *   - Top:    (0, 0)        → (width, 0)
 *   - Right:  (width, 0)    → (width, height)
 *   - Bottom: (0, height)   → (width, height)
 *   - Left:   (0, 0)        → (0, height)
 *
 * The generator turns those line segments into rectangles with
 * `PERIMETER_WALL_THICKNESS_FT` thickness, anchored INSIDE the
 * room rect so the room's usable square footage is preserved.
 * Bottom and right walls are inset by the thickness so they sit
 * on the inner face of the room frame, matching how a coordinator
 * would draw them by hand.
 *
 * `idGen` defaults to `crypto.randomUUID` but can be injected for
 * deterministic tests.
 */
export function buildPerimeterWalls(
  target: PerimeterTarget,
  options: { idGen?: () => string; thicknessFt?: number } = {}
): WallObject[] {
  const t = options.thicknessFt ?? PERIMETER_WALL_THICKNESS_FT
  const idGen =
    options.idGen ??
    (() =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `wall-${crypto.randomUUID()}`
        : `wall-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`)

  const ox = target.originX
  const oy = target.originY
  const w = target.widthFt
  const l = target.lengthFt

  const baseProps = {
    rotation: 0,
    label: PERIMETER_WALL_LABEL,
  } as const

  const top: WallObject = {
    ...baseProps,
    id: idGen(),
    kind: 'wall',
    x: ox,
    y: oy,
    width: w,
    height: t,
  }
  const right: WallObject = {
    ...baseProps,
    id: idGen(),
    kind: 'wall',
    x: ox + w - t,
    y: oy,
    width: t,
    height: l,
  }
  const bottom: WallObject = {
    ...baseProps,
    id: idGen(),
    kind: 'wall',
    x: ox,
    y: oy + l - t,
    width: w,
    height: t,
  }
  const left: WallObject = {
    ...baseProps,
    id: idGen(),
    kind: 'wall',
    x: ox,
    y: oy,
    width: t,
    height: l,
  }

  return [top, right, bottom, left]
}

/**
 * Predicate: does the target rectangle already have a complete set
 * of macro-generated perimeter walls? Used by the UI button to
 * disable itself once the perimeter is sealed (re-running the
 * macro would double-stack walls on top of each other).
 *
 * The check is conservative: a target is considered sealed only
 * when at least one wall sits at each of the four canonical
 * positions (within `tolFt` feet) AND every match is locked +
 * carries the `PERIMETER_WALL_LABEL` sentinel. Hand-drawn walls
 * that happen to align won't trip the predicate.
 */
export function targetHasPerimeterWalls(
  target: PerimeterTarget,
  objects: ReadonlyArray<PlacedObject>,
  tolFt = 0.25
): boolean {
  const t = PERIMETER_WALL_THICKNESS_FT
  const ox = target.originX
  const oy = target.originY
  const w = target.widthFt
  const l = target.lengthFt
  const expectations: Array<{ x: number; y: number; w: number; h: number }> = [
    { x: ox, y: oy, w, h: t },
    { x: ox + w - t, y: oy, w: t, h: l },
    { x: ox, y: oy + l - t, w, h: t },
    { x: ox, y: oy, w: t, h: l },
  ]
  return expectations.every((exp) =>
    objects.some(
      (o) =>
        o.kind === 'wall' &&
        o.label === PERIMETER_WALL_LABEL &&
        Math.abs(o.x - exp.x) < tolFt &&
        Math.abs(o.y - exp.y) < tolFt &&
        Math.abs(o.width - exp.w) < tolFt &&
        Math.abs(o.height - exp.h) < tolFt
    )
  )
}

/**
 * Convenience: pick the right `PerimeterTarget` for the active
 * room id, falling back to the canvas rectangle (origin 0,0 sized
 * to canvas dims) when there's no room or no match. Keeps the
 * caller's intent ("seal the active workspace") concise.
 */
export function resolvePerimeterTarget(
  rooms: ReadonlyArray<RoomFrame> | undefined,
  activeRoomId: string | null,
  canvasWidthFt: number,
  canvasLengthFt: number
): PerimeterTarget {
  if (rooms && rooms.length > 0) {
    const match = activeRoomId
      ? rooms.find((r) => r.id === activeRoomId)
      : rooms[0]
    if (match) {
      return {
        originX: match.originX,
        originY: match.originY,
        widthFt: match.widthFt,
        lengthFt: match.lengthFt,
      }
    }
  }
  return {
    originX: 0,
    originY: 0,
    widthFt: canvasWidthFt,
    lengthFt: canvasLengthFt,
  }
}
