import assert from 'node:assert/strict'
import { PUBLIC_MARKET_CATALOG_EXCLUDE_TEST } from '@/lib/queries/public-market-catalog'

assert.equal(PUBLIC_MARKET_CATALOG_EXCLUDE_TEST, false)

console.log('public market catalog filter tests passed')
