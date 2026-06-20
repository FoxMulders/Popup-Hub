import type { MetadataRoute } from 'next'
import { createPublicSupabaseClient, hasPublicSupabaseConfig } from '@/lib/supabase/public'
import { publicAppUrl } from '@/lib/url/public-app-url'

type SitemapEntry = MetadataRoute.Sitemap[number]

const STATIC_PUBLIC_PATHS: Array<{ path: string; changeFrequency: SitemapEntry['changeFrequency']; priority: number }> =
  [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/for-organizers', changeFrequency: 'weekly', priority: 0.95 },
    { path: '/for-vendors', changeFrequency: 'weekly', priority: 0.95 },
    { path: '/discover', changeFrequency: 'hourly', priority: 0.9 },
    { path: '/markets/edmonton', changeFrequency: 'daily', priority: 0.85 },
    { path: '/markets/calgary', changeFrequency: 'daily', priority: 0.85 },
    { path: '/check', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/check/review', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/supplies', changeFrequency: 'weekly', priority: 0.6 },
    { path: '/legal/about', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/legal/terms', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/legal/privacy', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/legal/faq', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/legal/accessibility', changeFrequency: 'monthly', priority: 0.3 },
  ]

function safeDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function makeEntry(
  origin: string | undefined,
  path: string,
  opts: { lastModified?: Date; changeFrequency?: SitemapEntry['changeFrequency']; priority?: number } = {},
): SitemapEntry {
  return {
    url: publicAppUrl(path, origin),
    lastModified: opts.lastModified ?? new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
  }
}

async function appendDynamicEntries(origin: string | undefined, entries: SitemapEntry[]) {
  if (!hasPublicSupabaseConfig()) return

  try {
    const supabase = createPublicSupabaseClient()

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, updated_at, start_at, status')
      .in('status', ['published', 'active'])
      .order('start_at', { ascending: false })
      .limit(500)

    if (eventsError) {
      console.error('[sitemap] events query failed:', eventsError.message)
    }

    for (const event of events ?? []) {
      entries.push(
        makeEntry(origin, `/events/${event.id}`, {
          lastModified: safeDate(event.updated_at),
          changeFrequency: 'daily',
          priority: event.status === 'active' ? 0.85 : 0.75,
        }),
      )
    }

    const { data: organizers, error: organizersError } = await supabase
      .from('organizers')
      .select('slug, updated_at')
      .eq('listing_status', 'published')
      .limit(500)

    if (organizersError) {
      console.error('[sitemap] organizers query failed:', organizersError.message)
    }

    for (const organizer of organizers ?? []) {
      entries.push(
        makeEntry(origin, `/organizers/${organizer.slug}`, {
          lastModified: safeDate(organizer.updated_at),
          changeFrequency: 'weekly',
          priority: 0.75,
        }),
      )
    }
  } catch (error) {
    console.error('[sitemap] dynamic entry collection failed:', error)
  }
}

/**
 * Collects all indexable public URLs for sitemap.xml generation.
 * Always returns static marketing URLs even when Supabase reads fail.
 */
export async function collectSitemapEntries(origin?: string): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = STATIC_PUBLIC_PATHS.map(({ path, changeFrequency, priority }) =>
    makeEntry(origin, path, { changeFrequency, priority }),
  )

  await appendDynamicEntries(origin, entries)

  return entries
}
