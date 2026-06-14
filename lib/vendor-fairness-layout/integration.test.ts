/**
 * Integration tests — run: npx tsx lib/vendor-fairness-layout/integration.test.ts
 */
import assert from 'node:assert/strict'
import { generateFairLayout } from './index'
import { generateRoute } from './route'
import { buildSerpentineAisle, maxBoothDepth } from './geometry'
import type { Booth, LayoutRequest } from './types'

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
    } catch (e) {
      console.error(`  ✗ ${name}`)
      throw e
    }
  })()
}

function makeBooths(n: number, w = 10, h = 8): Booth[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `b${i}`,
    width: w,
    height: h,
  }))
}

const rectRoom: LayoutRequest['room'] = {
  boundary: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 80 },
    { x: 0, y: 80 },
  ],
}

const lRoom: LayoutRequest['room'] = {
  boundary: [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 40 },
    { x: 100, y: 40 },
    { x: 100, y: 80 },
    { x: 0, y: 80 },
  ],
}

const irregularRoom: LayoutRequest['room'] = {
  boundary: [
    { x: 5, y: 5 },
    { x: 95, y: 8 },
    { x: 98, y: 55 },
    { x: 70, y: 78 },
    { x: 15, y: 75 },
    { x: 2, y: 40 },
  ],
}

async function main() {
  console.log('vendor-fairness-layout integration tests')

  await test('rectangle 10 booths', () => {
    const result = generateFairLayout(
      {
        room: rectRoom,
        booths: makeBooths(10),
        entrance: { x: 10, y: 75 },
        exit: { x: 90, y: 5 },
      },
      { timeBudgetMs: 800 }
    )
    assert.equal(result.placements.length, 10)
    assert.ok(result.fairnessScore >= 0 && result.fairnessScore <= 100)
    assert.ok(result.route.length >= 2)
  })

  await test('L-shaped 10 booths', () => {
    const result = generateFairLayout(
      {
        room: lRoom,
        booths: makeBooths(10),
        entrance: { x: 10, y: 75 },
        exit: { x: 90, y: 10 },
      },
      { timeBudgetMs: 800 }
    )
    assert.equal(result.placements.length, 10)
  })

  await test('irregular polygon 10 booths', () => {
    const result = generateFairLayout(
      {
        room: irregularRoom,
        booths: makeBooths(10),
        entrance: { x: 20, y: 70 },
        exit: { x: 80, y: 15 },
      },
      { timeBudgetMs: 800 }
    )
    assert.equal(result.placements.length, 10)
  })

  await test('50 booths under time budget', () => {
    const t0 = performance.now()
    const result = generateFairLayout(
      {
        room: rectRoom,
        booths: makeBooths(50),
        entrance: { x: 5, y: 75 },
        exit: { x: 95, y: 5 },
      },
      { timeBudgetMs: 1500 }
    )
    const elapsed = performance.now() - t0
    assert.equal(result.placements.length, 50)
    console.log(`    50 booths: ${elapsed.toFixed(0)}ms, fairness=${result.fairnessScore}`)
    assert.ok(elapsed < 5000, `too slow: ${elapsed}ms`)
  })

  await test('route recalc 200 booths <500ms', () => {
    const booths = makeBooths(200).map((b, i) => ({
      id: b.id,
      x: 5 + (i % 20) * 4.5,
      y: 5 + Math.floor(i / 20) * 3.8,
      width: b.width,
      height: b.height,
      rotation: 0,
    }))
    const aisle = buildSerpentineAisle(
      rectRoom,
      { x: 5, y: 75 },
      { x: 95, y: 5 },
      maxBoothDepth(booths)
    )
    const t0 = performance.now()
    const route = generateRoute(
      rectRoom,
      { x: 5, y: 75 },
      { x: 95, y: 5 },
      booths,
      aisle,
      2
    )
    const elapsed = performance.now() - t0
    console.log(`    route 200 booths: ${elapsed.toFixed(0)}ms, visits=${route.visitOrder.length}`)
    assert.ok(elapsed < 500, `route too slow: ${elapsed}ms`)
  })

  console.log('All integration tests passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
