import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, ExternalLink, Globe } from 'lucide-react'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import {
  getPublishedCommunityMentions,
  getPublishedOrganizerBySlug,
  getPublishedOrganizerEvents,
  getPublishedScamAlerts,
} from '@/lib/queries/organizers'
import { Badge } from '@/components/ui/badge'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const org = await getPublishedOrganizerBySlug(slug)
  if (!org) {
    return buildPublicMetadata({
      title: 'Organizer not found — Popup Hub',
      description: 'This organizer profile is not available.',
      path: `/organizers/${slug}`,
    })
  }
  return buildPublicMetadata({
    title: `${org.display_name} — Organizer Trust Report`,
    description: `Check ${org.display_name} in ${org.city}, AB before paying booth fees.`,
    path: `/organizers/${org.slug}`,
  })
}

export default async function OrganizerTrustReportPage({ params }: Props) {
  const { slug } = await params
  const organizer = await getPublishedOrganizerBySlug(slug)
  if (!organizer) notFound()

  const [events, scamAlerts, mentions] = await Promise.all([
    getPublishedOrganizerEvents(organizer.id),
    getPublishedScamAlerts(organizer.id),
    getPublishedCommunityMentions(organizer.id),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <Link
        href="/check"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to search
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{organizer.display_name}</h1>
        <p className="text-sm text-muted-foreground">
          {organizer.city}, {organizer.province}
          {organizer.primary_contact_name ? ` · ${organizer.primary_contact_name}` : null}
        </p>
        {organizer.typical_season_or_dates ? (
          <p className="text-sm text-foreground">{organizer.typical_season_or_dates}</p>
        ) : null}
        {organizer.website_url ? (
          <a
            href={organizer.website_url.startsWith('http') ? organizer.website_url : `https://${organizer.website_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-harvest-700 hover:underline"
          >
            <Globe className="h-4 w-4" aria-hidden />
            Official website
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </header>

      {scamAlerts.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Scam alert
          </div>
          {scamAlerts.map((alert) => (
            <div key={alert.id} className="text-sm text-red-950 space-y-1">
              <p className="font-medium">{alert.alert_title}</p>
              <p className="text-red-900/90">{alert.alert_body}</p>
              {alert.source_permalink ? (
                <a
                  href={alert.source_permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-red-800 underline underline-offset-2"
                >
                  Source: vendor group discussion
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published events listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{ev.name}</p>
                {ev.typical_dates ? (
                  <p className="text-muted-foreground text-xs mt-0.5">{ev.typical_dates}</p>
                ) : null}
                {ev.booth_fee_cad != null ? (
                  <p className="text-xs mt-0.5">Booth fee (reported): ${ev.booth_fee_cad} CAD</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Community mentions</h2>
        <p className="text-xs text-muted-foreground">
          From vendor discussions. Unverified — not formal reviews.
        </p>
        {mentions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No verified community mentions yet.</p>
        ) : (
          <ul className="space-y-3">
            {mentions.map((m) => (
              <li key={m.id} className="rounded-lg border bg-canvas px-3 py-2 text-sm">
                <p className="italic">&ldquo;{m.quote}&rdquo;</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Community mention (unverified)
                  </Badge>
                  {m.sentiment ? (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {m.sentiment}
                    </Badge>
                  ) : null}
                </div>
                {m.source_permalink ? (
                  <a
                    href={m.source_permalink as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
                  >
                    View source thread
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Formal vendor reviews</p>
        <p className="mt-1">No verified reviews yet. Be the first after you vend here.</p>
      </section>
    </div>
  )
}
