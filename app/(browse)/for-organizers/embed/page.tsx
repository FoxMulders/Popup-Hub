import Link from 'next/link'
import { ForOrganizersJsonLd } from '@/components/seo/for-organizers-json-ld'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { publicAppUrl } from '@/lib/url/public-app-url'

export const metadata = buildPublicMetadata({
  title: 'Official Application Badges — Popup Hub',
  description:
    'Embed verified Popup Hub badges on your market website — link vendors to your official application page and earn trust backlinks.',
  path: '/for-organizers/embed',
  keywords: [
    'official vendor application badge',
    'market organizer embed',
    'Popup Hub verified organizer',
    'craft fair application link',
  ],
})

const BADGES = [
  {
    id: 'official-applications',
    label: 'Official applications powered by Popup Hub',
    snippet: `<a href="${publicAppUrl('/for-organizers')}" rel="noopener noreferrer" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;border:1px solid #2d5a27;background:#f7f4ef;color:#1a3318;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">Official applications — Popup Hub</a>`,
  },
  {
    id: 'verify-hubguard',
    label: 'Verify us on HubGuard',
    snippet: `<a href="${publicAppUrl('/check')}" rel="noopener noreferrer" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;border:1px solid #7c3aed;background:#faf5ff;color:#4c1d95;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">Verify our market on HubGuard</a>`,
  },
  {
    id: 'vendor-lineup',
    label: 'View vendor lineup',
    snippet: `<a href="${publicAppUrl('/discover')}" rel="noopener noreferrer" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;border:1px solid #0f766e;background:#f0fdfa;color:#134e4a;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">View our vendor lineup on Popup Hub</a>`,
  },
] as const

export default function OrganizerEmbedBadgesPage() {
  return (
    <>
      <ForOrganizersJsonLd />
      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden marketing-hero-mesh text-white">
          <MarketingHeroBackdrop />
          <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Official application badges
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
              Help vendors find your real application URL, verify your market on HubGuard, and link
              back to Popup Hub from your website, newsletter, or tourism listing.
            </p>
          </div>
          <div className="marketing-section-divider" aria-hidden />
        </section>

        <section className="bg-cream px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="rounded-2xl border bg-white p-6">
              <h2 className="text-xl font-bold text-foreground">Why embed a badge?</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Vendors can distinguish your official application from impersonation scams.</li>
                <li>Tourism boards, chambers, and craft blogs can link to a verified destination.</li>
                <li>Your published market lineup drives patron discovery before market day.</li>
              </ul>
            </div>

            {BADGES.map((badge) => (
              <div key={badge.id} className="rounded-2xl border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground">{badge.label}</h2>
                <div
                  className="mt-4 overflow-x-auto rounded-xl border bg-canvas p-4"
                  dangerouslySetInnerHTML={{ __html: badge.snippet }}
                />
                <pre className="mt-4 overflow-x-auto rounded-xl bg-stone-900 p-4 text-xs text-stone-100">
                  <code>{badge.snippet}</code>
                </pre>
              </div>
            ))}

            <div className="rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold text-foreground">Partnership outreach kit</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Share these resources with local news, craft associations, libraries, and tourism
                boards when you publish your market season.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href="/legal/guides/safe-vendor-application-checklist" className="font-semibold text-forest hover:underline">
                    Safe vendor application checklist
                  </Link>
                </li>
                <li>
                  <Link href="/legal/guides/find-legit-vendor-applications" className="font-semibold text-forest hover:underline">
                    How vendors find legit applications
                  </Link>
                </li>
                <li>
                  <Link href="/check" className="font-semibold text-forest hover:underline">
                    HubGuard organizer trust search
                  </Link>
                </li>
              </ul>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Ready to publish?{' '}
              <Link href="/signup?role=coordinator&next=/coordinator/events/new" className="font-semibold text-forest hover:underline">
                Create your first market listing →
              </Link>
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
