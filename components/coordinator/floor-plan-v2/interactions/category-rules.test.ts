/**
 * Unit checks for same-category proximity rules — run:
 *   npx tsx components/coordinator/floor-plan-v2/interactions/category-rules.test.ts
 */
import assert from 'node:assert/strict'
import {
  PROXIMITY_MIN_COLUMNS,
  PROXIMITY_MIN_ROWS,
  boothEdgeGapsInGridSpaces,
  findBoothProximityViolation,
  findFirstViolationInMove,
  isBoothProximityViolation,
  sameCategoryProximityViolated,
} from './category-rules'
import type { BoothObject } from '../state/types'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

function booth(
  id: string,
  x: number,
  y: number,
  category: string | null = 'Food'
): BoothObject {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width: 6,
    height: 6,
    rotation: 0,
    accentColor: null,
    categoryName: category,
  }
}

console.log('category-rules tests')

test('threshold constants match 4-column / 2-row freeze', () => {
  assert.equal(PROXIMITY_MIN_COLUMNS, 4)
  assert.equal(PROXIMITY_MIN_ROWS, 2)
})

test('boothEdgeGapsInGridSpaces measures edge-to-edge in grid spaces', () => {
  const a = { x: 0, y: 0, width: 6, height: 6 }
  const b = { x: 10, y: 0, width: 6, height: 6 }
  const gaps = boothEdgeGapsInGridSpaces(a, b, 1)
  assert.equal(gaps.dxColumns, 4)
  assert.equal(gaps.dyRows, 0)
})

test('same-category proximity violated when both axes are tight', () => {
  const a = { x: 0, y: 0, width: 6, height: 6, categoryName: 'Food' }
  const b = { x: 8, y: 0, width: 6, height: 6, categoryName: 'Food' }
  assert.equal(sameCategoryProximityViolated(a, b, 1), true)
})

test('same-category proximity allowed when horizontal gap is wide enough', () => {
  const a = { x: 0, y: 0, width: 6, height: 6, categoryName: 'Food' }
  const b = { x: 10, y: 0, width: 6, height: 6, categoryName: 'Food' }
  assert.equal(sameCategoryProximityViolated(a, b, 1), false)
})

test('different categories never violate proximity rule', () => {
  const a = { x: 0, y: 0, width: 6, height: 6, categoryName: 'Food' }
  const b = { x: 1, y: 1, width: 6, height: 6, categoryName: 'Art' }
  assert.equal(sameCategoryProximityViolated(a, b, 1), false)
})

test('findBoothProximityViolation skips self and untagged booths', () => {
  const candidate = booth('a', 0, 0, 'Food')
  const others = [booth('a', 0, 0, 'Food'), booth('b', 20, 0, 'Food')]
  assert.equal(findBoothProximityViolation(candidate, others, 1), null)
  assert.equal(findBoothProximityViolation(booth('c', 0, 0, null), others, 1), null)
})

test('findBoothProximityViolation flags tight same-category neighbor', () => {
  const candidate = booth('a', 0, 0, 'Food')
  const others = [booth('b', 8, 0, 'Food')]
  const violation = findBoothProximityViolation(candidate, others, 1)
  assert.ok(violation)
  assert.equal(violation!.conflictId, 'b')
  assert.equal(isBoothProximityViolation(candidate, others, 1), true)
})

test('findFirstViolationInMove checks candidates against others only', () => {
  const candidates = [booth('a', 0, 0, 'Food'), booth('b', 8, 0, 'Food')]
  const others = [booth('c', 30, 0, 'Retail')]
  assert.equal(findFirstViolationInMove(candidates, others, 1), null)
})

console.log('category-rules tests passed')
