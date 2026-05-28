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

/**
 * Room frame on the unified canvas. Each frame represents one
 * `LayoutRoom` projected onto a shared coordinate space; frames can be
 * placed side-by-side, butted up against each other (wall-merge), and
 * dragged as macro-level entities — child objects translate with the
 * frame because they're stored in *global* canvas coords with a
 * sidecar room association (`FloorPlanDoc.objectRoom`).
 *
 * Frames are part of the doc so room moves participate in the same
 * undo/redo stack as object edits — a single Ctrl+Z restores the
 * previous origin and the children that travelled with it.
 */
export interface RoomFrame {
  /** Mirrors `LayoutRoom.id` so the bridge can write back to the
   *  source list at save time. */
  id: string
  /** Display name shown above the frame (mirrors `LayoutRoom.name`). */
  name: string
  /** Top-left of the room rectangle on the unified canvas, in feet. */
  originX: number
  originY: number
  /** Room interior extent in feet (matches `LayoutRoom.venue_width/length`). */
  widthFt: number
  lengthFt: number
}

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
  /**
   * Room frames on the unified canvas. Optional so single-room callers
   * (e.g., legacy tests) can keep using a frameless doc; the v2 wizard
   * always populates this with one entry per `LayoutRoom`.
   */
  rooms?: RoomFrame[]
  /**
   * Sidecar mapping `objectId → roomId` so we can round-trip objects
   * back to their source `LayoutRoom` on save. Objects without an
   * entry default to the first room (or no room when `rooms` is
   * absent).
   */
  objectRoom?: Record<string, string>
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
