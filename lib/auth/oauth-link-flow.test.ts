/**
 * Unit checks for OAuth link-flow detection — run:
 *   npx tsx lib/auth/oauth-link-flow.test.ts
 */
import assert from 'node:assert/strict'
import { isGenuineOAuthLinkFlow } from './oauth-link-flow'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('oauth-link-flow')

test('returns true only when link flag is set and user id is unchanged', () => {
  assert.equal(isGenuineOAuthLinkFlow(true, 'user-a', 'user-a'), true)
})

test('returns false when link flag is missing', () => {
  assert.equal(isGenuineOAuthLinkFlow(false, 'user-a', 'user-a'), false)
})

test('returns false when there was no session before exchange', () => {
  assert.equal(isGenuineOAuthLinkFlow(true, undefined, 'user-a'), false)
})

test('returns false when OAuth created or switched to a different user', () => {
  assert.equal(isGenuineOAuthLinkFlow(true, 'user-a', 'user-b'), false)
})

console.log('All oauth-link-flow tests passed.')
