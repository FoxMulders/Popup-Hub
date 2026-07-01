import { ORGANIZATION, SITE_NAME } from '@/lib/seo/site-config'
import { SUPPORT_CONTACT_EMAIL } from '@/lib/legal/contacts'
import { publicAppUrl } from '@/lib/url/public-app-url'

export function buildContactPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${SITE_NAME}`,
    url: publicAppUrl('/contact'),
    description: 'Contact Popup Hub for support with markets, vendor applications, and organizer tools.',
    mainEntity: {
      '@type': 'Organization',
      name: ORGANIZATION.name,
      url: ORGANIZATION.url,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_CONTACT_EMAIL,
        areaServed: 'CA',
        availableLanguage: 'English',
      },
    },
  }
}
