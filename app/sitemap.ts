import type { MetadataRoute } from 'next'
import { collectSitemapEntries } from '@/lib/seo/collect-sitemap-entries'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return collectSitemapEntries()
}
