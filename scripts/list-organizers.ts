/**
 * List organizers in trust directory (admin helper).
 * Usage: npx tsx scripts/list-organizers.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
  const { data, error } = await supabase
    .from('organizers')
    .select('slug, display_name, city, listing_status, admin_notes')
    .eq('region', 'edmonton-metro')
    .order('display_name')

  if (error) throw error

  for (const o of data ?? []) {
    console.log(
      `${o.listing_status.padEnd(10)} ${o.slug} | ${o.display_name} | ${o.city}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
