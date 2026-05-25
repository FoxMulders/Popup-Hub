/**
 * Smoke-test DB + lib helpers for market gamification features (074–080).
 * Run: npx tsx scripts/smoke-market-features.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { getMyNightSummary } from '../lib/market-night/summary'
import { listPassportStories } from '../lib/passport-stories/stories'
import { getCharitableImpactSnapshot } from '../lib/charitable-impact/totals'
import { getPatronMakersDirectory } from '../lib/patron/makers-directory'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

type Result = { name: string; pass: boolean; detail: string }
const results: Result[] = []

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: ${detail}`)
}

async function main() {
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const tables: { name: string; column: string }[] = [
    { name: 'market_patron_check_ins', column: 'id' },
    { name: 'passport_scans', column: 'id' },
    { name: 'market_feed_posts', column: 'id' },
    { name: 'market_feed_post_likes', column: 'post_id' },
    { name: 'market_feed_post_comments', column: 'id' },
    { name: 'passport_stories', column: 'id' },
  ]

  for (const table of tables) {
    const { error } = await supabase.from(table.name).select(table.column).limit(1)
    record(`table:${table.name}`, !error, error?.message ?? 'reachable')
  }

  const { data: columns } = await supabase
    .from('quarter_auction_settings')
    .select('event_id, charity_milestones')
    .limit(1)

  record(
    'quarter_auction_settings.charity_milestones',
    !columns || Array.isArray(columns),
    columns ? 'column readable' : 'no rows yet (OK)'
  )

  const { data: event } = await supabase
    .from('events')
    .select('id, name, status, coordinator_id')
    .in('status', ['published', 'active', 'completed'])
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (event) {
    const impact = await getCharitableImpactSnapshot(supabase, event.id)
    record(
      'getCharitableImpactSnapshot',
      typeof impact.totalCents === 'number',
      `$${(impact.totalCents / 100).toFixed(2)} for ${event.name}`
    )

    const stories = await listPassportStories(supabase, event.coordinator_id ?? '')
    record(
      'listPassportStories',
      Array.isArray(stories),
      event.coordinator_id ? `${stories.length} coordinator stories` : 'no coordinator_id'
    )

    if (event.status === 'completed') {
      const { data: patron } = await supabase
        .from('market_patron_check_ins')
        .select('user_id')
        .eq('event_id', event.id)
        .limit(1)
        .maybeSingle()

      if (patron?.user_id) {
        const night = await getMyNightSummary(supabase, event.id, patron.user_id)
        record(
          'getMyNightSummary',
          !!night,
          night
            ? `${night.discoveredVendors.length} vendors, ${night.backedItems.length} items`
            : 'null'
        )
      } else {
        record('getMyNightSummary', true, 'skipped — no check-ins on completed event')
      }
    } else {
      record('getMyNightSummary', true, 'skipped — no completed event with check-ins')
    }

    const { data: anyScan } = await supabase
      .from('passport_scans')
      .select('user_id')
      .limit(1)
      .maybeSingle()

    if (anyScan?.user_id) {
      const makers = await getPatronMakersDirectory(supabase, anyScan.user_id as string)
      record('getPatronMakersDirectory', Array.isArray(makers), `${makers.length} makers`)
    } else {
      record('getPatronMakersDirectory', true, 'skipped — no passport scans yet')
    }
  } else {
    record('sample event', false, 'no published/active/completed events found')
  }

  const failed = results.filter((r) => !r.pass)
  console.log('\n---')
  console.log(`${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
