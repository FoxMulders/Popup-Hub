import { ORGANIZATION, SITE_NAME } from '@/lib/seo/site-config'
import { publicAppUrl } from '@/lib/url/public-app-url'

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: ORGANIZATION.url,
    logo: publicAppUrl(ORGANIZATION.logoPath),
    ...(ORGANIZATION.sameAs.length > 0 ? { sameAs: ORGANIZATION.sameAs } : {}),
  }
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: publicAppUrl('/'),
    description:
      'Discover local pop-up markets, meet vendors, and manage booth operations across Canada.',
    inLanguage: 'en-CA',
    publisher: {
      '@type': 'Organization',
      name: ORGANIZATION.name,
      url: ORGANIZATION.url,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${publicAppUrl('/discover')}?when=weekend`,
      },
      'query-input': 'optional name=search_term_string',
    },
  }
}
