/**
 * Unit checks for Apple S2S notification parsing — run:
 *   npx tsx lib/auth/apple-s2s-notifications.test.ts
 */
import assert from 'node:assert/strict'
import { parseAppleNotificationEvents } from './apple-s2s-notifications'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('apple-s2s-notifications')

test('parseAppleNotificationEvents extracts account-deleted', () => {
  const event = parseAppleNotificationEvents({
    events: {
      type: 'account-deleted',
      sub: '001234.abc.def',
      event_time: 1_700_000_000,
    },
  })

  assert.ok(event)
  assert.equal(event.type, 'account-deleted')
  assert.equal(event.sub, '001234.abc.def')
  assert.equal(event.email, undefined)
})

test('parseAppleNotificationEvents parses stringified events claim', () => {
  const event = parseAppleNotificationEvents({
    events: JSON.stringify({
      type: 'consent-revoked',
      sub: '001234.abc.def',
      event_time: 1_700_000_000,
    }),
  })

  assert.ok(event)
  assert.equal(event.type, 'consent-revoked')
  assert.equal(event.sub, '001234.abc.def')
})

test('parseAppleNotificationEvents extracts consent-revoked with email', () => {
  const event = parseAppleNotificationEvents({
    events: {
      type: 'consent-revoked',
      sub: '001234.abc.def',
      email: 'relay@privaterelay.appleid.com',
    },
  })

  assert.ok(event)
  assert.equal(event.type, 'consent-revoked')
  assert.equal(event.email, 'relay@privaterelay.appleid.com')
})

test('parseAppleNotificationEvents accepts email-enabled and email-disabled', () => {
  assert.equal(
    parseAppleNotificationEvents({ events: { type: 'email-enabled', sub: 'x' } })?.type,
    'email-enabled',
  )
  assert.equal(
    parseAppleNotificationEvents({ events: { type: 'email-disabled', sub: 'x' } })?.type,
    'email-disabled',
  )
})

test('parseAppleNotificationEvents rejects missing or invalid claims', () => {
  assert.equal(parseAppleNotificationEvents({}), null)
  assert.equal(parseAppleNotificationEvents({ events: null }), null)
  assert.equal(parseAppleNotificationEvents({ events: { type: 'unknown', sub: 'x' } }), null)
  assert.equal(parseAppleNotificationEvents({ events: { type: 'account-deleted' } }), null)
  assert.equal(parseAppleNotificationEvents({ events: { type: 'account-delete', sub: 'x' } }), null)
})

console.log('All apple-s2s-notifications tests passed.')
