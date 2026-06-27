import { publicAppUrl } from '@/lib/url/public-app-url'

type VendorProfileJsonLdInput = {
  eventId: string
  vendorId: string
  businessName: string
  description?: string | null
  logoUrl?: string | null
  categoryName?: string | null
  eventName?: string | null
  websiteUrl?: string | null
  shopUrl?: string | null
  instagramUrl?: string | null
}

export function buildVendorProfileJsonLd(input: VendorProfileJsonLdInput) {
  const profileUrl = publicAppUrl(`/events/${input.eventId}/vendors/${input.vendorId}`)
  const sameAs = [input.websiteUrl, input.shopUrl, input.instagramUrl]
    .filter((url): url is string => Boolean(url?.trim()))
    .map((url) => (url.startsWith('http') ? url : `https://${url}`))

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${input.businessName} — Popup Hub`,
    url: profileUrl,
    mainEntity: {
      '@type': 'Organization',
      name: input.businessName,
      url: profileUrl,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.logoUrl?.trim() ? { image: input.logoUrl.trim() } : {}),
      ...(input.categoryName ? { knowsAbout: input.categoryName } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
      ...(input.eventName
        ? {
            memberOf: {
              '@type': 'Event',
              name: input.eventName,
              url: publicAppUrl(`/events/${input.eventId}`),
            },
          }
        : {}),
    },
  }
}
