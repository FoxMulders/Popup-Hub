/**
 * One-off: run the vendor markets Supabase query as vendor@me.com and print results.
 * Usage: node scripts/debug-vendor-events-query.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = env.DEV_MOCK_VENDOR_EMAIL ?? 'vendor@me.com'
const password = env.DEV_MOCK_VENDOR_PASSWORD ?? 'testing'

const VENDOR_MARKET_STATUSES = ['published', 'active', 'completed']
const VENDOR_EVENT_SELECT = `
  *,
  coordinator:profiles!events_coordinator_id_fkey(id, full_name),
  category_limits:event_category_limits(
    *,
    category:categories(id, name)
  )
`

const supabase = createClient(url, anon)

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
})

if (authError) {
  console.error('[debug-vendor-events] auth failed:', authError.message)
  process.exit(1)
}

const userId = auth.user.id
const now = new Date()

console.log('[debug-vendor-events] PRE-QUERY', {
  userId,
  email,
  nowIso: now.toISOString(),
  statusFilter: VENDOR_MARKET_STATUSES,
  pseudoSql: `SELECT ${VENDOR_EVENT_SELECT.trim().replace(/\s+/g, ' ')}
FROM events
WHERE status IN (${VENDOR_MARKET_STATUSES.map((s) => `'${s}'`).join(', ')})
ORDER BY start_at ASC;`,
})

const { data: events, error: eventsError, count } = await supabase
  .from('events')
  .select(VENDOR_EVENT_SELECT, { count: 'exact' })
  .in('status', VENDOR_MARKET_STATUSES)
  .order('start_at', { ascending: true })

console.log('[debug-vendor-events] POST-QUERY events', {
  error: eventsError?.message ?? null,
  code: eventsError?.code ?? null,
  details: eventsError?.details ?? null,
  hint: eventsError?.hint ?? null,
  count,
  rowCount: events?.length ?? 0,
  rows: (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    start_at: e.start_at,
    end_at: e.end_at,
    categoryLimitCount: e.category_limits?.length ?? 0,
  })),
})

const { data: passport, error: passportError } = await supabase
  .from('vendor_passports')
  .select('id, primary_category_id, is_verified')
  .eq('user_id', userId)
  .maybeSingle()

console.log('[debug-vendor-events] passport', {
  error: passportError?.message ?? null,
  passport,
})

await supabase.auth.signOut()
