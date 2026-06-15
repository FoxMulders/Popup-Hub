import type { MetadataRoute } from 'next'
import { getRequestPublicOrigin, publicAppUrl } from '@/lib/url/public-app-url'
import { collectSitemapEntries } from '@/lib/seo/collect-sitemap-entries'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getRequestPublicOrigin()
  return collectSitemapEntries(origin)
}
