/**
 * Public path allowlist — run:
 *   npx tsx lib/auth/public-paths.test.ts
 */
import assert from 'node:assert/strict'
import { isPublicPath } from './public-paths'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('public paths')

test('discover pages are public', () => {
  assert.equal(isPublicPath('/discover'), true)
  assert.equal(isPublicPath('/discover?view=vendors'), true)
})

test('discover vendor search API is public for anonymous patrons', () => {
  assert.equal(isPublicPath('/api/discover/vendors'), true)
})

test('coordinator APIs remain protected', () => {
  assert.equal(isPublicPath('/api/coordinator/events/abc'), false)
})

console.log('All public path tests passed.')
