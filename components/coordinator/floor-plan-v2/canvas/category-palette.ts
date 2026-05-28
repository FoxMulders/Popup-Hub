/**
 * Deterministic SVG-friendly palette for booth category color-coding.
 *
 * The legacy planner already paints categories with a Tailwind class
 * palette; that doesn't translate cleanly to raw SVG attributes, so the
 * v2 canvas keeps its own hex-based palette here. Every booth with the
 * same `categoryName` lands on the same `{ fill, stroke }` pair on every
 * machine via a 32-bit string hash, so coordinators see the same
 * category colors as their vendors.
 *
 * Two priority tiers determine the painted color, in order:
 *   1. `BoothObject.accentColor` — explicit override picked by the
 *      coordinator in the property inspector.
 *   2. `BoothObject.categoryName` — hashed into the palette below.
 *   3. Fallback to the canonical "amber booth" colors so untagged
 *      booths still pop against the canvas background.
 */

export interface PaletteEntry {
  fill: string
  stroke: string
}

/** Default booth color when a booth has no category and no override. */
export const DEFAULT_BOOTH_PALETTE: PaletteEntry = {
  fill: '#fde68a',
  stroke: '#92400e',
}

/**
 * Curated 10-step palette tuned to read clearly on the off-white canvas
 * background. Each entry is a soft fill paired with a stronger stroke
 * for selection chrome and labels — high enough contrast for
 * accessibility, low enough saturation that a wall of booths doesn't
 * read as a stained-glass window.
 */
const CATEGORY_PALETTE: ReadonlyArray<PaletteEntry> = [
  { fill: '#fde68a', stroke: '#92400e' }, // amber
  { fill: '#bbf7d0', stroke: '#166534' }, // sage
  { fill: '#fbcfe8', stroke: '#9d174d' }, // rose
  { fill: '#bfdbfe', stroke: '#1e40af' }, // blue
  { fill: '#fed7aa', stroke: '#9a3412' }, // orange
  { fill: '#ddd6fe', stroke: '#5b21b6' }, // violet
  { fill: '#fef3c7', stroke: '#854d0e' }, // butter
  { fill: '#a7f3d0', stroke: '#065f46' }, // mint
  { fill: '#fecaca', stroke: '#991b1b' }, // brick
  { fill: '#cffafe', stroke: '#155e75' }, // cyan
]

/** FNV-1a-ish 32-bit hash so identical names always land on the same slot. */
function hashName(name: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/**
 * Look up the palette entry for `categoryName`. Empty / null names fall
 * back to the canonical default booth palette — so an unfiled booth and
 * an "Art & Prints" booth never accidentally collide on the same color.
 */
export function paletteForCategory(
  categoryName: string | null | undefined
): PaletteEntry {
  if (!categoryName) return DEFAULT_BOOTH_PALETTE
  const trimmed = categoryName.trim()
  if (!trimmed) return DEFAULT_BOOTH_PALETTE
  const idx = hashName(trimmed.toLowerCase()) % CATEGORY_PALETTE.length
  return CATEGORY_PALETTE[idx]!
}
