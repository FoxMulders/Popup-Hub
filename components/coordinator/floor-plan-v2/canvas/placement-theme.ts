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

/** Legend + canvas vendor booth swatch (matches {@link VENDOR_BOOTH_PALETTE}). */
export const VENDOR_BOOTH_LEGEND = {
  tailwindSwatch: 'bg-yellow-200 ring-1 ring-yellow-500',
  fill: '#FEF08A',
  stroke: '#EAB308',
  fillOpacity: 0.85,
} as const
