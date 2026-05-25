/**
 * Configure a test market for gamification feature QA.
 * Run: npx tsx scripts/configure-market-features-test-event.ts
 *
 * Uses PLAYWRIGHT_SMOKE_EVENT_NAME or the most recent published/active event.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
const eventName = process.env.PLAYWRIGHT_SMOKE_EVENT_NAME ?? 'Market Test 3'

async function main() {
  if (!url || !key) {
    console.error('Missing Supabase env vars in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let query = supabase
    .from('events')
    .select('id, name, status')
    .in('status', ['published', 'active'])
    .order('start_at', { ascending: false })

  const { data: named } = await query.ilike('name', `%${eventName}%`).limit(1).maybeSingle()

  const event =
    named ??
    (
      await supabase
        .from('events')
        .select('id, name, status')
        .in('status', ['published', 'active'])
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data

  if (!event) {
    console.error('No published/active event found to configure.')
    process.exit(1)
  }

  const { error: eventError } = await supabase
    .from('events')
    .update({
      status: 'active',
      passport_vendors_required: 5,
    })
    .eq('id', event.id)

  if (eventError) {
    console.error('Failed to update event:', eventError.message)
    process.exit(1)
  }

  const { error: qasError } = await supabase.from('quarter_auction_settings').upsert(
    {
      event_id: event.id,
      enabled: true,
      charity_milestones: [
        { amount_cents: 50000, label: 'Community Garden Beds' },
        { amount_cents: 100000, label: 'Local Youth Supplies' },
        { amount_cents: 250000, label: 'Neighborhood Food Pantry' },
      ],
    },
    { onConflict: 'event_id' }
  )

  if (qasError) {
    console.error('Failed to update quarter_auction_settings:', qasError.message)
    process.exit(1)
  }

  console.log('Configured market features test event:')
  console.log(`  Event: ${event.name} (${event.id})`)
  console.log('  status → active')
  console.log('  passport_vendors_required → 5')
  console.log('  charity_milestones → 3 defaults')
  console.log('')
  console.log('Manual QA URLs:')
  console.log(`  Patron event:  /events/${event.id}`)
  console.log(`  Quarter auction: /events/${event.id}/quarter-auction`)
  console.log(`  Vendor dashboard: /vendor/dashboard`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
