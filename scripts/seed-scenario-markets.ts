/**
 * Seed published scenario test markets (is_test = true).
 *
 * Usage:
 *   npm run seed:scenario-markets
 *   npm run seed:scenario-markets -- --dry-run
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  resolveCoordinatorIdByEmail,
  seedScenarioMarkets,
} from '@/lib/qa/seed-scenario-markets'
import { SCENARIO_MARKET_DEFINITIONS } from '@/lib/qa/scenario-market-definitions'

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
  const coordinatorEmail = process.env.COORDINATOR_EMAIL ?? 'coordinator@me.com'

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const coordinatorId = await resolveCoordinatorIdByEmail(supabase, coordinatorEmail)

  if (dryRun) {
    console.log(`Dry run — would seed ${SCENARIO_MARKET_DEFINITIONS.length} scenario markets`)
    console.log(`Coordinator: ${coordinatorEmail} (${coordinatorId})`)
  } else {
    console.log(`Seeding ${SCENARIO_MARKET_DEFINITIONS.length} scenario markets…`)
    console.log(`Coordinator: ${coordinatorEmail}`)
  }

  const result = await seedScenarioMarkets(supabase, supabase.auth.admin, {
    coordinatorId,
    dryRun,
  })

  for (const market of result.markets) {
    console.log(`  ${dryRun ? '→' : '✓'} ${market.action.padEnd(7)} ${market.name}`)
  }

  console.log('')
  console.log(
    dryRun
      ? `Would create ${result.created}, update ${result.updated}`
      : `Done — created ${result.created}, updated ${result.updated}`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
