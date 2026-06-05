import type { MetadataRoute } from 'next'
import { EXPERIENCE_THEME_CATALOG, experienceDesignerPath } from '@/lib/seo/experience-theme-metadata'
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import { publicAppUrl } from '@/lib/url/public-app-url'

type SitemapEntry = MetadataRoute.Sitemap[number]

const STATIC_PUBLIC_PATHS: Array<{ path: string; changeFrequency: SitemapEntry['changeFrequency']; priority: number }> =
  [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/discover', changeFrequency: 'hourly', priority: 0.9 },
    { path: '/legal/terms', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/legal/privacy', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/legal/faq', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/legal/accessibility', changeFrequency: 'monthly', priority: 0.3 },
  ]

function entry(
  path: string,
  opts: { lastModified?: Date; changeFrequency?: SitemapEntry['changeFrequency']; priority?: number } = {},
): SitemapEntry {
  return {
    url: publicAppUrl(path),
    lastModified: opts.lastModified ?? new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
  }
}

/**
 * Collects all indexable public URLs for sitemap.xml generation.
 * Used by `app/sitemap.ts` and `scripts/generate-sitemap.mjs`.
 */
export async function collectSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = STATIC_PUBLIC_PATHS.map(({ path, changeFrequency, priority }) =>
    entry(path, { changeFrequency, priority }),
  )

  for (const theme of EXPERIENCE_THEME_CATALOG) {
    entries.push(
      entry(experienceDesignerPath(theme.theme), {
        changeFrequency: 'weekly',
        priority: 0.6,
      }),
    )
  }

  const supabase = createPublicSupabaseClient()

  const { data: events } = await supabase
    .from('events')
    .select('id, updated_at, start_at')
    .in('status', ['published', 'active', 'completed'])
    .order('start_at', { ascending: false })
    .limit(500)

  for (const event of events ?? []) {
    const lastModified = event.updated_at ? new Date(event.updated_at) : undefined
    entries.push(
      entry(`/events/${event.id}`, {
        lastModified,
        changeFrequency: 'daily',
        priority: 0.8,
      }),
    )
  }

  const { data: coordinators } = await supabase
    .from('profiles')
    .select('id, created_at')
    .eq('role', 'coordinator')
    .limit(200)

  for (const profile of coordinators ?? []) {
    entries.push(
      entry(`/coordinators/${profile.id}`, {
        lastModified: profile.created_at ? new Date(profile.created_at) : undefined,
        changeFrequency: 'weekly',
        priority: 0.5,
      }),
    )
  }

  const { data: patrons } = await supabase
    .from('profiles')
    .select('id, created_at')
    .eq('role', 'shopper')
    .limit(200)

  for (const profile of patrons ?? []) {
    entries.push(
      entry(`/patrons/${profile.id}`, {
        lastModified: profile.created_at ? new Date(profile.created_at) : undefined,
        changeFrequency: 'weekly',
        priority: 0.4,
      }),
    )
  }

  return entries
}
