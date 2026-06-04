/**
 * Material checklist affiliate + sorting smoke test.
 *
 * Run: npx tsx scripts/verify-material-checklist.ts
 */

import {
  AMAZON_ASSOCIATE_DISCLOSURE,
  AMAZON_ASSOCIATE_TAG,
  buildAmazonCaAffiliateSearchUrl,
  formatMaterialDisplayName,
  processLegacyMaterialLists,
  processMaterialChecklist,
} from '../lib/experience-designer/material-checklist'

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

const uvUrl = buildAmazonCaAffiliateSearchUrl('UV Flashlight')
assert(uvUrl.includes('amazon.ca/s?k='), 'Amazon.ca search URL base')
assert(uvUrl.includes(`tag=${AMAZON_ASSOCIATE_TAG}`), 'Associate tag present')
assert(!uvUrl.match(/\$\d/), 'No static price in URL')

const flat = processMaterialChecklist([
  'optional: glow paint',
  '12V electromagnetic lock',
  'cryptic symbols',
  'elemental weights',
])
assert(flat[0]?.required === true, 'Required items sort first')
assert(flat[flat.length - 1]?.required === false, 'Optional items sort last')
assert(flat.some((i) => i.name === 'Cryptic Symbols' && i.image_url), 'Cryptic symbols image')
assert(
  flat.find((i) => i.name.includes('Periodic Table Chart'))?.display_note?.includes('chart'),
  'Elemental weights clarified as chart'
)
assert(
  flat.every((i) => JSON.stringify(i).indexOf('$') === -1),
  'No dollar pricing in checklist payload'
)

const buckets = processMaterialChecklist({
  required: ['UV flashlight'],
  optional: ['(optional) spare batteries'],
})
assert(buckets.length === 2, 'Bucket schema parses')
assert(buckets[0]?.name === 'UV Flashlight', 'UV title case')
assert(buckets[1]?.required === false, 'Optional bucket respected')

const legacy = processLegacyMaterialLists({
  billOfMaterials: ['4-digit combination padlock'],
  requiredPartsAndProps: ['cryptic symbols (optional)'],
})
assert(legacy.some((i) => i.affiliate_url?.includes('tag=')), 'Legacy lists get affiliate URLs')

assert(
  AMAZON_ASSOCIATE_DISCLOSURE.includes('Amazon Associate'),
  'Disclosure constant defined'
)

assert(
  formatMaterialDisplayName('uv flashlight') === 'UV Flashlight',
  'Acronym title casing'
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
