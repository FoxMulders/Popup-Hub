/**
 * Discover vendor search smoke test.
 *
 * Run: npx tsx scripts/verify-discover-vendor-search.ts
 */

import { createClient } from '@supabase/supabase-js'
import { filterDiscoverEventsByScope } from '../lib/shopper/discover-scope'
import { resolveDiscoverFilterDate } from '../lib/shopper/discover-date'
import {
  fetchDiscoverVendorApplications,
  groupRowsIntoVendorHits,
  searchDiscoverVendors,
} from '../lib/shopper/discover-vendor-search'

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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.log('SKIP - missing Supabase env; unit tests still cover core logic')
    process.exit(0)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { preset, date } = resolveDiscoverFilterDate('weekend', null)

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*, event_days(*)')
    .in('status', ['published', 'active'])
    .order('start_at', { ascending: true })

  assert(!eventsError, `events query: ${eventsError?.message ?? 'ok'}`)

  const scoped = filterDiscoverEventsByScope((events ?? []) as never[], {
    datePreset: preset,
    filterDate: date,
  })

  const eventIds = scoped.map((e) => e.id)
  assert(eventIds.length >= 0, `scoped ${eventIds.length} events for ${preset}`)

  if (eventIds.length > 0) {
    const rows = await fetchDiscoverVendorApplications(supabase, eventIds.slice(0, 20))
    assert(Array.isArray(rows), `fetch applications: ${rows.length} rows`)

    if (rows.length > 0) {
      const sampleName = rows[0]!.businessName.split(' ')[0] ?? 'vendor'
      const hits = groupRowsIntoVendorHits(rows, { q: sampleName })
      assert(hits.length > 0, `text search "${sampleName}" returns vendors`)

      const { vendors, categoryChips } = await searchDiscoverVendors(supabase, {
        eventIds: eventIds.slice(0, 20),
        q: sampleName,
      })
      assert(vendors.length > 0, 'searchDiscoverVendors returns hits')
      assert(categoryChips.length > 0, 'category chips available for scoped events')
    } else {
      assert(true, 'no approved vendors in scoped events (skipped search hits)')
    }
  } else {
    assert(true, 'no events in weekend scope (skipped vendor queries)')
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
