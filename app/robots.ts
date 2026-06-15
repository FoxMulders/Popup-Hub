import type { MetadataRoute } from 'next'
import { getRequestPublicOrigin, publicAppUrl } from '@/lib/url/public-app-url'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getRequestPublicOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/discover',
          '/supplies',
          '/events/',
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
