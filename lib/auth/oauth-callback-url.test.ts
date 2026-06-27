/**
 * Unit checks for OAuth callback URL helpers — run:
 *   npx tsx lib/auth/oauth-callback-url.test.ts
 */
import assert from 'node:assert/strict'
import {
  NATIVE_OAUTH_CALLBACK_URL,
  apiAuthCallbackHref,
  buildNativeOAuthCallbackUrl,
  buildOAuthCallbackUrl,
} from './oauth-callback-url'

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

test('buildNativeOAuthCallbackUrl appends query params', () => {
  assert.equal(
    buildNativeOAuthCallbackUrl({ code: 'abc', next: '/discover' }),
    `${NATIVE_OAUTH_CALLBACK_URL}?code=abc&next=%2Fdiscover`,
  )
})

test('buildOAuthCallbackUrl uses origin and params', () => {
  assert.equal(
    buildOAuthCallbackUrl('https://popuphub.ca', { role: 'vendor' }),
    'https://popuphub.ca/api/auth/callback?role=vendor',
  )
})

test('apiAuthCallbackHref is the server PKCE exchange path', () => {
  assert.equal(apiAuthCallbackHref(), '/api/auth/callback')
  assert.equal(apiAuthCallbackHref('code=xyz&next=%2Fdiscover'), '/api/auth/callback?code=xyz&next=%2Fdiscover')
})

console.log('All oauth-callback-url tests passed.')
