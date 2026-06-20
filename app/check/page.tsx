import Link from 'next/link'
import { ShieldAlert, Search } from 'lucide-react'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { listPublishedOrganizers, searchPublishedOrganizers } from '@/lib/queries/organizers'
import { CheckSearchForm } from '@/components/check/check-search-form'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

export const metadata = buildPublicMetadata({
  title: 'Canopy — Popup Hub security & fraud prevention',
  description:
    'Search Edmonton-area market organizers. See official links, vendor discussions, and scam alerts before you send booth fees.',
  path: '/check',
})

type Props = {
  searchParams: Promise<{ q?: string; region?: string }>
}

export default async function CheckPage({ searchParams }: Props) {
  const { q = '', region = 'edmonton-metro' } = await searchParams
  const organizers =
    q.trim().length > 0
      ? await searchPublishedOrganizers(q, region)
      : await listPublishedOrganizers(region)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-harvest-700">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          {TRUST_DIRECTORY_LINKS.check.label} · {TRUST_DIRECTORY_LINKS.check.tagline}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {TRUST_DIRECTORY_LINKS.check.boothFeeHeadline}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Search Edmonton-area markets and organizers. Verify official websites before sending money.
          Scam alerts and community mentions appear only after admin verification.
        </p>
      </div>

      <CheckSearchForm initialQuery={q} region={region} />

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" aria-hidden />
          {q.trim() ? `Results for “${q.trim()}”` : 'Edmonton metro organizers'}
          <span className="text-muted-foreground font-normal">({organizers.length})</span>
        </h2>

        {organizers.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-canvas px-4 py-8 text-center text-sm text-muted-foreground space-y-3">
            <p>
              {q.trim()
                ? 'No published organizers match that search yet.'
                : 'No organizers published yet. Listings appear here after verification.'}
            </p>
            <p>
              Organizer not listed?{' '}
              <Link
                href="/check/review"
                className="font-medium text-harvest-800 hover:underline underline-offset-2"
              >
                Submit a review
              </Link>{' '}
              and we&apos;ll add them after verification.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {organizers.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/organizers/${org.slug}`}
                  className="block rounded-xl border bg-white px-4 py-3 hover:bg-harvest-50/40 transition-colors"
                >
                  <p className="font-medium text-foreground">{org.display_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {org.city}, {org.province}
                    {org.typical_season_or_dates ? ` · ${org.typical_season_or_dates}` : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-xl border border-harvest-200 bg-harvest-50/50 px-4 py-4 text-sm">
        <p className="font-medium text-foreground">Vended at a market recently?</p>
        <p className="mt-1 text-muted-foreground">
          Help other vendors through Canopy before paying booth fees.
        </p>
        <Link
          href="/check/review"
          className="mt-3 inline-flex text-sm font-medium text-harvest-800 hover:underline underline-offset-2"
        >
          Leave a vendor review →
        </Link>
      </div>
    </div>
  )
}
