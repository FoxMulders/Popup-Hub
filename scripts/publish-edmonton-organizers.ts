/**
 * Publish Edmonton organizer listings and verified trust content.
 * Usage:
 *   npm run seed:edmonton:publish
 *   npm run seed:edmonton:publish -- --include-verified-alerts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
    // optional
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local`)
  return value
}

async function main() {
  loadEnvLocal()
  const includeVerified = process.argv.includes('--include-verified-alerts')
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  )

  const { data: orgs, error: orgErr } = await supabase
    .from('organizers')
    .update({ listing_status: 'published', updated_at: new Date().toISOString() })
    .eq('region', 'edmonton-metro')
    .eq('listing_status', 'draft')
    .select('slug')

  if (orgErr) {
    console.error(orgErr.message)
    process.exit(1)
  }

  console.log(`Published ${orgs?.length ?? 0} organizers`)

  const { error: evErr } = await supabase
    .from('organizer_events')
    .update({ listing_status: 'published' })
    .eq('listing_status', 'draft')

  if (evErr) console.error('events', evErr.message)
  else console.log('Published draft events')

  if (includeVerified) {
    const verifiedStatuses = ['permalink_verified', 'screenshot_verified', 'admin_confirmed']

    const { data: alerts, error: alertErr } = await supabase
      .from('organizer_scam_alerts')
      .update({ published: true })
      .in('verification_status', verifiedStatuses)
      .eq('published', false)
      .select('id')

    if (alertErr) console.error('alerts', alertErr.message)
    else console.log(`Published ${alerts?.length ?? 0} verified scam alerts`)

    const { data: watchlist, error: watchErr } = await supabase
      .from('scam_watchlist')
      .update({ published: true })
      .in('verification_status', verifiedStatuses)
      .eq('published', false)
      .select('slug')

    if (watchErr) console.error('watchlist', watchErr.message)
    else console.log(`Published ${watchlist?.length ?? 0} watchlist entries`)

    const { data: mentions, error: mentionErr } = await supabase
      .from('organizer_community_mentions')
      .update({ published: true })
      .in('verification_status', verifiedStatuses)
      .eq('published', false)
      .select('id')

    if (mentionErr) console.error('mentions', mentionErr.message)
    else console.log(`Published ${mentions?.length ?? 0} community mentions`)
  } else {
    console.log('Pass --include-verified-alerts to publish scam alerts, watchlist, and mentions.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
