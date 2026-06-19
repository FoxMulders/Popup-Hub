import { organizerSlugFromName } from '../lib/organizers/slug'
import { parseOrganizerReviewPayload } from '../lib/organizers/validate-review-payload'

function assert(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) process.exitCode = 1
}

function main() {
  const slug = organizerSlugFromName('Hope & Holly Markets')
  assert('slug derived from display name', slug.length > 0)

  const existingPayload = parseOrganizerReviewPayload({
    organizerSlug: 'agora-markets',
    eventName: 'Summer market',
    eventMonthYear: '2025-07',
    eventAsAdvertised: 'yes',
    wouldReturn: true,
    attendanceVsExpectations: 'about_right',
    communicationRating: 4,
    refundExperience: 'na',
  })
  assert('existing organizer payload parses', existingPayload.ok && existingPayload.data.mode === 'existing')

  const suggestPayload = parseOrganizerReviewPayload({
    notListed: true,
    suggestOrganizer: {
      displayName: 'New Market Co',
      city: 'Edmonton',
      websiteUrl: 'https://example.com',
    },
    eventName: 'Holiday market',
    eventMonthYear: '2024-12',
    eventAsAdvertised: 'partial',
    wouldReturn: false,
    attendanceVsExpectations: 'lower',
    communicationRating: 3,
    refundExperience: 'na',
  })
  assert('suggest organizer payload parses', suggestPayload.ok && suggestPayload.data.mode === 'suggest')

  const missingCity = parseOrganizerReviewPayload({
    notListed: true,
    suggestOrganizer: { displayName: 'Test Org', city: '' },
    eventName: 'Market',
    eventMonthYear: '2024-01',
    eventAsAdvertised: 'yes',
    wouldReturn: true,
    attendanceVsExpectations: 'about_right',
    communicationRating: 5,
  })
  assert('missing city rejected', !missingCity.ok)

  const missingOrganizer = parseOrganizerReviewPayload({
    eventName: 'Market',
    eventMonthYear: '2024-01',
    eventAsAdvertised: 'yes',
    wouldReturn: true,
    attendanceVsExpectations: 'about_right',
    communicationRating: 5,
  })
  assert('missing organizer rejected', !missingOrganizer.ok)

  console.log('verify-organizer-submissions done')
}

main()
