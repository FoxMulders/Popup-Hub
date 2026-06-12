/**
 * Smoke test — grid vendor layout should not false-flag overlap or clearance.
 */
import { detectPlacedObjectOverlaps } from '../components/coordinator/floor-plan-v2/interactions/geometry'
import {
  clearanceBand,
  minVendorBoothClearanceFt,
} from '../lib/coordinator/booth-clearance-visual'
import type { BoothObject } from '../components/coordinator/floor-plan-v2/state/types'

function vendor(id: string, x: number, y: number): BoothObject {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width: 6,
    height: 2,
    rotation: 0,
    accentColor: null,
    tablePurpose: 'vendor',
  }
}

function runScenario(label: string, pitchX: number, pitchY: number) {
  const booths: BoothObject[] = []
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (row === 3 && col === 3) continue
      booths.push(vendor(`b${row}${col}`, col * pitchX + 3, row * pitchY + 3))
    }
  }

  const overlaps = detectPlacedObjectOverlaps(booths)
  const badClearance: string[] = []
  for (const b of booths) {
    const min = minVendorBoothClearanceFt(b, booths, [], {})
    if (clearanceBand(min) !== 'good') badClearance.push(`${b.id}=${min.toFixed(2)}ft`)
  }
  console.log(label, {
    overlaps: [...overlaps].sort(),
    badClearance,
  })
  return { overlaps, badClearance }
}

// 6′ edge gap (auto-arrange pitch)
runScenario('6ft gap', 12, 8)
// 3′ edge gap — must not overlap; may show aisle warnings only
runScenario('3ft gap', 9, 8)
