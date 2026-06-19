/**
 * Import Edmonton FB seed batches into organizers tables (draft, unpublished).
 * Usage: npm run seed:edmonton:import
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL in .env.local
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { organizerSlugFromName } from '../lib/organizers/slug'

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local')
  try {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim()
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch {
    // optional when vars exported
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local`)
  }
  return value
}

type Table1Row = {
  display_name: string
  primary_contact_name?: string | null
  city: string
  website_url?: string
  facebook_url?: string
  instagram_handle?: string
  typical_season_or_dates?: string
  event_name?: string
  booth_fee_cad?: number
  source_snippet?: string
  admin_notes?: string
}

type Table2File = {
  thread_permalink?: string
  scam_alerts: Array<{
    organizer_slug: string
    alert_title: string
    alert_body: string
    source_snippet?: string
    source_permalink?: string
    verification_status?: string
    published?: boolean
  }>
  watchlist: Array<{
    slug: string
    display_name: string
    warning_title: string
    warning_body: string
    source_snippet?: string
    source_permalink?: string
    admin_notes?: string
    verification_status?: string
    published?: boolean
  }>
  community_mentions: Array<{
    organizer_slug: string
    coordinator_person_name?: string | null
    quote: string
    sentiment?: string
    mention_type?: string
    source_snippet?: string
    source_permalink?: string
    verification_status?: string
    published?: boolean
  }>
}

const root = join(process.cwd(), 'scripts', 'seed')

async function main() {
  loadEnvLocal()
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key)
  const table1 = JSON.parse(
    readFileSync(join(root, 'edmonton-fb-table1-batch1.json'), 'utf8')
  ) as Table1Row[]
  const table2 = JSON.parse(
    readFileSync(join(root, 'edmonton-fb-table2-batch1.json'), 'utf8')
  ) as Table2File

  const slugToId = new Map<string, string>()

  for (const row of table1) {
    const slug = organizerSlugFromName(row.display_name)
    const { data: existing } = await supabase
      .from('organizers')
      .select('id, listing_status')
      .eq('slug', slug)
      .maybeSingle()

    const organizerPayload = {
      slug,
      display_name: row.display_name,
      primary_contact_name: row.primary_contact_name ?? null,
      city: row.city,
      province: 'AB',
      region: 'edmonton-metro',
      website_url: row.website_url ?? null,
      facebook_url: row.facebook_url ?? null,
      instagram_handle: row.instagram_handle ?? null,
      typical_season_or_dates: row.typical_season_or_dates ?? null,
      listing_status: existing?.listing_status ?? 'draft',
      source: 'fb_extract',
      admin_notes: row.admin_notes ?? null,
    }

    const { data: org, error } = await supabase
      .from('organizers')
      .upsert(organizerPayload, { onConflict: 'slug' })
      .select('id, slug')
      .single()

    if (error) {
      console.error('organizer upsert failed', slug, error.message)
      continue
    }

    slugToId.set(org.slug, org.id)
    console.log('organizer', org.slug)

    if (row.event_name) {
      const { error: evErr } = await supabase.from('organizer_events').insert({
        organizer_id: org.id,
        name: row.event_name,
        city: row.city,
        typical_dates: row.typical_season_or_dates ?? null,
        booth_fee_cad: row.booth_fee_cad ?? null,
        source_snippet: row.source_snippet ?? null,
        listing_status: 'draft',
      })
      if (evErr) console.error('event insert', slug, evErr.message)
    }
  }

  for (const alert of table2.scam_alerts) {
    const organizerId = slugToId.get(alert.organizer_slug)
    if (!organizerId) {
      console.warn('scam alert skipped — organizer not found', alert.organizer_slug)
      continue
    }
    const { error } = await supabase.from('organizer_scam_alerts').insert({
      organizer_id: organizerId,
      alert_title: alert.alert_title,
      alert_body: alert.alert_body,
      source_snippet: alert.source_snippet ?? null,
      source_permalink: alert.source_permalink ?? null,
      verification_status: alert.verification_status ?? 'ai_extract_unverified',
      published: alert.published ?? false,
    })
    if (error) console.error('scam alert', error.message)
    else console.log('scam alert (draft)', alert.organizer_slug)
  }

  for (const entry of table2.watchlist) {
    const { error } = await supabase.from('scam_watchlist').upsert(
      {
        slug: entry.slug,
        display_name: entry.display_name,
        warning_title: entry.warning_title,
        warning_body: entry.warning_body,
        source_snippet: entry.source_snippet ?? null,
        source_permalink: entry.source_permalink ?? null,
        verification_status: entry.verification_status ?? 'ai_extract_unverified',
        published: entry.published ?? false,
      },
      { onConflict: 'slug' }
    )
    if (error) console.error('watchlist', error.message)
    else console.log('watchlist (draft)', entry.slug)
  }

  for (const mention of table2.community_mentions) {
    const organizerId = slugToId.get(mention.organizer_slug)
    if (!organizerId) continue
    const { error } = await supabase.from('organizer_community_mentions').insert({
      organizer_id: organizerId,
      coordinator_person_name: mention.coordinator_person_name ?? null,
      quote: mention.quote,
      sentiment: mention.sentiment ?? null,
      mention_type: mention.mention_type ?? 'other',
      source_snippet: mention.source_snippet ?? null,
      source_permalink: mention.source_permalink ?? null,
      verification_status: mention.verification_status ?? 'ai_extract_unverified',
      published: mention.published ?? false,
    })
    if (error) console.error('mention', error.message)
    else console.log('mention (draft)', mention.organizer_slug)
  }

  console.log('\nDone. All rows imported as draft / unpublished. Publish via admin after verification.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
