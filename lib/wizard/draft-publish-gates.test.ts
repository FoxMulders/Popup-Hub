import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertDraftCategoryFeesForPublish,
  draftVenueVerificationInput,
} from '@/lib/wizard/draft-publish-gates'

test('assertDraftCategoryFeesForPublish rejects empty categories', () => {
  const result = assertDraftCategoryFeesForPublish([])
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.reason, /at least one booth category/i)
  }
})

test('assertDraftCategoryFeesForPublish rejects missing booth fee', () => {
  const result = assertDraftCategoryFeesForPublish([
    {
      categoryId: 'cat-1',
      categoryName: 'Craft',
      maxSlots: 10,
      pricePerBooth: Number.NaN,
    },
  ])
  assert.equal(result.ok, false)
})

test('assertDraftCategoryFeesForPublish accepts zero-dollar booths', () => {
  const result = assertDraftCategoryFeesForPublish([
    {
      categoryId: 'cat-1',
      categoryName: 'Craft',
      maxSlots: 10,
      pricePerBooth: 0,
    },
  ])
  assert.equal(result.ok, true)
})

test('draftVenueVerificationInput requires a complete address pin', () => {
  const input = draftVenueVerificationInput({
    name: 'Spring Market',
    description: 'A long enough description for the wizard draft payload.',
    locationName: 'Ritchie Hall',
    address: '123 Example Street NW, Edmonton, AB',
    latitude: 53.51,
    longitude: -113.49,
    bookingMode: 'instant',
    allowMlm: false,
    boothClearancePolicy: 'not_required',
    raffleDonationRequirement: '',
    scheduleType: 'single',
    startAt: '2026-07-01T10:00:00.000Z',
    endAt: '2026-07-01T16:00:00.000Z',
  })
  assert.equal(input.pinDropped, true)
})
