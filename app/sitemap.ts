import type { MetadataRoute } from 'next'
import { collectSitemapEntries } from '@/lib/seo/collect-sitemap-entries'
import { getRequestPublicOrigin } from '@/lib/url/public-app-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const origin = await getRequestPublicOrigin()
    return await collectSitemapEntries(origin)
  } catch (error) {
    console.error('[sitemap] generation failed:', error)
    return collectSitemapEntries()
  }
}
