import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type { BoothObject, FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  BOOTH_CLEARANCE_GOOD_FT,
  BOOTH_CLEARANCE_TIGHT_FT,
  clearanceBand,
  minVendorBoothBoundaryClearanceFt,
  minVendorBoothClearanceFt,
  vendorBoothBoundaryWarningBand,
  type BoothClearanceBand,
} from '@/lib/coordinator/booth-clearance-visual'

export interface BoothClearanceIssueRow {
  id: string
  label: string
  minClearanceFt: number
  band: BoothClearanceBand
}

export interface DocClearanceSummary {
  criticalCount: number
  tightCount: number
  issues: BoothClearanceIssueRow[]
}

/** Per-booth boundary clearance bands for vendor booths on the doc. */
export function summarizeDocClearanceIssues(doc: FloorPlanDoc): DocClearanceSummary {
  const rooms = doc.rooms ?? []
  const issues: BoothClearanceIssueRow[] = []

  for (const obj of doc.objects) {
    if (obj.kind !== 'booth') continue
    const booth = obj as BoothObject
    if (isGuestTableBooth(booth)) continue
    if (!isVendorBoothObject(booth)) continue

    const minFt = minVendorBoothBoundaryClearanceFt(
      booth,
      doc.objects,
      rooms,
      doc.objectRoom
    )
    const band = vendorBoothBoundaryWarningBand(
      booth,
      doc.objects,
      rooms,
      doc.objectRoom
    )
    if (band === 'good') continue

    issues.push({
      id: booth.id,
      label:
        booth.label?.trim() ||
        `Booth at ${Math.round(booth.x)}′, ${Math.round(booth.y)}′`,
      minClearanceFt: minFt,
      band,
    })
  }

  issues.sort((a, b) => a.minClearanceFt - b.minClearanceFt)

  return {
    criticalCount: issues.filter((row) => row.band === 'critical').length,
    tightCount: issues.filter((row) => row.band === 'tight').length,
    issues,
  }
}

/** Aisle gap between two vendor booths (informational — not a boundary violation). */
export function vendorBoothAisleClearanceFt(
  booth: BoothObject,
  objects: ReadonlyArray<PlacedObject>
): number {
  return minVendorBoothClearanceFt(booth, objects, undefined, {})
}

export function formatClearanceFeet(minFt: number): string {
  if (!Number.isFinite(minFt)) return '—'
  const rounded = Math.round(minFt * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}′` : `${rounded.toFixed(1)}′`
}

export const BOOTH_CLEARANCE_WARNING_EXPLANATION = {
  title: 'Booth boundary clearance',
  intro:
    'Vendor booths are tinted when they sit too close to room walls, stages, doors, or other structural fixtures. Neighbouring vendor spacing is not flagged here — only real boundary conflicts.',
  yellow:
    `Yellow (warning): less than ${BOOTH_CLEARANCE_GOOD_FT}′ to a wall or fixture — move the booth inward or away from the obstacle.`,
  red:
    'Red (overlap): booth footprints physically intersect another object — separate the booths until their borders no longer touch.',
  green: `Green (ideal): ${BOOTH_CLEARANCE_GOOD_FT}′ or more from every boundary — comfortable placement.`,
  toggleHint:
    'Hide yellow/green booth tints and this alert from the header toolbar — click the clearance warnings button (triangle icon) next to patron flow.',
} as const
