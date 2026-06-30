/**
 * Unit checks for page back navigation — run:
 *   npx tsx lib/navigation/page-back.test.ts
 */
import assert from 'node:assert/strict'
import { isPageBackExcluded, pageBackFallbackHref } from './page-back'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('page-back')

test('portal homes exclude back affordance', () => {
  assert.equal(isPageBackExcluded('/discover'), true)
  assert.equal(isPageBackExcluded('/vendor/dashboard'), true)
})

test('event vendor detail has fallback to event page', () => {
  assert.equal(
    pageBackFallbackHref('/events/abc123/vendors/vendor-1'),
    '/events/abc123'
  )
})

test('nested event routes fall back to discover', () => {
  assert.equal(pageBackFallbackHref('/events/abc123/map'), '/events/abc123')
})

console.log('All page-back tests passed.')
