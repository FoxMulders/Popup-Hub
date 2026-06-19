/**
 * Vet Edmonton organizer trust directory: archive venue misclassifications,
 * fix borderline entries, add Lauderdale Community League.
 *
 * Usage: npx tsx scripts/patch-organizer-list-vet.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { organizerSlugFromName } from '../lib/organizers/slug'

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

/** Venues or event titles mistaken for organizers during FB extract. */
const ARCHIVE_VENUES: Array<{ slug: string; reason: string }> = [
  {
    slug: 'garden-valley-community-centre',
    reason:
      'Venue only (Spruce Grove community centre). FB post referenced a Christmas market at the facility — organizer unknown until verified.',
  },
  {
    slug: 'st-paul-rec-center',
    reason:
      'Venue only (St. Paul recreation centre). UFO Market organizer not identified — rec centre is the location, not the fee collector.',
  },
  {
    slug: 'the-craft-vault',
    reason:
      'Retail store / venue (Edmonton). One-off store-opening vendor call — not a recurring market organizer.',
  },
  {
    slug: 'the-venue-of-new-hope-dezzigner-scrunchies',
    reason:
      'Venue name from FB extract. Hope & Holly market organizer not verified — archived until a named organizer is confirmed.',
  },
]

const LAUDERDALE = {
  display_name: 'Lauderdale Community League',
  slug: organizerSlugFromName('Lauderdale Community League'),
  city: 'Edmonton',
  website_url: 'https://lauderdalecl.ca/',
  typical_season_or_dates: 'Year-round community programs; seasonal markets and hall events',
  admin_notes:
    'LEGITIMATE organizer. Edmonton community league (est. 1956). Verified official site lauderdalecl.ca. Hall at 12937 107 St NW.',
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env in .env.local')

  const supabase = createClient(url, key)

  for (const { slug, reason } of ARCHIVE_VENUES) {
    const { data: org, error: fetchErr } = await supabase
      .from('organizers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (fetchErr) throw new Error(`Lookup ${slug}: ${fetchErr.message}`)
    if (!org) {
      console.log(`Skip archive (not found): ${slug}`)
      continue
    }

    const { error } = await supabase
      .from('organizers')
      .update({
        listing_status: 'archived',
        admin_notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id)

    if (error) throw new Error(`Archive ${slug}: ${error.message}`)

    await supabase
      .from('organizer_events')
      .update({ listing_status: 'archived' })
      .eq('organizer_id', org.id)

    console.log(`Archived ${slug}`)
  }

  // Event title used as organizer name — rename to the actual organizing body.
  const stmSlug = 'stm-cwl-christmas-market'
  const { error: stmErr } = await supabase
    .from('organizers')
    .update({
      display_name: 'STM Catholic Women\'s League',
      primary_contact_name: 'Heather MacPherson Craig',
      admin_notes:
        'Renamed from FB event title "STM CWL Christmas Market". CWL chapter organizes parish Christmas market — contact name from original vendor call.',
      updated_at: new Date().toISOString(),
    })
    .eq('slug', stmSlug)

  if (stmErr) throw new Error(`STM rename: ${stmErr.message}`)
  console.log('Renamed stm-cwl-christmas-market → STM Catholic Women\'s League')

  const { data: lauderdale, error: lauderdaleErr } = await supabase
    .from('organizers')
    .upsert(
      {
        slug: LAUDERDALE.slug,
        display_name: LAUDERDALE.display_name,
        city: LAUDERDALE.city,
        province: 'AB',
        region: 'edmonton-metro',
        website_url: LAUDERDALE.website_url,
        typical_season_or_dates: LAUDERDALE.typical_season_or_dates,
        listing_status: 'published',
        source: 'seed',
        admin_notes: LAUDERDALE.admin_notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )
    .select('id, slug')
    .single()

  if (lauderdaleErr || !lauderdale) {
    throw new Error(`Lauderdale upsert failed: ${lauderdaleErr?.message}`)
  }
  console.log(`Published Lauderdale at /organizers/${lauderdale.slug}`)

  const { data: existingEvents } = await supabase
    .from('organizer_events')
    .select('id')
    .eq('organizer_id', lauderdale.id)
    .limit(1)

  if (!existingEvents?.length) {
    const { error: evErr } = await supabase.from('organizer_events').insert({
      organizer_id: lauderdale.id,
      name: 'Lauderdale Community events',
      city: 'Edmonton',
      typical_dates: LAUDERDALE.typical_season_or_dates,
      source_snippet: 'Community league programs, hall rentals, and seasonal neighbourhood events.',
      listing_status: 'published',
    })
    if (evErr) throw new Error(`Lauderdale event: ${evErr.message}`)
    console.log('Inserted Lauderdale event row')
  }

  console.log('\nVet complete. Run: npx tsx scripts/list-organizers.ts')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
