/**
 * Placement HUD + draw-preview colours.
 *
 * "Available" must not use green (reserved for brand / success elsewhere).
 * Violation stays warning red.
 */
export const PLACEMENT_AVAILABLE = {
  tailwindSwatch: 'bg-sky-500 ring-1 ring-sky-700/30',
  tailwindSwatchCollapsed: 'bg-sky-500 ring-1 ring-sky-700/30',
  fill: '#bae6fd',
  stroke: '#0284c7',
  fillOpacity: 0.45,
} as const

export const PLACEMENT_VIOLATION = {
  tailwindSwatch: 'bg-rose-500 ring-1 ring-rose-700/30',
  fill: '#fecaca',
  stroke: '#ef4444',
  fillOpacity: 0.55,
} as const
