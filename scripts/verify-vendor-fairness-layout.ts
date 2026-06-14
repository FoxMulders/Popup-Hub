/**
 * Stress / performance verification — run:
 *   npx tsx scripts/verify-vendor-fairness-layout.ts
 */
import { generateFairLayout } from '@/lib/vendor-fairness-layout'
import { generateRoute } from '@/lib/vendor-fairness-layout/route'
import { buildSerpentineAisle, maxBoothDepth } from '@/lib/vendor-fairness-layout/geometry'

const rectRoom = {
  boundary: [
    { x: 0, y: 0 },
    { x: 150, y: 0 },
    { x: 150, y: 100 },
    { x: 0, y: 100 },
  ],
}

function booths(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `v${i}`,
    width: 10,
    height: 8,
  }))
}

function placedBooths(n: number) {
  return booths(n).map((b, i) => ({
    ...b,
    x: 8 + (i % 25) * 5,
    y: 8 + Math.floor(i / 25) * 4,
    rotation: 0,
  }))
}

console.log('Vendor Fairness Layout Engine — stress verification\n')

for (const count of [10, 50, 200]) {
  const t0 = performance.now()
  const result = generateFairLayout(
    {
      room: rectRoom,
      booths: booths(count),
      entrance: { x: 10, y: 95 },
      exit: { x: 140, y: 5 },
    }
  )
  const elapsed = performance.now() - t0
  const ok = count < 200 ? elapsed < 5000 : elapsed < 3000
  console.log(
    `${count} booths: ${elapsed.toFixed(0)}ms | fairness=${result.fairnessScore} | route pts=${result.route.length} ${ok ? '✓' : '⚠ slow'}`
  )
}

const aisle = buildSerpentineAisle(rectRoom, { x: 10, y: 95 }, { x: 140, y: 5 }, 10)
const tRoute = performance.now()
const route200 = generateRoute(
  rectRoom,
  { x: 10, y: 95 },
  { x: 140, y: 5 },
  placedBooths(200),
  aisle
)
const routeMs = performance.now() - tRoute
console.log(
  `\nRoute recalc 200 booths: ${routeMs.toFixed(0)}ms | visits=${route200.visitOrder.length} ${routeMs < 500 ? '✓' : '⚠'}`
)

console.log('\nDone.')
