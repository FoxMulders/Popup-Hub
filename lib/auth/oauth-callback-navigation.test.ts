/**
 * OAuth callback navigation helpers — run:
 *   npx tsx lib/auth/oauth-callback-navigation.test.ts
 */
import assert from 'node:assert/strict'
import { buildServerOAuthCallbackHref } from './oauth-callback-navigation'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('oauth-callback-navigation')

test('buildServerOAuthCallbackHref without query', () => {
  assert.equal(buildServerOAuthCallbackHref(''), '/api/auth/callback')
})

test('buildServerOAuthCallbackHref preserves OAuth params', () => {
  assert.equal(
    buildServerOAuthCallbackHref('code=abc&role=vendor&next=%2Fvendor%2Fdashboard'),
    '/api/auth/callback?code=abc&role=vendor&next=%2Fvendor%2Fdashboard'
  )
})

console.log('All oauth-callback-navigation tests passed.')
