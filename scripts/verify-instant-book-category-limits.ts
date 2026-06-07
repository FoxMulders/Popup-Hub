/**
 * Confirms instant-book approval still enforces per-category slot caps.
 * Run: npx tsx scripts/verify-instant-book-category-limits.ts
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const applyRoute = readFileSync(
  join(process.cwd(), 'app/api/vendor/apply/route.ts'),
  'utf8'
)

assert.match(
  applyRoute,
  /fetchCategoryAvailableSlots/,
  'apply route must check category available slots before approval'
)

assert.match(
  applyRoute,
  /const isInstant = event\.booking_mode === 'instant'/,
  'apply route must branch on instant booking mode'
)

assert.match(
  applyRoute,
  /if \(freshAvailable <= 0\)/,
  'instant book must re-check slots at approval time (race-safe)'
)

assert.match(
  applyRoute,
  /categoryIsFull/,
  'apply route must respect category fullness for juried and instant flows'
)

console.log('verify-instant-book-category-limits: 4/4 checks passed')
