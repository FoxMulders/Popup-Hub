import { publicAppUrl } from '@/lib/url/public-app-url'

type OrganizerJsonLdInput = {
  slug: string
  displayName: string
  city?: string | null
  province?: string | null
  websiteUrl?: string | null
  reviewCount?: number
  averageRating?: number | null
}

export function buildOrganizerTrustJsonLd(input: OrganizerJsonLdInput) {
  const pageUrl = publicAppUrl(`/organizers/${input.slug}`)

  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    name: input.displayName,
    url: pageUrl,
    ...(input.websiteUrl?.trim()
      ? { sameAs: [input.websiteUrl.startsWith('http') ? input.websiteUrl : `https://${input.websiteUrl}`] }
      : {}),
  }

  if (input.city?.trim() || input.province?.trim()) {
    organization.address = {
      '@type': 'PostalAddress',
      ...(input.city?.trim() ? { addressLocality: input.city.trim() } : {}),
      ...(input.province?.trim() ? { addressRegion: input.province.trim() } : {}),
      addressCountry: 'CA',
    }
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${input.displayName} — Organizer Trust Report`,
    url: pageUrl,
    about: organization,
  }

  if (
    input.reviewCount != null &&
    input.reviewCount > 0 &&
    input.averageRating != null &&
    input.averageRating > 0
  ) {
    jsonLd.mainEntity = {
      ...organization,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: input.averageRating.toFixed(1),
        reviewCount: input.reviewCount,
        bestRating: '5',
        worstRating: '1',
      },
    }
  }

  return jsonLd
}
