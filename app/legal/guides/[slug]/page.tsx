import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LegalDocument } from '@/components/legal/legal-document'
import { SeoGuideJsonLd } from '@/components/seo/seo-guide-json-ld'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { getSeoGuide, SEO_GUIDE_SLUGS } from '@/lib/seo/guides/guide-registry'

type Props = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return SEO_GUIDE_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const guide = getSeoGuide(slug)
  if (!guide) {
    return buildPublicMetadata({
      title: 'Guide not found — Popup Hub',
      description: 'This guide is unavailable.',
      path: `/legal/guides/${slug}`,
      noIndex: true,
    })
  }

  return buildPublicMetadata({
    title: `${guide.title} — Popup Hub`,
    description: guide.description,
    path: `/legal/guides/${guide.slug}`,
    keywords: guide.keywords,
    type: 'article',
  })
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = getSeoGuide(slug)
  if (!guide) notFound()

  return (
    <>
      <SeoGuideJsonLd guide={guide} />
      <LegalDocument title={guide.title} lastUpdated={guide.lastUpdated}>
        <p className="lead">{guide.description}</p>

        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet.slice(0, 48)}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        {guide.relatedLinks.length > 0 ? (
          <section>
            <h2>Related resources</h2>
            <ul>
              {guide.relatedLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </LegalDocument>
    </>
  )
}
