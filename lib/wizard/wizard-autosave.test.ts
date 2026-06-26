/**
 * Unit checks for draft API response parsing — run:
 *   npx tsx lib/wizard/wizard-autosave.test.ts
 */
import assert from 'node:assert/strict'
import {
  DRAFT_SESSION_EXPIRED_MESSAGE,
  parseDraftApiResponse,
} from './wizard-autosave'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('wizard-autosave')

test('JSON 401 surfaces session-expired guidance', () => {
  const result = parseDraftApiResponse({
    status: 401,
    redirected: false,
    contentType: 'application/json',
    payload: { error: 'Unauthorized' },
  })
  assert.equal(result.error?.message, 'Unauthorized')
})

test('redirected HTML login page is treated as session expired', () => {
  const result = parseDraftApiResponse({
    status: 200,
    redirected: true,
    contentType: 'text/html',
    payload: {},
  })
  assert.equal(result.error?.message, DRAFT_SESSION_EXPIRED_MESSAGE)
})

test('502 HTML error page is not mislabeled as session expired', () => {
  const result = parseDraftApiResponse({
    status: 502,
    redirected: false,
    contentType: 'text/html',
    payload: {},
  })
  assert.match(result.error?.message ?? '', /Server error while saving/)
})

test('JSON 200 without eventId reports save failure, not session expiry', () => {
  const result = parseDraftApiResponse({
    status: 200,
    redirected: false,
    contentType: 'application/json',
    payload: {},
  })
  assert.equal(result.error?.message, 'Could not save market draft')
})

test('JSON 200 with eventId succeeds', () => {
  const result = parseDraftApiResponse({
    status: 200,
    redirected: false,
    contentType: 'application/json',
    payload: { eventId: 'evt-123' },
  })
  assert.equal(result.eventId, 'evt-123')
  assert.equal(result.error, null)
})

console.log('All wizard-autosave tests passed.')
