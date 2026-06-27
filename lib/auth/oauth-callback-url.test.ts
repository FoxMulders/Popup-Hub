/**
 * Unit checks for OAuth callback URL helpers — run:
 *   npx tsx lib/auth/oauth-callback-url.test.ts
 */
import assert from 'node:assert/strict'
import { oauthCallbackPath } from './oauth-callback-url'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('oauth-callback-url')

test('oauthCallbackPath builds the server exchange route', () => {
  assert.equal(oauthCallbackPath(), '/api/auth/callback')
  assert.equal(
    oauthCallbackPath('code=abc&role=vendor'),
    '/api/auth/callback?code=abc&role=vendor',
  )
})

console.log('All oauth-callback-url tests passed.')
