/**
 * Unit checks for OAuth callback URL helpers — run:
 *   npx tsx lib/auth/oauth-callback-url.test.ts
 */
import assert from 'node:assert/strict'
import { apiAuthCallbackHref } from './oauth-callback-url'

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

test('apiAuthCallbackHref returns bare path when no query', () => {
  assert.equal(apiAuthCallbackHref(), '/api/auth/callback')
  assert.equal(apiAuthCallbackHref(''), '/api/auth/callback')
})

test('apiAuthCallbackHref appends query string', () => {
  const params = new URLSearchParams({ code: 'abc', role: 'vendor' })
  assert.equal(apiAuthCallbackHref(params), '/api/auth/callback?code=abc&role=vendor')
  assert.equal(apiAuthCallbackHref('code=abc'), '/api/auth/callback?code=abc')
})
