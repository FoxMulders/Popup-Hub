import Link from 'next/link'
import { ShieldAlert, Search } from 'lucide-react'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { listPublishedOrganizers, searchPublishedOrganizers } from '@/lib/queries/organizers'
import { CheckSearchForm } from '@/components/check/check-search-form'

export const metadata = buildPublicMetadata({
  title: 'Check an organizer before you pay — Popup Hub',
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
          Vendor protection
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Before you pay for a booth, check the organizer
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
          <div className="rounded-xl border border-dashed bg-canvas px-4 py-8 text-center text-sm text-muted-foreground">
            {q.trim()
              ? 'No published organizers match that search yet.'
              : 'No organizers published yet. Listings appear here after seed import and admin publish.'}
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

      <p className="text-xs text-muted-foreground">
        Vended at a market?{' '}
        <Link href="/signup?role=vendor" className="underline underline-offset-2">
          Sign up to leave a verified review
        </Link>{' '}
        (coming soon).
      </p>
    </div>
  )
}
