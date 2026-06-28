/**
 * Delete all is_test markets (CASCADE removes related rows).
 *
 * Usage:
 *   npm run purge:test-markets
 *   npm run purge:test-markets -- --dry-run
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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

  const { data: testMarkets, error: listError } = await supabase
    .from('events')
    .select('id, name, status')
    .eq('is_test', true)
    .order('name')

  if (listError) {
    throw new Error(listError.message)
  }

  const markets = testMarkets ?? []

  if (markets.length === 0) {
    console.log('No is_test markets found.')
    return
  }

  console.log(`${dryRun ? 'Would delete' : 'Deleting'} ${markets.length} test market(s):`)
  for (const market of markets) {
    console.log(`  • ${market.name} (${market.status})`)
  }

  if (dryRun) {
    console.log('\nDry run — no rows deleted.')
    return
  }

  const { error: deleteError } = await supabase.from('events').delete().eq('is_test', true)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  console.log(`\nDeleted ${markets.length} test market(s).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
