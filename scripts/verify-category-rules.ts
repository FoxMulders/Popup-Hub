/**
 * Smoke test for the booth category color/proximity/paste rules.
 *
 *   1. `paletteForCategory(name, eventCategoryNames)` produces a
 *      *unique* color for each entry of `eventCategoryNames` (no two
 *      categories collide as long as we stay within the palette
 *      length).
 *   2. `nextCategoryName` cycles through the list and wraps.
 *   3. `findBoothProximityViolation` flags same-category booths
 *      within `<5 cols AND <2 rows` and ignores everything else.
 */

import {
  CATEGORY_PALETTE,
  nextCategoryName,
  paletteForCategory,
} from '../components/coordinator/floor-plan-v2/canvas/category-palette'
import {
  findBoothProximityViolation,
  PROXIMITY_MIN_COLUMNS,
  PROXIMITY_MIN_ROWS,
} from '../components/coordinator/floor-plan-v2/interactions/category-rules'
import type {
  BoothObject,
  PlacedObject,
} from '../components/coordinator/floor-plan-v2/state/types'

let failed = 0
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

function booth(
  id: string,
  x: number,
  y: number,
  category: string | null = null
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

console.log('paletteForCategory — index-based selection guarantees uniqueness')
{
  const cats = ['Food', 'Retail', 'Art', 'Music', 'Service']
  const fills = cats.map((c) => paletteForCategory(c, cats).fill)
  const unique = new Set(fills)
  expect('all 5 categories pick distinct fills', unique.size, 5)
  // Each lookup is stable across runs.
  expect(
    'Food maps to first palette slot',
    paletteForCategory('Food', cats).fill,
    CATEGORY_PALETTE[0]!.fill
  )
  expect(
    'Retail maps to second palette slot',
    paletteForCategory('Retail', cats).fill,
    CATEGORY_PALETTE[1]!.fill
  )
  // Case-insensitive lookup.
  expect(
    'lowercase match still hits the index slot',
    paletteForCategory('food', cats).fill,
    CATEGORY_PALETTE[0]!.fill
  )
}

console.log('paletteForCategory — falls back to hash when category not in event list')
{
  const cats = ['Food', 'Retail']
  // "Mystery" isn't in the event list — must still produce a deterministic palette entry.
  const a = paletteForCategory('Mystery', cats)
  const b = paletteForCategory('Mystery', cats)
  expect('hash fallback is deterministic', a.fill, b.fill)
}

console.log('paletteForCategory — empty/null falls back to default')
{
  const def = paletteForCategory(null)
  expect('default booth fill', def.fill, '#fde68a')
  const def2 = paletteForCategory('   ')
  expect('whitespace falls back too', def2.fill, '#fde68a')
}

console.log('nextCategoryName — wraps and handles edge cases')
{
  const cats = ['Food', 'Retail', 'Art']
  expect('Food → Retail', nextCategoryName('Food', cats), 'Retail')
  expect('Retail → Art', nextCategoryName('Retail', cats), 'Art')
  expect('Art → Food (wrap)', nextCategoryName('Art', cats), 'Food')
  expect('case-insensitive lookup', nextCategoryName('food', cats), 'Retail')
  expect('untagged → first', nextCategoryName(null, cats), 'Food')
  expect('unknown → first', nextCategoryName('Mystery', cats), 'Food')
  expect('empty list → null', nextCategoryName('Food', []), null)
}

console.log('proximity — same-category < 5 cols AND < 2 rows triggers')
{
  const gridFt = 1
  const a = booth('a', 0, 0, 'Food')
  const b = booth('b', 4, 1, 'Food') // dx=4 cols, dy=1 row → both below thresholds
  const v = findBoothProximityViolation(b, [a], gridFt)
  expect('violation reported', v?.conflictId, 'a')
  expect('dxColumns reported', v?.dxColumns, 4)
  expect('dyRows reported', v?.dyRows, 1)
}

console.log('proximity — boundary cases')
{
  const gridFt = 1
  // dx exactly = 5 (boundary not less than 5) → NO violation
  const a = booth('a', 0, 0, 'Food')
  const b = booth('b', 5, 1, 'Food')
  expect(
    '5-col gap is exactly the threshold (no violation)',
    findBoothProximityViolation(b, [a], gridFt),
    null
  )
  // dy exactly = 2 → NO violation
  const c = booth('c', 0, 2, 'Food')
  expect(
    '2-row gap is exactly the threshold (no violation)',
    findBoothProximityViolation(c, [a], gridFt),
    null
  )
}

console.log('proximity — different categories never trigger')
{
  const gridFt = 1
  const a = booth('a', 0, 0, 'Food')
  const b = booth('b', 1, 1, 'Retail')
  expect(
    'Food vs Retail does not trigger',
    findBoothProximityViolation(b, [a], gridFt),
    null
  )
}

console.log('proximity — untagged booths exempt')
{
  const gridFt = 1
  const a = booth('a', 0, 0, null)
  const b = booth('b', 1, 1, null)
  expect(
    'two untagged booths never trigger',
    findBoothProximityViolation(b, [a], gridFt),
    null
  )
}

console.log('proximity — non-booth others ignored')
{
  const gridFt = 1
  const wall: PlacedObject = {
    id: 'w',
    kind: 'wall',
    x: 0,
    y: 0,
    width: 6,
    height: 6,
    rotation: 0,
  } as PlacedObject
  const b = booth('b', 1, 1, 'Food')
  expect('wall does not count as same-category', findBoothProximityViolation(b, [wall], gridFt), null)
}

console.log('proximity — grid spacing scales the rule')
{
  // gridSpacing = 4 ft → 5 cols = 20 ft, 2 rows = 8 ft
  const gridFt = 4
  const a = booth('a', 0, 0, 'Food')
  const b = booth('b', 18, 0, 'Food') // dx=18 ft → 4.5 cols, dy=0 rows → both below thresholds
  const v = findBoothProximityViolation(b, [a], gridFt)
  expect('large grid spacing scales threshold', v !== null, true)
  const c = booth('c', 24, 0, 'Food') // dx=6 cols → above threshold
  expect(
    'placement past the scaled threshold is allowed',
    findBoothProximityViolation(c, [a], gridFt),
    null
  )
}

console.log('proximity — constants match the spec')
{
  expect('PROXIMITY_MIN_COLUMNS = 5', PROXIMITY_MIN_COLUMNS, 5)
  expect('PROXIMITY_MIN_ROWS = 2', PROXIMITY_MIN_ROWS, 2)
}

console.log('paste cycling integration — n cycles always lands on next category')
{
  const cats = ['Food', 'Retail', 'Art']
  // Simulate the floor-plan-v2 paste loop: source = "Food", paste counts 0, 1, 2.
  function pasteAdvance(source: string | null, cycleSteps: number) {
    let cur: string | null = source
    for (let i = 0; i <= cycleSteps; i++) {
      cur = nextCategoryName(cur, cats)
    }
    return cur
  }
  expect('paste #0 from Food → Retail', pasteAdvance('Food', 0), 'Retail')
  expect('paste #1 from Food → Art', pasteAdvance('Food', 1), 'Art')
  expect('paste #2 from Food → Food (wrap)', pasteAdvance('Food', 2), 'Food')
  expect('paste #3 from Food → Retail', pasteAdvance('Food', 3), 'Retail')
}

if (failed > 0) {
  console.log(`\n${failed} assertion(s) FAILED`)
  process.exit(1)
}
console.log('\nAll category-rules assertions passed.')
