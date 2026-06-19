/**
 * Patch Morinville Swing into Spring thread (permalink + $150 vs $580 clarification).
 * Usage: npx tsx scripts/patch-morinville-thread.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PERMALINK = 'https://www.facebook.com/groups/148936038475481/posts/25792587627016970/'
const ORGANIZER_SLUG = 'morinville-district-chamber'

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
    .select('id')
    .eq('slug', ORGANIZER_SLUG)
    .single()

  if (orgErr || !org) throw new Error(`Organizer not found: ${ORGANIZER_SLUG}`)

  await supabase
    .from('organizers')
    .update({
      admin_notes:
        'permalink_verified thread. Market stalls $150 CAD; tradeshow booths $580 CAD (not the same product).',
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id)

  await supabase
    .from('organizer_events')
    .update({
      booth_fee_cad: 150,
      source_snippet: 'Chamber clarified in vendor group: market stalls $150; tradeshow booths $580.',
    })
    .eq('organizer_id', org.id)
    .ilike('name', '%Swing into Spring%')

  const { data: existing } = await supabase
    .from('organizer_community_mentions')
    .select('id, quote')
    .eq('organizer_id', org.id)

  const vendorQuote = '$580 for a market in Morinville? Are you insane?'
  const vendorRow = existing?.find((r) => r.quote.includes('$580 for a market'))

  if (vendorRow) {
    await supabase
      .from('organizer_community_mentions')
      .update({
        source_permalink: PERMALINK,
        verification_status: 'permalink_verified',
        published: true,
        source_snippet: 'Vendor confused tradeshow booth pricing with market stall pricing.',
      })
      .eq('id', vendorRow.id)
    console.log('Updated vendor fee mention')
  } else {
    await supabase.from('organizer_community_mentions').insert({
      organizer_id: org.id,
      quote: vendorQuote,
      sentiment: 'negative',
      mention_type: 'vendor_question',
      source_snippet: 'Vendor confused tradeshow booth pricing with market stall pricing.',
      source_permalink: PERMALINK,
      verification_status: 'permalink_verified',
      published: true,
    })
    console.log('Inserted vendor fee mention')
  }

  const chamberQuote =
    "You're looking at the tradeshow booths. Market stalls are $150 and are very reasonably priced."
  const chamberExists = existing?.some((r) => r.quote.includes('tradeshow booths'))

  if (!chamberExists) {
    await supabase.from('organizer_community_mentions').insert({
      organizer_id: org.id,
      coordinator_person_name: 'Morinville District Chamber',
      quote: chamberQuote,
      sentiment: 'neutral',
      mention_type: 'organizer_clarification',
      source_snippet: 'Official chamber reply on vendor group thread.',
      source_permalink: PERMALINK,
      verification_status: 'permalink_verified',
      published: true,
    })
    console.log('Inserted chamber clarification mention')
  }

  console.log('Morinville patch complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
