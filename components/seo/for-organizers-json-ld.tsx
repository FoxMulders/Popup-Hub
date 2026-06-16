import { JsonLdScript } from '@/components/seo/json-ld-script'
import { ORGANIZATION, ORGANIZERS_PAGE_DESCRIPTION, SITE_NAME } from '@/lib/seo/site-config'
import { publicAppUrl } from '@/lib/url/public-app-url'

export function ForOrganizersJsonLd() {
  const pageUrl = publicAppUrl('/for-organizers')

  return (
    <JsonLdScript
      data={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Market Organizer Software — Popup Hub',
          description: ORGANIZERS_PAGE_DESCRIPTION,
          url: pageUrl,
          isPartOf: {
            '@type': 'WebSite',
            name: SITE_NAME,
            url: publicAppUrl('/'),
          },
          about: {
            '@type': 'SoftwareApplication',
            name: `${SITE_NAME} for market organizers`,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'CAD',
              description: 'No monthly subscription — platform fee per booth transaction.',
            },
            provider: {
              '@type': 'Organization',
              name: ORGANIZATION.name,
              url: ORGANIZATION.url,
            },
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Is Popup Hub market organizer software?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Popup Hub is built for pop-up markets, makers markets, and artisan fairs — vendor applications, booth layouts, check-in, payouts, and patron discovery in one platform.',
              },
            },
            {
              '@type': 'Question',
              name: 'How much does it cost for market organizers?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'There is no monthly subscription. Popup Hub charges a 3% + $1 platform fee per booth transaction, and organizers can pass that fee to vendors at checkout.',
              },
            },
            {
              '@type': 'Question',
              name: 'Can I run juried vendor applications?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Configure categories, booth fees, insurance requirements, and approve or decline each vendor application before they pay.',
              },
            },
          ],
        },
      ]}
    />
  )
}
