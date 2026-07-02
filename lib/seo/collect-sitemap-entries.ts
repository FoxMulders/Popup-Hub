import type { MetadataRoute } from 'next'
import { createPublicSupabaseClient, hasPublicSupabaseConfig } from '@/lib/supabase/public'
import {
  INDEXABLE_MARKET_CITY_SLUGS,
  listMarketCitySeoPages,
} from '@/lib/seo/market-city-pages'
import {
  MARKET_CITY_INTENT_SLUGS,
  buildMarketCityIntentPath,
} from '@/lib/seo/market-city-intents'
import { SEO_GUIDE_SLUGS } from '@/lib/seo/guides/guide-registry'
import { publicAppUrl, getURL } from '@/lib/url/public-app-url'

type SitemapEntry = MetadataRoute.Sitemap[number]

const STATIC_PUBLIC_PATHS: Array<{
  path: string
  changeFrequency: SitemapEntry['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/for-organizers', changeFrequency: 'weekly', priority: 0.95 },
  { path: '/compare', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/for-vendors', changeFrequency: 'weekly', priority: 0.95 },
  { path: '/for-organizers/embed', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/discover', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/check', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/check/review', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/supplies', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/legal/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/legal/guides', changeFrequency: 'weekly', priority: 0.8 },
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

function resolveOrigin(origin?: string): string {
  return origin?.trim() || getURL()
}

function makeEntry(
  origin: string | undefined,
  path: string,
  opts: { lastModified?: Date; changeFrequency?: SitemapEntry['changeFrequency']; priority?: number } = {},
): SitemapEntry {
  return {
    url: publicAppUrl(path, resolveOrigin(origin)),
    lastModified: opts.lastModified ?? new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
  }
}

function appendCityAndIntentEntries(origin: string | undefined, entries: SitemapEntry[]) {
  for (const city of listMarketCitySeoPages()) {
    entries.push(
      makeEntry(origin, `/markets/${city.slug}`, {
        changeFrequency: 'daily',
        priority: 0.85,
      }),
    )

    for (const intent of MARKET_CITY_INTENT_SLUGS) {
      entries.push(
        makeEntry(origin, buildMarketCityIntentPath(city.slug, intent), {
          changeFrequency: 'daily',
          priority: 0.8,
        }),
      )
    }
  }
}

function appendGuideEntries(origin: string | undefined, entries: SitemapEntry[]) {
  for (const slug of SEO_GUIDE_SLUGS) {
    entries.push(
      makeEntry(origin, `/legal/guides/${slug}`, {
        changeFrequency: 'monthly',
        priority: 0.75,
      }),
    )
  }
}

async function appendDynamicEntries(origin: string | undefined, entries: SitemapEntry[]) {
  if (!hasPublicSupabaseConfig()) return

  try {
    const supabase = createPublicSupabaseClient()

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, updated_at, start_at, status, coordinator_id')
      .in('status', ['published', 'active', 'completed'])
      .eq('is_test', false)
      .order('start_at', { ascending: false })
      .limit(500)

    if (eventsError) {
      console.error('[sitemap] events query failed:', eventsError.message)
    }

    for (const event of events ?? []) {
      entries.push(
        makeEntry(origin, `/events/${event.id}`, {
          lastModified: safeDate(event.updated_at),
          changeFrequency: event.status === 'completed' ? 'monthly' : 'daily',
          priority:
            event.status === 'active' ? 0.85 : event.status === 'completed' ? 0.6 : 0.75,
        }),
      )
    }

    const coordinatorIds = [
      ...new Set(
        (events ?? [])
          .map((event) => event.coordinator_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    for (const coordinatorId of coordinatorIds) {
      entries.push(
        makeEntry(origin, `/coordinators/${coordinatorId}`, {
          changeFrequency: 'weekly',
          priority: 0.65,
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

    const eventIds = (events ?? []).map((event) => event.id)
    if (eventIds.length > 0) {
      const { data: vendorApps, error: vendorAppsError } = await supabase
        .from('booth_applications')
        .select('event_id, vendor_id, updated_at')
        .in('event_id', eventIds)
        .eq('status', 'approved')
        .limit(2000)

      if (vendorAppsError) {
        console.error('[sitemap] vendor profiles query failed:', vendorAppsError.message)
      } else {
        const seen = new Set<string>()
        for (const row of vendorApps ?? []) {
          const key = `${row.event_id}:${row.vendor_id}`
          if (seen.has(key)) continue
          seen.add(key)
          entries.push(
            makeEntry(origin, `/events/${row.event_id}/vendors/${row.vendor_id}`, {
              lastModified: safeDate(row.updated_at),
              changeFrequency: 'weekly',
              priority: 0.55,
            }),
          )
        }
      }
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
  const entries: SitemapEntry[] = STATIC_PUBLIC_PATHS.map(
    ({ path, changeFrequency, priority }) => makeEntry(origin, path, { changeFrequency, priority }),
  )

  appendCityAndIntentEntries(origin, entries)
  appendGuideEntries(origin, entries)
  await appendDynamicEntries(origin, entries)

  return entries
}

export { INDEXABLE_MARKET_CITY_SLUGS }
