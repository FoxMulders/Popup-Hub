/**
 * Unit checks for signup role questionnaire — run:
 *   npx tsx lib/auth/signup-role-questionnaire.test.ts
 */
import assert from 'node:assert/strict'
import {
  nextQuestionnaireStep,
  recommendSignupRole,
  signupRoleSubmitHint,
} from './signup-role-questionnaire'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('signup-role-questionnaire')

test('attend-only path recommends patron', () => {
  const rec = recommendSignupRole({ goal: 'attend' })
  assert.equal(rec?.role, 'shopper')
  assert.equal(rec?.includes, null)
  assert.equal(nextQuestionnaireStep({ goal: 'attend' }), 'result')
})

test('sell without organizing recommends vendor', () => {
  const rec = recommendSignupRole({ goal: 'sell', alsoOrganize: 'no' })
  assert.equal(rec?.role, 'vendor')
  assert.match(rec?.reason ?? '', /vendor passport/i)
  assert.equal(rec?.includes, 'Includes Patron access')
})

test('sell and organize recommends coordinator', () => {
  const rec = recommendSignupRole({ goal: 'sell', alsoOrganize: 'yes' })
  assert.equal(rec?.role, 'coordinator')
  assert.match(rec?.reason ?? '', /run your own events/i)
})

test('organize without selling recommends coordinator', () => {
  const rec = recommendSignupRole({ goal: 'organize', alsoSell: 'no' })
  assert.equal(rec?.role, 'coordinator')
  assert.match(rec?.reason ?? '', /create and run markets/i)
})

test('organize and sell recommends coordinator with superset copy', () => {
  const rec = recommendSignupRole({ goal: 'organize', alsoSell: 'yes' })
  assert.equal(rec?.role, 'coordinator')
  assert.match(rec?.reason ?? '', /also sell as a vendor/i)
})

test('incomplete answers return null recommendation', () => {
  assert.equal(recommendSignupRole({}), null)
  assert.equal(recommendSignupRole({ goal: 'sell' }), null)
  assert.equal(recommendSignupRole({ goal: 'organize' }), null)
})

test('questionnaire step progression', () => {
  assert.equal(nextQuestionnaireStep({}), 'goal')
  assert.equal(nextQuestionnaireStep({ goal: 'sell' }), 'also_organize')
  assert.equal(nextQuestionnaireStep({ goal: 'sell', alsoOrganize: 'no' }), 'result')
  assert.equal(nextQuestionnaireStep({ goal: 'organize' }), 'also_sell')
})

test('submit hints for vendor and coordinator', () => {
  assert.equal(signupRoleSubmitHint('shopper'), null)
  assert.match(signupRoleSubmitHint('vendor') ?? '', /patron browsing/i)
  assert.match(signupRoleSubmitHint('coordinator') ?? '', /coordinator, vendor, and patron/i)
})

console.log('signup-role-questionnaire: all passed')
