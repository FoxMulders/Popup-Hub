import assert from 'node:assert/strict'
import {
  vendorMarketApplyPath,
  vendorMarketInviteUrl,
} from '@/lib/coordinator/vendor-outreach'

const origin = 'https://popuphub.ca'

assert.equal(vendorMarketApplyPath('evt-123'), '/vendor/events/evt-123')

const invite = vendorMarketInviteUrl('evt-123', origin)
assert.equal(
  invite,
  'https://popuphub.ca/signup?role=vendor&next=%2Fvendor%2Fevents%2Fevt-123'
)

console.log('vendor-outreach: ok')
