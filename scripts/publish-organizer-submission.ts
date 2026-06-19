/**
 * Publish vendor-submitted organizer nominations and their pending reviews.
 *
 * Usage:
 *   npx tsx scripts/publish-organizer-submission.ts --slug hope-holly-markets
 *   npx tsx scripts/publish-organizer-submission.ts --all-vendor-submitted
 *   npx tsx scripts/publish-organizer-submission.ts --slug hope-holly-markets --notes "Verified FB group"
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

function parseArgs() {
  const slugIdx = process.argv.indexOf('--slug')
  const slug = slugIdx >= 0 ? process.argv[slugIdx + 1] : undefined
  const allVendor = process.argv.includes('--all-vendor-submitted')
  const notesIdx = process.argv.indexOf('--notes')
  const notes = notesIdx >= 0 ? process.argv[notesIdx + 1] : undefined

  if (!slug && !allVendor) {
    throw new Error('Pass --slug <slug> or --all-vendor-submitted')
  }

  return { slug, allVendor, notes }
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env in .env.local')

  const { slug, notes } = parseArgs()
  const supabase = createClient(url, key)

  let query = supabase
    .from('organizers')
    .select('id, slug')
    .eq('listing_status', 'draft')
    .eq('source', 'vendor_submitted')

  if (slug) {
    query = query.eq('slug', slug)
  }

  const { data, error } = await query
  if (error) throw error

  if (!data?.length) {
    console.log('No matching draft vendor submissions found.')
    return
  }

  const now = new Date().toISOString()

  for (const org of data) {
    const updatePayload: {
      listing_status: string
      updated_at: string
      admin_notes?: string
    } = {
      listing_status: 'published',
      updated_at: now,
    }
    if (notes) updatePayload.admin_notes = notes

    const { error: orgError } = await supabase
      .from('organizers')
      .update(updatePayload)
      .eq('id', org.id)

    if (orgError) throw new Error(`Publish ${org.slug}: ${orgError.message}`)

    const { data: reviews, error: reviewError } = await supabase
      .from('organizer_reviews')
      .update({ published: true, updated_at: now })
      .eq('organizer_id', org.id)
      .eq('published', false)
      .select('id')

    if (reviewError) throw new Error(`Reviews ${org.slug}: ${reviewError.message}`)

    console.log(`Published ${org.slug} + ${reviews?.length ?? 0} review(s)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
