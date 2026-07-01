/**
 * Smoke checks for Conversion Engine MVP (local logic + optional live API/DB).
 *
 * Usage:
 *   npx tsx scripts/verify-conversion-engine.ts
 *   CONVERSION_ENGINE_EVENT_ID=<uuid> npx tsx scripts/verify-conversion-engine.ts --live
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { FEATURE_LOCKED_EXTERNAL_TIER } from '../lib/markets/enforce-native-market-permissions'
import { getDailyAdClickSalt, hashClientIpForAdClick } from '../lib/markets/ad-click-tracking'
import { isPublicPath } from '../lib/auth/public-paths'

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
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // optional
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function verifyLocal() {
  assert(FEATURE_LOCKED_EXTERNAL_TIER.code === 'FEATURE_LOCKED_EXTERNAL_TIER', 'lock code')
  assert(FEATURE_LOCKED_EXTERNAL_TIER.error === 'Operation Locked', 'lock error label')

  const hash = hashClientIpForAdClick('203.0.113.10')
  assert(hash.length === 64, 'ip hash length')
  assert(hash === hashClientIpForAdClick('203.0.113.10'), 'ip hash stable per day')
  assert(getDailyAdClickSalt().length === 64, 'daily salt length')

  assert(
    isPublicPath('/api/v1/markets/abc/track-click'),
    'track-click path is public in middleware allowlist'
  )
  assert(!isPublicPath('/api/v1/markets/abc/upgrade-to-native'), 'upgrade path is not public')

  const sample = createHash('sha256').update('sample').digest('hex')
  assert(sample.length === 64, 'sha256 helper sanity')

  console.log('✓ Local conversion engine checks passed')
}

async function verifyDatabase(eventId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.log('⊘ Skipping DB checks (missing Supabase env)')
    return
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: event, error } = await supabase
    .from('events')
    .select('id, is_external_listing, destination_url, ad_campaign_status')
    .eq('id', eventId)
    .maybeSingle()

  if (error?.message.includes('is_external_listing')) {
    throw new Error('Migration 136 not applied — run npm run db:push')
  }
  if (error) throw new Error(error.message)
  if (!event) throw new Error(`Event not found: ${eventId}`)

  assert(event.is_external_listing === true, 'event.is_external_listing should be true for QA')
  assert(Boolean(event.destination_url?.trim()), 'event.destination_url should be set')

  const { error: clickTableError } = await supabase
    .from('ad_clicks_log')
    .select('id')
    .limit(1)

  if (clickTableError) {
    throw new Error(`ad_clicks_log unavailable: ${clickTableError.message}`)
  }

  console.log(`✓ Database checks passed for event ${eventId}`)
}

async function verifyLiveApi(baseUrl: string, eventId: string) {
  const trackUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/markets/${eventId}/track-click`
  const response = await fetch(trackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'manual',
    body: JSON.stringify({}),
  })

  if (response.status === 401) {
    throw new Error(
      `track-click returned 401 — production may not include migration 136 deploy yet (${trackUrl})`
    )
  }

  assert(
    response.status === 302 || response.status === 400 || response.status === 404,
    `track-click status ${response.status}`
  )

  const gateUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/markets/${eventId}/applications`
  const gateResponse = await fetch(gateUrl, { method: 'POST', redirect: 'manual' })
  if (gateResponse.status === 401) {
    console.log('⊘ Skipping gated-route body check (auth required on this host)')
    return
  }

  if (gateResponse.status === 403) {
    const body = (await gateResponse.json()) as { code?: string }
    assert(body.code === 'FEATURE_LOCKED_EXTERNAL_TIER', 'gated route lock code')
  }

  console.log(`✓ Live API checks passed against ${baseUrl}`)
}

async function main() {
  loadEnvLocal()
  const live = process.argv.includes('--live')
  const eventId = process.env.CONVERSION_ENGINE_EVENT_ID?.trim()

  await verifyLocal()

  if (eventId) {
    await verifyDatabase(eventId)
  } else {
    console.log('⊘ Skipping DB checks (set CONVERSION_ENGINE_EVENT_ID)')
  }

  if (live) {
    const baseUrl = process.env.CONVERSION_ENGINE_BASE_URL?.trim() || 'https://popuphub.ca'
    if (!eventId) {
      throw new Error('CONVERSION_ENGINE_EVENT_ID required for --live checks')
    }
    await verifyLiveApi(baseUrl, eventId)
  }

  console.log('All requested conversion engine verification steps completed.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
