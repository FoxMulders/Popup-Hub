import assert from 'node:assert/strict'
import test from 'node:test'
import { roomFrameWizardFieldsMatch } from '@/lib/floor-plan/venue-profile'

const baseFrame = {
  name: 'Main Hall',
  widthFt: 80,
  lengthFt: 60,
  originX: 0,
  originY: 0,
  venueProfile: 'indoor' as const,
}

test('roomFrameWizardFieldsMatch treats indoor profile as equivalent to undefined', () => {
  assert.equal(
    roomFrameWizardFieldsMatch(
      { ...baseFrame, venueProfile: undefined },
      { ...baseFrame, venueProfile: 'indoor' }
    ),
    true
  )
})

test('roomFrameWizardFieldsMatch detects outdoor profile change', () => {
  assert.equal(
    roomFrameWizardFieldsMatch(baseFrame, { ...baseFrame, venueProfile: 'outdoor' }),
    false
  )
})
