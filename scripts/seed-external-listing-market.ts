/**
 * Flag a coordinator test market as an external listing for Conversion Engine QA.
 *
 * Usage:
 *   npx tsx scripts/seed-external-listing-market.ts
 *   npx tsx scripts/seed-external-listing-market.ts --event-id <uuid>
 *   npx tsx scripts/seed-external-listing-market.ts --dry-run
 *
 * Requires in .env.local (or exported env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_DESTINATION_URL = 'https://popuphub.ca/for-organizers'
const DEFAULT_EVENT_NAME = process.env.CONVERSION_ENGINE_EVENT_NAME ?? 'Market Test 3'

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
      let value = trimmed.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch {
    // optional when vars exported
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local or export it.`)
  }
  return value
}

function parseArgs() {
  const args = process.argv.slice(2)
  let eventId: string | null = null
  let dryRun = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--dry-run') dryRun = true
    if (arg === '--event-id') eventId = args[++i]?.trim() ?? null
  }
  return { eventId, dryRun }
}

async function main() {
  loadEnvLocal()
  const { eventId: eventIdArg, dryRun } = parseArgs()

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const destinationUrl = process.env.CONVERSION_ENGINE_DESTINATION_URL?.trim() || DEFAULT_DESTINATION_URL

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let eventId = eventIdArg
  let eventName = ''

  if (!eventId) {
    const { data: named, error: namedError } = await supabase
      .from('events')
      .select('id, name, coordinator_id, is_external_listing')
      .ilike('name', `%${DEFAULT_EVENT_NAME}%`)
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (namedError) {
      throw new Error(`Could not query events: ${namedError.message}`)
    }

    if (!named) {
      throw new Error(
        `No event matching name "${DEFAULT_EVENT_NAME}" found. Pass --event-id or create the test market first.`
      )
    }

    eventId = named.id
    eventName = named.name
  } else {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!event) throw new Error(`Event not found: ${eventId}`)
    eventName = event.name
  }

  const payload = {
    is_external_listing: true,
    destination_url: destinationUrl,
    ad_campaign_status: 'active' as const,
    ad_campaign_expires_at: null,
    updated_at: new Date().toISOString(),
  }

  console.log(`${dryRun ? 'Dry run — would update' : 'Updating'} external listing:`)
  console.log(`  event: ${eventName} (${eventId})`)
  console.log(`  destination_url: ${destinationUrl}`)
  console.log(`  studio: /coordinator/studio?event=${eventId}`)

  if (dryRun) return

  const { error: updateError } = await supabase.from('events').update(payload).eq('id', eventId)

  if (updateError) {
    if (updateError.message.includes('is_external_listing')) {
      throw new Error(
        `Column is_external_listing missing — run npm run db:push first.\n${updateError.message}`
      )
    }
    throw new Error(updateError.message)
  }

  console.log(`EVENT_ID=${eventId}`)
  console.log('Done. Open HubGrid studio for the blurred conversion teaser.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
