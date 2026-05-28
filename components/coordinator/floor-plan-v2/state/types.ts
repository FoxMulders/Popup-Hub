/**
 * Floor Plan v2 — document & object types.
 *
 * Design philosophy:
 * - The document is a flat list of objects. No grids of cells, no
 *   prescriptive presets, no capacity ceilings, no algorithmic painters
 *   that own the canvas state.
 * - Every object is positioned in feet from the canvas origin (top-left,
 *   y-axis grows downward). All edits are user-initiated; nothing in this
 *   module ever mutates objects in response to a click on empty canvas.
 * - The canvas dimensions are advisory only — they shape the visual grid
 *   and the viewport, but objects can be placed anywhere, including
 *   outside the venue rectangle. Constraints belong in lints/inspectors,
 *   not in placement code.
 */

export type ObjectKind =
  | 'booth'
  | 'wall'
  | 'aisle'
  | 'label'
  | 'door'
  | 'emergency_exit'
  | 'stage'

export interface BasePlacedObject {
  id: string
  kind: ObjectKind
  /** Feet from canvas origin (top-left of axis-aligned bounding box). */
  x: number
  /** Feet from canvas origin. */
  y: number
  /** Feet. Always positive — drawing logic normalizes negatives at commit. */
  width: number
  /** Feet. Always positive. */
  height: number
  /** Degrees, clockwise. 0 = upright. */
  rotation: number
  /** Optional human label rendered inside the object. */
  label?: string
  /** Locked objects can't be moved, resized, or deleted via direct manipulation. */
  locked?: boolean
}

export interface BoothObject extends BasePlacedObject {
  kind: 'booth'
  /** Optional vendor binding — populated when the coordinator drops a vendor onto the booth. */
  vendorId?: string | null
  /** Optional category tag, used purely for color-coding. */
  categoryName?: string | null
  /** Optional accent color (hex). When unset, derived from category or default. */
  accentColor?: string | null
}

export interface WallObject extends BasePlacedObject {
  kind: 'wall'
}

export interface AisleObject extends BasePlacedObject {
  kind: 'aisle'
}

export interface LabelObject extends BasePlacedObject {
  kind: 'label'
  text: string
}

export interface DoorObject extends BasePlacedObject {
  kind: 'door'
  doorType: 'entrance' | 'exit'
}

/**
 * Emergency exit fixture. Modeled as its own kind (rather than another
 * `doorType` variant) so the canvas can paint it with the universally
 * recognised red/yellow striped chrome and so the legacy bridge can
 * always project it as a fire-egress `exit` venue element regardless
 * of how it was drawn.
 */
export interface EmergencyExitObject extends BasePlacedObject {
  kind: 'emergency_exit'
}

export interface StageObject extends BasePlacedObject {
  kind: 'stage'
}

export type PlacedObject =
  | BoothObject
  | WallObject
  | AisleObject
  | LabelObject
  | DoorObject
  | EmergencyExitObject
  | StageObject

export interface FloorPlanDoc {
  /** Visual canvas extents in feet. Advisory; objects may sit outside. */
  canvasWidthFt: number
  canvasLengthFt: number
  /** Background grid spacing in feet. Visual aid only — never enforced. */
  gridSpacingFt: number
  /** Snap-to-grid increment in feet. Set to 0 to disable snapping. */
  snapFt: number
  /** Free-form, user-managed object list. Order = z-order (later = on top). */
  objects: PlacedObject[]
}

export const DEFAULT_GRID_SPACING_FT = 1
export const DEFAULT_SNAP_FT = 1

export function makeEmptyDoc(
  canvasWidthFt: number,
  canvasLengthFt: number
): FloorPlanDoc {
  return {
    canvasWidthFt,
    canvasLengthFt,
    gridSpacingFt: DEFAULT_GRID_SPACING_FT,
    snapFt: DEFAULT_SNAP_FT,
    objects: [],
  }
}
