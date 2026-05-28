/**
 * One-off helper: flip `skip_venue_layout` on a known event so the
 * setup wizard's step 4 (Floor Plan canvas) becomes reachable for
 * visual verification.
 *
 * Usage: npx tsx scripts/unblock-layout-step.ts <event-id>
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const eventId = process.argv[2]
if (!eventId) {
  console.error('Usage: npx tsx scripts/unblock-layout-step.ts <event-id>')
  process.exit(1)
}

async function main() {
  const supabase = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('events')
    .update({ skip_venue_layout: false })
    .eq('id', eventId)
    .select('id, name, skip_venue_layout')
    .single()

  if (error) {
    console.error('Update failed:', error)
    process.exit(1)
  }
  console.log('Updated:', data)
}

main()
