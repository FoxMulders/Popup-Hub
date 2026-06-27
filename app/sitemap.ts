import type { MetadataRoute } from 'next'
import { collectSitemapEntries } from '@/lib/seo/collect-sitemap-entries'
import { getURL, getRequestPublicOrigin } from '@/lib/url/public-app-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MINIMAL_STATIC_SITEMAP: MetadataRoute.Sitemap = [
  {
    url: `${getURL()}/`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1,
  },
  {
    url: `${getURL()}/discover`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.9,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let origin: string | undefined
  try {
    origin = await getRequestPublicOrigin()
  } catch {
    origin = getURL()
  }

  try {
    return await collectSitemapEntries(origin)
  } catch (error) {
    console.error('[sitemap] generation failed:', error)
    try {
      return await collectSitemapEntries(getURL())
    } catch (fallbackError) {
      console.error('[sitemap] fallback generation failed:', fallbackError)
      return MINIMAL_STATIC_SITEMAP
    }
  }
}
