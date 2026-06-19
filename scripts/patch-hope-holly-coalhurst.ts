/**
 * Upsert Hope & Holly Christmas in July Market (Coalhurst) and publish.
 * Usage: npx tsx scripts/patch-hope-holly-coalhurst.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { organizerSlugFromName } from '../lib/organizers/slug'

const DISPLAY_NAME = 'The Venue of New Hope & Dezzigner Scrunchies'
const SLUG = organizerSlugFromName(DISPLAY_NAME)
const EVENT_NAME = 'Hope & Holly Christmas in July Market'
const PERMALINK =
  'https://www.facebook.com/groups/352987814777796/posts/27227841860199027/'
const VENDOR_CALL_QUOTE =
  'On the hunt for a few more vendors!! Hope & Holly July 18, 2026 10am-4pm'

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
        display_name: DISPLAY_NAME,
        city: 'Coalhurst',
        province: 'AB',
        region: 'edmonton-metro',
        facebook_url: 'https://www.facebook.com/groups/352987814777796',
        typical_season_or_dates: 'July 18, 2026, 10am–4pm',
        listing_status: 'published',
        source: 'fb_extract',
        admin_notes:
          'vendor_call. permalink_verified. Coalhurst (southern AB). FB group: Trade shows, Events and Markets in Alberta (352987814777796).',
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
    city: 'Coalhurst',
    typical_dates: 'July 18, 2026, 10am–4pm',
    source_snippet: VENDOR_CALL_QUOTE,
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

  const { data: existingMention } = await supabase
    .from('organizer_community_mentions')
    .select('id')
    .eq('organizer_id', org.id)
    .eq('source_permalink', PERMALINK)
    .maybeSingle()

  const mentionPayload = {
    organizer_id: org.id,
    quote: VENDOR_CALL_QUOTE,
    sentiment: null,
    mention_type: 'vendor_call',
    source_snippet: 'Vendor call post — Hope & Holly Christmas in July Market, July 18, 2026.',
    source_permalink: PERMALINK,
    verification_status: 'permalink_verified' as const,
    published: true,
  }

  if (existingMention) {
    const { error: mErr } = await supabase
      .from('organizer_community_mentions')
      .update(mentionPayload)
      .eq('id', existingMention.id)
    if (mErr) throw new Error(`Mention update failed: ${mErr.message}`)
    console.log('Updated vendor-call mention with permalink')
  } else {
    const { error: mErr } = await supabase.from('organizer_community_mentions').insert(mentionPayload)
    if (mErr) throw new Error(`Mention insert failed: ${mErr.message}`)
    console.log('Published vendor-call mention with permalink')
  }

  console.log(`Published at /organizers/${SLUG}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
