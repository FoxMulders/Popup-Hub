import type { MetadataRoute } from 'next'
import { publicAppUrl } from '@/lib/url/public-app-url'

export default function robots(): MetadataRoute.Robots {
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
    sitemap: publicAppUrl('/sitemap.xml'),
    host: publicAppUrl('/'),
  }
}
