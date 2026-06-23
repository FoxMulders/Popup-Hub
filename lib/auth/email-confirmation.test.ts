/**
 * Unit checks for email confirmation helpers — run:
 *   npx tsx lib/auth/email-confirmation.test.ts
 */
import assert from 'node:assert/strict'
import {
  isEmailConfirmed,
  isEmailNotConfirmedAuthError,
  isUnconfirmedUserAllowedPath,
} from './email-confirmation'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('email-confirmation')

test('isEmailConfirmed returns true when email_confirmed_at is set', () => {
  assert.equal(isEmailConfirmed({ email_confirmed_at: '2026-01-01T00:00:00Z' }), true)
  assert.equal(isEmailConfirmed({ email_confirmed_at: undefined }), false)
  assert.equal(isEmailConfirmed(null), false)
})

test('isEmailNotConfirmedAuthError detects Supabase message', () => {
  assert.equal(isEmailNotConfirmedAuthError('Email not confirmed'), true)
  assert.equal(isEmailNotConfirmedAuthError('Invalid login credentials'), false)
})

test('isUnconfirmedUserAllowedPath permits confirm-email and auth routes', () => {
  assert.equal(isUnconfirmedUserAllowedPath('/confirm-email'), true)
  assert.equal(isUnconfirmedUserAllowedPath('/login'), true)
  assert.equal(isUnconfirmedUserAllowedPath('/vendor/events'), false)
})

console.log('All email-confirmation tests passed.')
