import assert from 'node:assert/strict'
import { filterDiscoverEventsByScope } from '@/lib/shopper/discover-scope'
import {
  buildCategoryMarketSummaries,
  getDiscoverCategoryChips,
  groupRowsIntoVendorHits,
  rowMatchesDiscoverVendorFilters,
  vendorMatchesCategoryFilter,
  type DiscoverVendorApplicationRow,
} from '@/lib/shopper/discover-vendor-search'
import { normalizeVendorSearchQuery, vendorTextMatchesSearch } from '@/lib/shopper/vendors'
import type { Event } from '@/types/database'

const sampleRow: DiscoverVendorApplicationRow = {
  vendorId: 'v1',
  eventId: 'e1',
  boothNumber: 12,
  applicationCategoryId: 'cat-wine',
  applicationCategoryName: 'Alcohol',
  businessName: 'The Tipsy Fox',
  logoUrl: null,
  bio: 'Handcrafted wine and gifts',
  primaryCategoryId: 'cat-craft',
  primaryCategoryName: 'Artisan Crafts',
  categoryIds: ['cat-craft', 'cat-wine'],
  eventName: 'Summer Market',
  startAt: '2026-07-04T14:00:00.000Z',
  endAt: '2026-07-04T20:00:00.000Z',
  city: 'Edmonton',
  latitude: 53.5,
  longitude: -113.5,
}

assert.equal(normalizeVendorSearchQuery('  Tipsy '), 'tipsy')
assert.equal(
  vendorTextMatchesSearch(
    { businessName: 'The Tipsy Fox', categoryName: 'Alcohol', bio: 'wine tasting' },
    'tipsy'
  ),
  true
)
assert.equal(
  vendorTextMatchesSearch(
    { businessName: 'The Tipsy Fox', categoryName: 'Alcohol', bio: 'wine tasting' },
    'wine'
  ),
  true
)
assert.equal(
  vendorTextMatchesSearch({ businessName: 'Pottery Co', categoryName: 'Ceramics' }, 'tipsy'),
  false
)

assert.equal(
  vendorMatchesCategoryFilter(sampleRow, 'cat-wine'),
  true,
  'application category matches'
)
assert.equal(
  vendorMatchesCategoryFilter(sampleRow, 'cat-craft'),
  true,
  'passport primary category matches'
)
assert.equal(
  vendorMatchesCategoryFilter(sampleRow, 'cat-other'),
  false,
  'unrelated category does not match'
)

assert.equal(
  rowMatchesDiscoverVendorFilters(sampleRow, { q: 'tipsy' }),
  true,
  'text search matches business name'
)
assert.equal(
  rowMatchesDiscoverVendorFilters(sampleRow, { categoryId: 'cat-wine' }),
  true,
  'category filter matches alcohol row'
)
assert.equal(
  rowMatchesDiscoverVendorFilters(sampleRow, { q: 'tipsy', categoryId: 'cat-other' }),
  false,
  'combined filters require both to match'
)

const secondMarketRow: DiscoverVendorApplicationRow = {
  ...sampleRow,
  eventId: 'e2',
  eventName: 'Fall Fair',
  startAt: '2026-09-12T14:00:00.000Z',
  endAt: '2026-09-12T20:00:00.000Z',
}

const hits = groupRowsIntoVendorHits([sampleRow, secondMarketRow], { q: 'tipsy' })
assert.equal(hits.length, 1, 'groups rows by vendor')
assert.equal(hits[0]?.markets.length, 2, 'aggregates multiple markets per vendor')
assert.equal(hits[0]?.businessName, 'The Tipsy Fox')

const chips = getDiscoverCategoryChips([sampleRow])
assert.ok(chips.some((c) => c.name === 'Alcohol'), 'includes application category chip')
assert.ok(chips.some((c) => c.name === 'Artisan Crafts'), 'includes passport category chip')

const events = [
  {
    id: 'e1',
    name: 'Summer Market',
    start_at: sampleRow.startAt,
    end_at: sampleRow.endAt,
    status: 'published',
    listing_type: 'community_market',
  },
  {
    id: 'e2',
    name: 'Other Market',
    start_at: '2026-07-05T14:00:00.000Z',
    end_at: '2026-07-05T20:00:00.000Z',
    status: 'published',
    listing_type: 'community_market',
  },
] as Event[]

const summaries = buildCategoryMarketSummaries([sampleRow], 'cat-wine', events)
assert.equal(summaries.length, 1, 'only markets with matching vendors')
assert.equal(summaries[0]?.matchingVendorCount, 1)
assert.deepEqual(summaries[0]?.matchingVendorNames, ['The Tipsy Fox'])

const today = new Date('2026-07-04T12:00:00.000Z')
const scoped = filterDiscoverEventsByScope(events, {
  datePreset: 'today',
  filterDate: today,
})
assert.equal(scoped.length, 1, 'discover scope filters by date preset')

console.log('discover-vendor-search.test.ts: all assertions passed')
