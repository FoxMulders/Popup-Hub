import { resolvePassportCategoryIds } from '../lib/vendor/passport-categories'

function assert(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) process.exitCode = 1
}

const passport = {
  primary_category_id: 'cat-bakery',
  category_ids: ['cat-bakery', 'cat-jewelry'],
}

const ids = resolvePassportCategoryIds(passport)
assert('passport resolves category ids', ids.includes('cat-bakery') && ids.includes('cat-jewelry'))

const matchesBakery = ids.includes('cat-bakery')
const matchesWood = ids.includes('cat-wood')
assert('category overlap bakery', matchesBakery)
assert('no wood overlap', !matchesWood)

console.log('verify-category-vendor-matches done (no distance filter)')
