import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type { BoothObject, FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  BOOTH_CLEARANCE_CRITICAL_FT,
  BOOTH_CLEARANCE_GOOD_FT,
  BOOTH_CLEARANCE_TIGHT_FT,
  clearanceBand,
  minVendorBoothClearanceFt,
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

/** Per-booth clearance bands for vendor booths on the doc. */
export function summarizeDocClearanceIssues(doc: FloorPlanDoc): DocClearanceSummary {
  const rooms = doc.rooms ?? []
  const issues: BoothClearanceIssueRow[] = []

  for (const obj of doc.objects) {
    if (obj.kind !== 'booth') continue
    const booth = obj as BoothObject
    if (isGuestTableBooth(booth)) continue
    if (!isVendorBoothObject(booth)) continue

    const minFt = minVendorBoothClearanceFt(
      booth,
      doc.objects,
      rooms,
      doc.objectRoom
    )
    const band = clearanceBand(minFt)
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

export function formatClearanceFeet(minFt: number): string {
  if (!Number.isFinite(minFt)) return '—'
  const rounded = Math.round(minFt * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}′` : `${rounded.toFixed(1)}′`
}

export const BOOTH_CLEARANCE_WARNING_EXPLANATION = {
  title: 'Booth aisle clearance',
  intro:
    'Vendor booths are tinted by the shortest edge-to-edge gap to another vendor booth or to walls, stages, and doors.',
  yellow:
    `Yellow (tight): ${BOOTH_CLEARANCE_TIGHT_FT}′–${BOOTH_CLEARANCE_GOOD_FT - 1}′ clearance — shoppers can squeeze through, but aim for ${BOOTH_CLEARANCE_GOOD_FT}′ before publishing.`,
  red:
    `Red (critical): less than ${BOOTH_CLEARANCE_TIGHT_FT}′ clearance (${BOOTH_CLEARANCE_CRITICAL_FT}′ or less is especially tight) — move the booth or widen the aisle.`,
  green: `Green (ideal): ${BOOTH_CLEARANCE_GOOD_FT}′ or more — comfortable two-way patron traffic.`,
  toggleHint:
    'Hide yellow/red booth tints and this alert from the header toolbar — click the clearance warnings button (triangle icon) next to patron flow.',
} as const
