/**
 * Unit checks for duplicate-account helpers — run:
 *   npx tsx lib/auth/duplicate-account.test.ts
 */
import assert from 'node:assert/strict'
import {
  shouldRollbackFreshOAuthDuplicate,
  type DuplicateDeletionBlocker,
} from './duplicate-account'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('duplicate-account')

test('shouldRollbackFreshOAuthDuplicate allows delete when no blockers', () => {
  assert.equal(shouldRollbackFreshOAuthDuplicate([]), true)
})

test('shouldRollbackFreshOAuthDuplicate blocks delete when account has data', () => {
  const blockers: DuplicateDeletionBlocker[] = [
    {
      code: 'owned_events',
      message: 'Account owns 2 market(s). Merge data manually before deleting.',
    },
  ]
  assert.equal(shouldRollbackFreshOAuthDuplicate(blockers), false)
})

console.log('All duplicate-account tests passed.')
