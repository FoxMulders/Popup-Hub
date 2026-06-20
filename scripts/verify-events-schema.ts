/**
 * Verify events/booth_applications columns used by wizard autosave exist in the linked DB.
 * Run: npx tsx scripts/verify-events-schema.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type Check = { label: string; pass: boolean; detail: string }

async function main() {
  const results: Check[] = []

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const eventColumns = [
    'booth_price_cents',
    'multi_table_discount_percent',
    'community_league_discount_enabled',
    'community_league_discount_percent',
    'skip_venue_layout',
    'booth_contract_enabled',
    'booth_contract_clauses',
    'booth_contract_pdf_url',
    'booth_contract_updated_at',
    'market_city',
    'booth_clearance_policy',
    'market_insurance_required',
    'require_full_attendance',
    'listing_type',
    'allow_mlm',
    'is_multi_day',
  ] as const
  for (const column of eventColumns) {
    const { error } = await supabase.from('events').select(column).limit(1)
    results.push({
      label: `events.${column}`,
      pass: !error,
      detail: error?.message ?? 'readable',
    })
  }

  const { error: tableCountError } = await supabase
    .from('booth_applications')
    .select('table_count')
    .limit(1)
  results.push({
    label: 'booth_applications.table_count',
    pass: !tableCountError,
    detail: tableCountError?.message ?? 'readable',
  })

  let fail = 0
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.label}: ${r.detail}`)
    if (!r.pass) fail++
  }

  if (fail > 0) {
    console.log('\nRun: npm run db:push')
    console.log('Or apply pending migrations in Supabase SQL Editor (see supabase/migrations/)')
    process.exit(1)
  }

  console.log('\nAll wizard autosave schema columns are present.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
