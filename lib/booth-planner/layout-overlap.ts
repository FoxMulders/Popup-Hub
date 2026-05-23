import type { BoothCell, VenueElement } from '@/types/database'
import { cellKey } from '@/lib/booth-planner/venue-elements'

export const OVERLAP_RULE_FAILURE_MESSAGE =
  '⚠️ RULE FAILURE: Overlapping Booth Detected. Layout cannot be saved or pushed until this conflict is resolved.'

const STRUCTURAL_TYPES = new Set(['column', 'entrance', 'exit', 'door', 'aisle'])

export interface LayoutOverlapResult {
  overlapKeys: Set<string>
  hasOverlap: boolean
  messages: string[]
}

function claimCell(
  claims: Map<string, Set<string>>,
  r: number,
  c: number,
  label: string
): void {
  const key = cellKey(r, c)
  const set = claims.get(key) ?? new Set<string>()
  set.add(label)
  claims.set(key, set)
}

function fixtureClaimLabel(el: VenueElement): string {
  if (el.type === 'column') return 'wall'
  return el.type
}

function isStructuralClaim(label: string): boolean {
  return label.startsWith('booth:') || STRUCTURAL_TYPES.has(label) || label === 'wall'
}

/** Detect every grid cell claimed by more than one booth or structural asset. */
export function detectLayoutOverlaps(input: {
  cells: BoothCell[]
  rows: number
  cols: number
  venueElements: VenueElement[]
}): LayoutOverlapResult {
  const { cells, rows, cols, venueElements } = input
  const claims = new Map<string, Set<string>>()
  const overlapKeys = new Set<string>()
  const messages: string[] = []

  for (const el of venueElements) {
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    const label = fixtureClaimLabel(el)
    for (let r = el.row; r < el.row + spanR; r++) {
      for (let c = el.col; c < el.col + spanC; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue
        claimCell(claims, r, c, label)
      }
    }
  }

  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0) continue
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) {
          overlapKeys.add(cellKey(Math.max(0, r), Math.max(0, c)))
          messages.push(`Booth ${cell.vendorName} extends outside the grid`)
          continue
        }
        claimCell(claims, r, c, `booth:${cell.id}`)
      }
    }
  }

  for (const [key, owners] of claims) {
    if (owners.size <= 1) continue

    const labels = [...owners]
    const boothClaims = labels.filter((l) => l.startsWith('booth:'))
    const structuralClaims = labels.filter((l) => isStructuralClaim(l) && !l.startsWith('booth:'))

    const boothVsBooth = boothClaims.length >= 2
    const boothVsStructure =
      boothClaims.length >= 1 &&
      (structuralClaims.length >= 1 || labels.some((l) => l === 'wall' || STRUCTURAL_TYPES.has(l)))

    if (boothVsBooth || boothVsStructure) {
      overlapKeys.add(key)
      if (boothVsBooth) {
        messages.push(`Overlapping booths at ${key}`)
      } else {
        messages.push(`Booth overlaps structure at ${key} (${labels.join(' + ')})`)
      }
    }
  }

  const hasOverlap = overlapKeys.size > 0
  if (hasOverlap) {
    messages.unshift(OVERLAP_RULE_FAILURE_MESSAGE)
  }

  return { overlapKeys, hasOverlap, messages }
}
