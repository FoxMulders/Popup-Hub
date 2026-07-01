import Link from 'next/link'
import { LegalDocument } from '@/components/legal/legal-document'
import { SeoGuideJsonLd } from '@/components/seo/seo-guide-json-ld'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { SEO_GUIDES } from '@/lib/seo/guides/guide-registry'

export const metadata = buildPublicMetadata({
  title: 'Market Guides',
  description:
    'Practical guides for vendors, organizers, and patrons — vendor applications, booth fees, HubGuard trust, and running profitable pop-up markets in Canada.',
  path: '/legal/guides',
  keywords: [
    'artisan market guide',
    'vendor application guide Canada',
    'market organizer guide',
    'craft fair booth fees',
    'HubGuard',
  ],
})

export default function GuidesIndexPage() {
  return (
    <>
      <LegalDocument title="Market guides" lastUpdated="June 27, 2026">
        <p className="lead">
          Practical resources for vendors, organizers, and patrons — from finding legit applications
          to replacing spreadsheet chaos with a professional market dashboard.
        </p>

        <div className="not-prose mt-8 grid gap-4">
          {SEO_GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/legal/guides/${guide.slug}`}
              className="block rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-forest/30"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {guide.audience === 'all'
                  ? 'Everyone'
                  : guide.audience === 'vendors'
                    ? 'Vendors'
                    : guide.audience === 'coordinators'
                      ? 'Organizers'
                      : 'Patrons'}
              </p>
              <h2 className="mt-1 text-lg font-bold text-foreground">{guide.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{guide.description}</p>
            </Link>
          ))}
        </div>
      </LegalDocument>
    </>
  )
}
