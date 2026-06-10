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

/** Canonical vendor booth colors — green when clearance is good (≥4′ aisle). */
export const VENDOR_BOOTH_PALETTE: PaletteEntry = {
  fill: '#bbf7d0',
  stroke: '#16a34a',
}

/** @deprecated Alias — use {@link VENDOR_BOOTH_PALETTE}. */
export const DEFAULT_BOOTH_PALETTE: PaletteEntry = VENDOR_BOOTH_PALETTE

/** Patron / guest seating tables — always purple on the layout canvas. */
export const PATRON_TABLE_PALETTE: PaletteEntry = {
  fill: '#ddd6fe',
  stroke: '#5b21b6',
}

/**
 * Curated 12-step high-contrast palette tuned to read clearly on the
 * off-white canvas background. Each entry is a soft fill paired with
 * a stronger stroke for selection chrome and labels — high enough
 * contrast for accessibility (WCAG AA against #fafaf9 backgrounds),
 * low enough saturation that a wall of booths doesn't read as a
 * stained-glass window.
 *
 * Each fill/stroke pair is visibly distinct from every other entry —
 * adjacent booths of different categories never read as the same
 * color even at small zoom levels.
 */
export const CATEGORY_PALETTE: ReadonlyArray<PaletteEntry> = [
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
  { fill: '#f5d0fe', stroke: '#86198f' }, // fuchsia
  { fill: '#e2e8f0', stroke: '#334155' }, // slate
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
 *
 * When `eventCategoryNames` is provided, the palette is selected by
 * INDEX into that list (so the first N distinct categories of an event
 * always land on N visually distinct slots, even if their hashes
 * happen to collide). This is the variant the canvas should prefer —
 * it eliminates the slim probability of two categories on the same
 * event sharing a color due to hash collision.
 *
 * When `eventCategoryNames` is omitted (e.g. legacy callsites or
 * standalone tests), we fall back to the deterministic name-hash
 * lookup so colors stay stable across machines.
 */
export function paletteForCategory(
  categoryName: string | null | undefined,
  eventCategoryNames?: ReadonlyArray<string>
): PaletteEntry {
  if (!categoryName) return DEFAULT_BOOTH_PALETTE
  const trimmed = categoryName.trim()
  if (!trimmed) return DEFAULT_BOOTH_PALETTE

  if (eventCategoryNames && eventCategoryNames.length > 0) {
    const lower = trimmed.toLowerCase()
    const idx = eventCategoryNames.findIndex(
      (n) => n.trim().toLowerCase() === lower
    )
    if (idx >= 0) {
      return CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length]!
    }
  }

  const idx = hashName(trimmed.toLowerCase()) % CATEGORY_PALETTE.length
  return CATEGORY_PALETTE[idx]!
}

/**
 * Advance `categoryName` to the next entry in `eventCategoryNames`,
 * wrapping back to the first entry after the last. Used by the paste
 * pipeline to diversify cloned booths so a coordinator pasting a
 * "Food" booth lands on "Retail", then "Art", etc.
 *
 * Returns `null` when no event categories are defined (caller should
 * leave the booth's category unchanged in that case). Returns the
 * first entry when the source category isn't found in the list (e.g.
 * the booth is currently untagged or holds a stale category that the
 * coordinator just removed from the event).
 */
export function nextCategoryName(
  categoryName: string | null | undefined,
  eventCategoryNames: ReadonlyArray<string>
): string | null {
  if (!eventCategoryNames || eventCategoryNames.length === 0) return null
  if (!categoryName) return eventCategoryNames[0]!
  const lower = categoryName.trim().toLowerCase()
  const idx = eventCategoryNames.findIndex(
    (n) => n.trim().toLowerCase() === lower
  )
  if (idx < 0) return eventCategoryNames[0]!
  return eventCategoryNames[(idx + 1) % eventCategoryNames.length]!
}
