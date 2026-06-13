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
  tailwindSwatch: 'bg-emerald-200 ring-1 ring-emerald-600',
  fill: '#bbf7d0',
  stroke: '#16a34a',
  fillOpacity: 0.85,
} as const

/** Toolbar vendor draw + size chips (matches {@link VENDOR_BOOTH_PALETTE}). */
export const VENDOR_BOOTH_TOOLBAR = {
  buttonIdle: 'bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100',
  buttonActive: 'bg-emerald-200 text-emerald-950 hover:bg-emerald-200',
  chipActive: 'bg-emerald-200 text-emerald-950',
  chipActiveBorder:
    'border-emerald-300/80 bg-emerald-200 text-emerald-950 hover:bg-emerald-200',
  metricsBadge: 'border-emerald-200/90 bg-emerald-50/80 text-emerald-900',
} as const
