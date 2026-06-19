/**
 * List organizers in trust directory (admin helper).
 * Usage:
 *   npx tsx scripts/list-organizers.ts
 *   npx tsx scripts/list-organizers.ts --pending
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

  const pendingOnly = process.argv.includes('--pending')
  const supabase = createClient(url, key)

  let query = supabase
    .from('organizers')
    .select('id, slug, display_name, city, listing_status, source, admin_notes, submitted_at')
    .eq('region', 'edmonton-metro')
    .order('display_name')

  if (pendingOnly) {
    query = query.eq('listing_status', 'draft').eq('source', 'vendor_submitted')
  }

  const { data, error } = await query
  if (error) throw error

  const organizerIds = (data ?? []).map((o) => o.id)
  const pendingReviewCounts = new Map<string, number>()

  if (organizerIds.length > 0) {
    const { data: reviews } = await supabase
      .from('organizer_reviews')
      .select('organizer_id')
      .in('organizer_id', organizerIds)
      .eq('published', false)

    for (const row of reviews ?? []) {
      pendingReviewCounts.set(
        row.organizer_id,
        (pendingReviewCounts.get(row.organizer_id) ?? 0) + 1
      )
    }
  }

  if (pendingOnly) {
    console.log('Pending vendor-submitted organizers:\n')
    if ((data ?? []).length === 0) {
      console.log('(none)')
      return
    }
  }

  for (const o of data ?? []) {
    const pendingReviews = pendingReviewCounts.get(o.id) ?? 0
    const suffix = pendingOnly
      ? ` | pending reviews: ${pendingReviews}${o.submitted_at ? ` | submitted ${o.submitted_at.slice(0, 10)}` : ''}`
      : pendingReviews > 0
        ? ` | ${pendingReviews} unpublished review(s)`
        : ''
    console.log(
      `${o.listing_status.padEnd(10)} ${o.source?.padEnd(16) ?? ''} ${o.slug} | ${o.display_name} | ${o.city}${suffix}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
