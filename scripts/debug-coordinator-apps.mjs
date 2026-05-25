import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()

const supabase = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))

const SIMPLE = `*, vendor:profiles(id,full_name,email), passport:vendor_passports(business_name), category:categories(name)`
const FULL = `
  *,
  vendor:profiles!booth_applications_vendor_id_fkey(
    id,
    full_name,
    email,
    phone,
    avatar_url,
    reliability_score,
    no_show_count,
    left_early_count,
    late_arrival_count,
    poor_cleanup_strike_count,
    total_markets,
    passport:vendor_passports(
      business_name,
      bio,
      logo_url,
      item_image_urls,
      is_verified,
      tax_id_encrypted,
      primary_category_id,
      category_ids,
      website_url,
      shop_url,
      instagram_url
    )
  ),
  category:categories(name)
`

const { data: events } = await supabase.from('events').select('id,name,coordinator_id').order('start_at', { ascending: false }).limit(10)

for (const e of events ?? []) {
  const simple = await supabase.from('booth_applications').select(SIMPLE).eq('event_id', e.id)
  const full = await supabase.from('booth_applications').select(FULL).eq('event_id', e.id)
  console.log(JSON.stringify({
    event: e.name,
    id: e.id,
    simpleCount: simple.data?.length ?? 0,
    simpleErr: simple.error?.message ?? null,
    fullCount: full.data?.length ?? 0,
    fullErr: full.error?.message ?? null,
  }))
}
