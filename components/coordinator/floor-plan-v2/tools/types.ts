import type { AmenityType, ObjectKind } from '../state/types'

/**
 * Three top-level tool modes — modeled on Figma / Miro.
 *
 * - `hand`   : Pan the viewport. No object interaction.
 * - `select` : Click to select, drag to move, marquee to multi-select.
 * - `draw`   : Click-and-drag to create a new object of `drawShape`.
 *
 * Critically, NONE of these modes ever invoke a layout preset, capacity
 * clamp, or auto-population routine. Drawing creates exactly one object
 * per gesture. Clicking empty canvas in `select` mode just clears the
 * selection — it never spawns booths from empty canvas clicks.
 */
export type ToolId = 'hand' | 'select' | 'draw'

/**
 * Sub-mode for the Draw tool. Only consulted when `tool === 'draw'`.
 */
export type DrawShape = ObjectKind

export interface ToolState {
  tool: ToolId
  drawShape: DrawShape
  /** When `drawShape === 'amenity'`, which outdoor stamp to place. */
  amenityType?: AmenityType
}

export const DEFAULT_TOOL_STATE: ToolState = {
  tool: 'select',
  drawShape: 'booth',
}
