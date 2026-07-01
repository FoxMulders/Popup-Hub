import { JsonLdScript } from '@/components/seo/json-ld-script'
import { ORGANIZATION, SITE_NAME, VENDORS_PAGE_DESCRIPTION } from '@/lib/seo/site-config'
import { publicAppUrl } from '@/lib/url/public-app-url'

export function ForVendorsJsonLd() {
  const pageUrl = publicAppUrl('/for-vendors')

  return (
    <JsonLdScript
      data={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Vendor Market Application',
          description: VENDORS_PAGE_DESCRIPTION,
          url: pageUrl,
          isPartOf: {
            '@type': 'WebSite',
            name: SITE_NAME,
            url: publicAppUrl('/'),
          },
          about: {
            '@type': 'Service',
            name: 'Popup Hub vendor passport',
            serviceType: 'Vendor market applications',
            provider: {
              '@type': 'Organization',
              name: ORGANIZATION.name,
              url: ORGANIZATION.url,
            },
            areaServed: {
              '@type': 'Country',
              name: 'Canada',
            },
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Is it free to join Popup Hub as a vendor?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Creating and maintaining your vendor passport is free. You only pay booth fees set by market organizers when you apply for a space.',
              },
            },
            {
              '@type': 'Question',
              name: 'What is a vendor passport on Popup Hub?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Your passport is a reusable vendor profile — business name, categories, photos, and documents — so you apply to open and juried markets without resubmitting the same PDF every week.',
              },
            },
            {
              '@type': 'Question',
              name: 'How do I verify a market organizer before paying booth fees?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Use HubGuard on Popup Hub to search organizers, read vendor reviews, and see verified official links and scam alerts before you send money.',
              },
            },
          ],
        },
      ]}
    />
  )
}
