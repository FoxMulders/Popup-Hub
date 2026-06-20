import type { MetadataRoute } from 'next'
import { getRequestPublicOrigin, publicAppUrl } from '@/lib/url/public-app-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getRequestPublicOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/for-organizers',
          '/for-vendors',
          '/discover',
          '/markets/',
          '/supplies',
          '/events/',
          '/organizers/',
          '/coordinators/',
          '/patrons/',
          '/legal/',
        ],
        disallow: [
          '/api/',
          '/coordinator/',
          '/vendor/',
          '/shopper/',
          '/wallet/',
          '/profile/',
          '/notifications/',
          '/checkin/',
          '/shared/',
          '/admin/',
          '/login',
        ],
      },
    ],
    sitemap: publicAppUrl('/sitemap.xml', origin),
    host: publicAppUrl('/', origin),
  }
}
