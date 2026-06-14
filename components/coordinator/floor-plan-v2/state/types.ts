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

import type { BoothTableCluster } from './table-cluster-types'

export type ObjectKind =
  | 'booth'
  | 'wall'
  | 'open_wall'
  | 'label'
  | 'door'
  | 'emergency_exit'
  | 'stage'
  /** Mobile concession unit — may sit on open canvas (parking lot) outside rooms. */
  | 'food_truck'
  /** Boolean-union result — one selectable path replacing merged shapes. */
  | 'merged_zone'

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
  /**
   * Optional join-group id. When present, this object's bounding box
   * contributes to the dissolved outer perimeter of the joined zone
   * (`state/room-joins.ts`). Only specific object kinds are eligible
   * for joining — `JOINABLE_OBJECT_KINDS` in `room-joins.ts` is the
   * authoritative gate. Standard vendor booths, tables, walls, and
   * other generic floor assets are NOT joinable; the field stays
   * unset on those kinds.
   */
  joinGroupId?: string
  /**
   * Transform group (Tinkercad-style Join). Members share selection
   * and move together; geometry stays in world ft until explicitly
   * edited. See `state/object-groups.ts`. Distinct from `joinGroupId`.
   */
  canvasGroupId?: string
}

export interface BoothObject extends BasePlacedObject {
  kind: 'booth'
  /** Optional vendor binding — populated when the coordinator drops a vendor onto the booth. */
  vendorId?: string | null
  /** Optional category tag, used purely for color-coding. */
  categoryName?: string | null
  /** Optional accent color (hex). When unset, derived from category or default. */
  accentColor?: string | null
  /** Consolidated table length in feet (width on the 1′ grid). Round tables store diameter. */
  tableLengthFt?: number
  /** Vendor booth unit vs guest seating table. */
  tablePurpose?: 'vendor' | 'guest'
  /** Folding table (default) vs round banquet table footprint. */
  tableShape?: 'rectangular' | 'round'
  /** Tables requested for this vendor (used for multi-table cluster presets). */
  tableCount?: number
  /**
   * Multi-table cluster (2×5′, 2×6′, 3×5′, 3×6′). Sub-tables use
   * cluster-local offsets; parent `x/y/width/height` is the compound
   * rotated AABB. The unit still drags/selects as one booth — Join
   * (`canvasGroupId`) and perimeter `joinGroupId` stay intact.
   */
  tableCluster?: BoothTableCluster
}

export interface WallObject extends BasePlacedObject {
  kind: 'wall'
}

/**
 * Open Wall — a service-window architectural fixture (think food
 * trucks, concession booths, ordering counters). Reads as a normal
 * wall segment, but the canvas paints a dashed cutout along the
 * "front" face of the wall to signal that patrons can transact
 * through the opening.
 *
 * The opening sits along the segment's longer dimension; the
 * `counterDepthFt` field captures how deep the counter projects
 * into the room from the wall plane (defaults to 1.5 ft = a typical
 * pass-through counter). It is rendered as a dashed silhouette
 * inside the wall rectangle.
 */
export interface OpenWallObject extends BasePlacedObject {
  kind: 'open_wall'
  /** Counter depth in feet (projection of the service ledge into
   *  the interior). Defaults to 1.5 ft when unset. */
  counterDepthFt?: number
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

/** Curbside / parking-lot food truck — canvas-open placement (no room required). */
export interface FoodTruckObject extends BasePlacedObject {
  kind: 'food_truck'
}

/**
 * Single element produced by Merge (boolean union). `rings` are closed
 * loops in feet relative to `(x, y)` — the union AABB origin.
 */
export interface MergedZoneObject extends BasePlacedObject {
  kind: 'merged_zone'
  rings: number[][][]
  fill?: string
  stroke?: string
  fillOpacity?: number
  /** Source ids removed from the doc (debug / undo context). */
  mergedFromIds?: string[]
  /** Room frames hidden by this merge (for drag + save bridge). */
  sourceRoomIds?: string[]
}

export type PlacedObject =
  | BoothObject
  | WallObject
  | OpenWallObject
  | LabelObject
  | DoorObject
  | EmergencyExitObject
  | StageObject
  | FoodTruckObject
  | MergedZoneObject

/**
 * Room frame on the unified canvas. Each frame represents one
 * `LayoutRoom` projected onto a shared coordinate space; frames can be
 * placed side-by-side, butted up against each other (wall-merge), and
 * dragged/resized as macro-level entities (see `state/room-canvas.ts`
 * for the 5× primary-room canvas ceiling) — child objects translate
 * with the frame because they're stored in *global* canvas coords with
 * a sidecar room association (`FloorPlanDoc.objectRoom`).
 *
 * Frames are part of the doc so room moves participate in the same
 * undo/redo stack as object edits — a single Ctrl+Z restores the
 * previous origin and the children that travelled with it.
 */
/** Union AABB + pivot for a canvas transform group (`object-groups.ts`). */
export interface GroupBounds {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

/** Sidecar assemble/join group; members stay in `objects[]`. */
export interface CanvasObjectGroup {
  id: string
  memberIds: string[]
  bounds: GroupBounds
  createdAt?: string
}

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
  /**
   * Optional join-group id. Frames sharing the same `joinGroupId`
   * are rendered as a single dissolved zone with a unified outer
   * perimeter (see `state/room-joins.ts`). The id is stable for the
   * lifetime of the group and is cleared when the user splits the
   * zone via "Unjoin".
   */
  joinGroupId?: string
  /**
   * When set, this room's perimeter is not drawn — a `merged_zone`
   * object (`mergedIntoObjectId`) owns the unified union path.
   * @deprecated Prefer `perimeterRing` on the surviving room after merge.
   */
  mergedIntoObjectId?: string
  /**
   * Boolean-union outer boundary in canvas feet (closed ring, CCW).
   * When present, placement validation and rendering use this ring
   * instead of the axis-aligned `originX/Y + widthFt/lengthFt` rect.
   */
  perimeterRing?: ReadonlyArray<readonly [number, number]>
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
  /**
   * Transform groups keyed by `canvasGroupId`. Members remain in
   * `objects[]`; unjoin deletes only this map entry and member tags.
   */
  objectGroups?: Record<string, CanvasObjectGroup>
  /**
   * Vendor booth layout engine mode (`traffic_aware` default).
   * Persisted via `LayoutRoom.vendor_layout_mode` on save.
   */
  vendorLayoutMode?: 'traffic_aware' | 'fairness_first'
  /** Last fairness-first run score (0–100) for results panel / toasts. */
  lastFairnessScore?: number
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
