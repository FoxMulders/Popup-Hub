/**
 * Upload generated cover images for the scenario test markets (is_test = true)
 * and set events.cover_image_url. Idempotent — safe to re-run.
 *
 * Images are read from public/scenario-markets/scenario-<id>.jpg and uploaded
 * to the `event-covers` storage bucket at `${coordinatorId}/${eventId}/cover.jpg`,
 * matching the coordinator wizard convention.
 *
 * Usage:
 *   npx tsx scripts/apply-scenario-market-covers.ts
 *   npx tsx scripts/apply-scenario-market-covers.ts --dry-run
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { SCENARIO_MARKET_DEFINITIONS } from '@/lib/qa/scenario-market-definitions'

const COVERS_BUCKET = 'event-covers'
const IMAGE_DIR = join(process.cwd(), 'public', 'scenario-markets')

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

async function main() {
  loadEnvLocal()

  const dryRun = process.argv.includes('--dry-run')
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: events, error: listError } = await supabase
    .from('events')
    .select('id, name, coordinator_id, cover_image_url')
    .eq('is_test', true)

  if (listError) throw new Error(listError.message)

  const byName = new Map((events ?? []).map((e) => [e.name, e]))

  let applied = 0
  let skipped = 0

  for (const scenario of SCENARIO_MARKET_DEFINITIONS) {
    const file = join(IMAGE_DIR, `scenario-${scenario.id}.jpg`)
    const event = byName.get(scenario.name)

    if (!event) {
      console.log(`  ⚠ skip   ${scenario.name} — no is_test event found (seed it first)`)
      skipped += 1
      continue
    }
    if (!existsSync(file)) {
      console.log(`  ⚠ skip   ${scenario.name} — missing image ${file}`)
      skipped += 1
      continue
    }

    const path = `${event.coordinator_id}/${event.id}/cover.jpg`

    if (dryRun) {
      console.log(`  → would  ${scenario.name} -> ${COVERS_BUCKET}/${path}`)
      applied += 1
      continue
    }

    const bytes = readFileSync(file)
    const { error: uploadError } = await supabase.storage
      .from(COVERS_BUCKET)
      .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) throw new Error(`upload ${scenario.name}: ${uploadError.message}`)

    const { data: pub } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path)
    const coverUrl = `${pub.publicUrl}?v=${Date.now()}`

    const { error: updateError } = await supabase
      .from('events')
      .update({ cover_image_url: coverUrl })
      .eq('id', event.id)
    if (updateError) throw new Error(`update ${scenario.name}: ${updateError.message}`)

    console.log(`  ✓ applied ${scenario.name}`)
    applied += 1
  }

  console.log('')
  console.log(
    dryRun
      ? `Dry run — would apply ${applied}, skip ${skipped}`
      : `Done — applied ${applied}, skipped ${skipped}`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
