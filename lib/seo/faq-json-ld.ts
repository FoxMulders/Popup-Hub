import { publicAppUrl } from '@/lib/url/public-app-url'

type FaqItem = {
  question: string
  answer: string
}

export function buildFaqPageJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
    url: publicAppUrl('/legal/faq'),
  }
}
