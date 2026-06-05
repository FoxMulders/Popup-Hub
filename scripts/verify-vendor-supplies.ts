/**
 * Vendor supplies affiliate smoke test.
 *
 * Run: npx tsx scripts/verify-vendor-supplies.ts
 */

import {
  AMAZON_ASSOCIATE_TAG,
  buildAmazonCaAffiliateSearchUrl,
} from '../lib/affiliate/amazon'
import {
  VENDOR_SUPPLY_SUGGESTIONS,
  filterVendorSupplies,
} from '../lib/vendor/supplies-catalog'

let pass = 0
let fail = 0

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

const searchUrl = buildAmazonCaAffiliateSearchUrl('portable clothing rack')
assert(searchUrl.includes('amazon.ca/s?k='), 'Amazon.ca search URL base')
assert(searchUrl.includes(`tag=${AMAZON_ASSOCIATE_TAG}`), 'Associate tag on search URL')
assert(!searchUrl.match(/\$\d/), 'No static price in search URL')

assert(VENDOR_SUPPLY_SUGGESTIONS.length >= 10, 'Curated suggestion list populated')
assert(
  VENDOR_SUPPLY_SUGGESTIONS.every(
    (item) =>
      item.affiliate_url.includes('amazon.ca') && item.affiliate_url.includes(`tag=${AMAZON_ASSOCIATE_TAG}`)
  ),
  'Every suggestion uses affiliate search URL'
)

const boothOnly = filterVendorSupplies(VENDOR_SUPPLY_SUGGESTIONS, { category: 'booth' })
assert(boothOnly.length > 0, 'Booth category filter returns items')
assert(boothOnly.every((item) => item.category === 'booth'), 'Booth filter is exclusive')

const filtered = filterVendorSupplies(VENDOR_SUPPLY_SUGGESTIONS, { query: 'canopy' })
assert(filtered.some((item) => item.id === 'canopy-tent'), 'Text filter matches name/query')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
