import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCoordinatorSuggestionClaimNote,
  MIN_VERIFICATION_NOTE_LENGTH,
  validateOrganizerClaimVerificationNote,
} from './claim-verification'

test('validateOrganizerClaimVerificationNote rejects short notes', () => {
  const result = validateOrganizerClaimVerificationNote('too short')
  assert.equal(result.ok, false)
})

test('buildCoordinatorSuggestionClaimNote meets minimum length', () => {
  const note = buildCoordinatorSuggestionClaimNote('Test Market', ['Matches your organization name'])
  assert.ok(note.length >= MIN_VERIFICATION_NOTE_LENGTH)
  assert.ok(validateOrganizerClaimVerificationNote(note).ok)
})
