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
const id = process.argv[2] ?? '4e87e086-da8e-4e46-af11-b1e7322f4e65'
const VENDOR_EVENT_SELECT = `
  *,
  coordinator:profiles!events_coordinator_id_fkey(id, full_name, email, avatar_url, reliability_score, recent_late_cancellation_at),
  category_limits:event_category_limits(
    *,
    category:categories(id, name)
  ),
  event_days(*)
`
const VENDOR_MARKET_STATUSES = ['published', 'active', 'completed']

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const email = env.DEV_MOCK_VENDOR_EMAIL ?? 'vendor@me.com'
const password = env.DEV_MOCK_VENDOR_PASSWORD ?? 'testing'

const { error: authError } = await anon.auth.signInWithPassword({ email, password })
if (authError) {
  console.error('auth failed', authError.message)
  process.exit(1)
}

const { data: event, error: eventError } = await anon
  .from('events')
  .select(VENDOR_EVENT_SELECT)
  .eq('id', id)
  .in('status', VENDOR_MARKET_STATUSES)
  .single()

console.log('event', {
  error: eventError?.message,
  code: eventError?.code,
  name: event?.name,
  status: event?.status,
})

const { data: existingApp, error: appError } = await anon
  .from('booth_applications')
  .select('id, status, payment_status, payment_method, application_payment_status, category_id')
  .eq('event_id', id)
  .eq('vendor_id', auth.user.id)
  .maybeSingle()

console.log('application', { error: appError?.message, code: appError?.code, app: existingApp })

const { count, error: countError } = await anon
  .from('auction_catalog_items')
  .select('id', { count: 'exact', head: true })
  .eq('event_id', id)
  .not('status', 'eq', 'cancelled')

console.log('catalog count', { count, error: countError?.message })

const { data: existingSettings } = await service
  .from('quarter_auction_settings')
  .select('*')
  .eq('event_id', id)
  .maybeSingle()

console.log('qa settings existing', { hasSettings: !!existingSettings })

const { data: created, error: insertError } = await service
  .from('quarter_auction_settings')
  .insert({ event_id: id })
  .select('*')
  .single()

console.log('qa settings insert attempt', {
  error: insertError?.message,
  code: insertError?.code,
  created: !!created,
})

await anon.auth.signOut()
