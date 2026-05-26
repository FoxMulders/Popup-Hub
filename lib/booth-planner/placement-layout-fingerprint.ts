import type { BoothCell, VenueElement } from '@/types/database'

/** Stable fingerprint for memoizing placement bitmaps and guards. */
export function placementLayoutFingerprint(
  cols: number,
  rows: number,
  venueElements: VenueElement[],
  boothCells: BoothCell[],
  excludeBoothId?: string
): string {
  const venue = venueElements
    .map((el) => `${el.id ?? ''}:${el.type}:${el.row}:${el.col}:${el.colSpan ?? 1}:${el.rowSpan ?? 1}:${el.locked ? 1 : 0}`)
    .join('|')
  const booths = boothCells
    .filter((c) => c.col >= 0 && c.row >= 0 && c.id !== excludeBoothId)
    .map((c) => `${c.id}:${c.row}:${c.col}:${c.rowSpan}:${c.colSpan}`)
    .join('|')
  return `${cols}x${rows}#${venue}#${booths}#${excludeBoothId ?? ''}`
}
