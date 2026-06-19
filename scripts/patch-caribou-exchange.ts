/**
 * Upsert Caribou Exchange (Tanya Hillmer) quarter auction listing and publish.
 * Usage: npx tsx scripts/patch-caribou-exchange.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { organizerSlugFromName } from '../lib/organizers/slug'

const SLUG = organizerSlugFromName('Caribou Exchange')
const EVENT_NAME = 'Caribou Exchange! Quarter Auction'

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local')
  try {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const i = trimmed.indexOf('=')
      if (i === -1) continue
      const key = trimmed.slice(0, i).trim()
      const value = trimmed.slice(i + 1).trim()
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // optional
  }
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env in .env.local')

  const supabase = createClient(url, key)

  const { data: org, error: orgErr } = await supabase
    .from('organizers')
    .upsert(
      {
        slug: SLUG,
        display_name: 'Caribou Exchange',
        primary_contact_name: 'Tanya Hillmer',
        city: 'Edmonton',
        province: 'AB',
        region: 'edmonton-metro',
        facebook_url: 'https://www.facebook.com/groups/867393673824882',
        typical_season_or_dates: 'Quarter auction series — first 2026 event announced',
        listing_status: 'published',
        source: 'fb_extract',
        admin_notes:
          'vendor_call (positive). source_permalink NOT_PROVIDED — listing only until permalink. booth_fee_cad $2 likely quarter/table fee not traditional booth. Monitor FB group for charity payout validation and schedule updates.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )
    .select('id')
    .single()

  if (orgErr || !org) throw new Error(`Organizer upsert failed: ${orgErr?.message}`)

  const { data: existingEvent } = await supabase
    .from('organizer_events')
    .select('id')
    .eq('organizer_id', org.id)
    .eq('name', EVENT_NAME)
    .maybeSingle()

  const eventPayload = {
    organizer_id: org.id,
    name: EVENT_NAME,
    city: 'Edmonton',
    typical_dates: 'Quarter auction series — first 2026 event announced',
    booth_fee_cad: 2,
    source_snippet:
      "ARE YOU READY??? WE'RE BACK!!! Join us for the first quarter auction of 2026!",
    listing_status: 'published' as const,
  }

  if (existingEvent) {
    const { error: evErr } = await supabase
      .from('organizer_events')
      .update(eventPayload)
      .eq('id', existingEvent.id)
    if (evErr) throw new Error(`Event update failed: ${evErr.message}`)
    console.log('Updated event', EVENT_NAME)
  } else {
    const { error: evErr } = await supabase.from('organizer_events').insert(eventPayload)
    if (evErr) throw new Error(`Event insert failed: ${evErr.message}`)
    console.log('Inserted event', EVENT_NAME)
  }

  console.log(`Caribou Exchange published at /organizers/${SLUG}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
