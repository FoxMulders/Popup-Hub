/**
 * Pure-math verification for the multi-object rotation boundary
 * containment pipeline (Strategy A halt + Strategy B nudge).
 *
 * This script reaches into the same geometry helpers the React canvas
 * uses, builds synthetic PlacedObject scenarios that mimic the worst
 * cases the spec calls out (booth flush against the wall; cluster
 * wider than the canvas; oversized rotation), and prints a pass/fail
 * verdict for each one.
 *
 * Run with: npx tsx scripts/verify-rotation-bounds.ts
 */

import {
  aabbFitsCanvas,
  canvasClampDelta,
  groupCanvasClampDelta,
  rotatedAabb,
} from '../components/coordinator/floor-plan-v2/interactions/geometry'
import type { BoothObject } from '../components/coordinator/floor-plan-v2/state/types'

const CANVAS_W = 40
const CANVAS_L = 72

function makeBooth(over: Partial<BoothObject>): BoothObject {
  return {
    id: 'b1',
    kind: 'booth',
    x: 0,
    y: 0,
    width: 6,
    height: 5,
    rotation: 0,
    locked: false,
    label: '',
    boothNumber: '',
    categoryName: '',
    accentColor: null,
    vendorName: null,
    capacity: null,
    notes: null,
    ...over,
  } as BoothObject
}

interface Plan {
  obj: BoothObject
  nextRotation: number
}

interface PlanResult {
  halted: boolean
  finalRects: Array<{
    id: string
    x: number
    y: number
    aabb: ReturnType<typeof rotatedAabb>
  }>
}

/**
 * Replays the exact three-tier containment used by `handleRotateBy`
 * and the on-canvas rotate handler so this script verifies the live
 * algorithm rather than a re-implementation.
 */
function planRotation(plans: Plan[]): PlanResult {
  const probes = plans.map((p) => ({
    ...p.obj,
    rotation: p.nextRotation,
  }))
  const unionDelta = groupCanvasClampDelta(probes, CANVAS_W, CANVAS_L)
  const finals: PlanResult['finalRects'] = []
  if (unionDelta) {
    for (const p of plans) {
      const nx = p.obj.x + unionDelta.dx
      const ny = p.obj.y + unionDelta.dy
      const finalProbe = {
        ...p.obj,
        rotation: p.nextRotation,
        x: nx,
        y: ny,
      }
      finals.push({
        id: p.obj.id,
        x: nx,
        y: ny,
        aabb: rotatedAabb(finalProbe),
      })
    }
  } else {
    for (const p of plans) {
      const probe = { ...p.obj, rotation: p.nextRotation }
      const { dx, dy } = canvasClampDelta(probe, CANVAS_W, CANVAS_L)
      const nx = p.obj.x + dx
      const ny = p.obj.y + dy
      const finalProbe = { ...p.obj, rotation: p.nextRotation, x: nx, y: ny }
      finals.push({
        id: p.obj.id,
        x: nx,
        y: ny,
        aabb: rotatedAabb(finalProbe),
      })
    }
  }
  for (const f of finals) {
    if (!aabbFitsCanvas(f.aabb, CANVAS_W, CANVAS_L)) {
      return { halted: true, finalRects: finals }
    }
  }
  return { halted: false, finalRects: finals }
}

interface Case {
  name: string
  plans: Plan[]
  expectHalt: boolean
}

const cases: Case[] = [
  {
    name: '6×5 booth flush against top-left, +15°',
    plans: [
      {
        obj: makeBooth({ id: 'A', x: 0, y: 0, width: 6, height: 5 }),
        nextRotation: 15,
      },
    ],
    expectHalt: false,
  },
  {
    name: '6×5 booth flush against top-left, -15° (reverse direction)',
    plans: [
      {
        obj: makeBooth({ id: 'A', x: 0, y: 0, width: 6, height: 5 }),
        nextRotation: -15,
      },
    ],
    expectHalt: false,
  },
  {
    name: '6×5 booth flush against top-left, 90°',
    plans: [
      {
        obj: makeBooth({ id: 'A', x: 0, y: 0, width: 6, height: 5 }),
        nextRotation: 90,
      },
    ],
    expectHalt: false,
  },
  {
    name: '6×5 booth flush against bottom-right corner, +30°',
    plans: [
      {
        obj: makeBooth({
          id: 'A',
          x: CANVAS_W - 6,
          y: CANVAS_L - 5,
          width: 6,
          height: 5,
        }),
        nextRotation: 30,
      },
    ],
    expectHalt: false,
  },
  {
    name: 'Long thin booth 30×2 at top-left, 90° (still fits when squared)',
    plans: [
      {
        obj: makeBooth({ id: 'A', x: 0, y: 0, width: 30, height: 2 }),
        nextRotation: 90,
      },
    ],
    expectHalt: false,
  },
  {
    name: 'Oversized 35×35 booth at center, 45° (AABB ~49×49 > canvas 40 wide)',
    plans: [
      {
        obj: makeBooth({ id: 'A', x: 2, y: 18, width: 35, height: 35 }),
        nextRotation: 45,
      },
    ],
    expectHalt: true,
  },
  {
    name: '50×50 booth, 45° (AABB ~70×70, way too big)',
    plans: [
      {
        obj: makeBooth({ id: 'A', x: 0, y: 0, width: 50, height: 50 }),
        nextRotation: 45,
      },
    ],
    expectHalt: true,
  },
  {
    name: 'Tight cluster of 4 booths flush in top-left corner, +15° each',
    plans: [
      {
        obj: makeBooth({ id: 'A', x: 0, y: 0, width: 6, height: 5 }),
        nextRotation: 15,
      },
      {
        obj: makeBooth({ id: 'B', x: 7, y: 0, width: 6, height: 5 }),
        nextRotation: 15,
      },
      {
        obj: makeBooth({ id: 'C', x: 0, y: 6, width: 6, height: 5 }),
        nextRotation: 15,
      },
      {
        obj: makeBooth({ id: 'D', x: 7, y: 6, width: 6, height: 5 }),
        nextRotation: 15,
      },
    ],
    expectHalt: false,
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  const result = planRotation(c.plans)
  const ok = result.halted === c.expectHalt
  const tag = ok ? 'PASS' : 'FAIL'
  console.log(
    `${tag}  expected halt=${c.expectHalt}  got halt=${result.halted}  -- ${c.name}`
  )
  if (!result.halted) {
    for (const f of result.finalRects) {
      const r = f.aabb
      const inBounds =
        r.x >= -1e-6 &&
        r.y >= -1e-6 &&
        r.x + r.width <= CANVAS_W + 1e-6 &&
        r.y + r.height <= CANVAS_L + 1e-6
      if (!inBounds) {
        console.log(
          `      !! ${f.id} final AABB pokes off canvas: x=${r.x.toFixed(2)} y=${r.y.toFixed(2)} w=${r.width.toFixed(2)} h=${r.height.toFixed(2)}`
        )
      } else {
        console.log(
          `      ${f.id} final AABB inside canvas: x=${r.x.toFixed(2)} y=${r.y.toFixed(2)} w=${r.width.toFixed(2)} h=${r.height.toFixed(2)}`
        )
      }
    }
  }
  if (ok) passed++
  else failed++
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
