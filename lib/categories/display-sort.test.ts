/**
 * Unit checks for coordinator MLM display sort — run:
 *   npx tsx lib/categories/display-sort.test.ts
 */
import assert from 'node:assert/strict'
import { compareCategoryNamesWithMlmBroadFirst } from '@/lib/categories'
import { PASSPORT_MLM_BROAD_CATEGORY_NAME } from '@/lib/vendor/passport-categories'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('compareCategoryNamesWithMlmBroadFirst')

test('pins broad MLM before brand names', () => {
  assert.equal(
    compareCategoryNamesWithMlmBroadFirst(PASSPORT_MLM_BROAD_CATEGORY_NAME, 'Norwex'),
    -1
  )
})

test('pins broad MLM first when arguments are reversed', () => {
  assert.equal(
    compareCategoryNamesWithMlmBroadFirst('Mary Kay', PASSPORT_MLM_BROAD_CATEGORY_NAME),
    1
  )
})

test('sorts non-MLM-broad names alphabetically', () => {
  assert.equal(compareCategoryNamesWithMlmBroadFirst('Avon', 'Norwex'), -1)
  assert.equal(compareCategoryNamesWithMlmBroadFirst('Norwex', 'Avon'), 1)
})

console.log('\nAll display-sort tests passed.')
