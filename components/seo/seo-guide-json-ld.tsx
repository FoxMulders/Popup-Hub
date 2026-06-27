import { JsonLdScript } from '@/components/seo/json-ld-script'
import type { SeoGuide } from '@/lib/seo/guides/guide-registry'
import { publicAppUrl } from '@/lib/url/public-app-url'

export function SeoGuideJsonLd({ guide }: { guide: SeoGuide }) {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        dateModified: guide.lastUpdated,
        author: {
          '@type': 'Organization',
          name: 'Popup Hub',
          url: publicAppUrl('/'),
        },
        publisher: {
          '@type': 'Organization',
          name: 'Popup Hub',
          url: publicAppUrl('/'),
        },
        mainEntityOfPage: publicAppUrl(`/legal/guides/${guide.slug}`),
        inLanguage: 'en-CA',
      }}
    />
  )
}
