import Link from 'next/link'
import {
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  MapPin,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react'
import { ForOrganizersJsonLd } from '@/components/seo/for-organizers-json-ld'

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'Vendor applications & approvals',
    description:
      'Collect applications, review vendor passports, approve booth categories, and manage waitlists without email threads.',
  },
  {
    icon: LayoutGrid,
    title: 'Booth layout & floor plans',
    description:
      'Auto-arrange vendor booths with traffic-aware or fairness-first layouts, live spatial planner, and printable maps.',
  },
  {
    icon: MapPin,
    title: 'Patron discovery',
    description:
      'Published markets appear on Popup Hub discovery maps so shoppers see dates, locations, and confirmed vendors before they arrive.',
  },
  {
    icon: Wallet,
    title: 'Booth fees & payouts',
    description:
      'Collect booth payments, track escrow holds, and choose whether platform fees pass through to vendors or stay on your payout.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust & verification',
    description:
      'Community vouching, reliability ratings, and transparent transaction history protect vendors and organizers alike.',
  },
  {
    icon: Store,
    title: 'Market day operations',
    description:
      'Check-in, live operations, quarter auctions, and coordinator tools built for recurring pop-up and makers markets.',
  },
] as const

const STEPS = [
  {
    step: '1',
    title: 'Create your market',
    description: 'Set dates, location, booth categories, fees, and juried or open applications.',
  },
  {
    step: '2',
    title: 'Approve vendors',
    description: 'Review applications, collect documents, and confirm booth assignments from one dashboard.',
  },
  {
    step: '3',
    title: 'Publish & run market day',
    description: 'Layout booths, open check-in, and let patrons discover your lineup on Popup Hub.',
  },
] as const

const FAQ = [
  {
    question: 'Is Popup Hub market organizer software?',
    answer:
      'Yes. Popup Hub is built for pop-up markets, makers markets, and artisan fairs — vendor applications, booth layouts, check-in, payouts, and patron discovery in one platform.',
  },
  {
    question: 'How much does it cost for market organizers?',
    answer:
      'There is no monthly subscription. Popup Hub charges a 3% + $1 platform fee per booth transaction, and you can pass that fee to vendors at checkout so you keep 100% of your listed booth price.',
  },
  {
    question: 'Can I run juried vendor applications?',
    answer:
      'Yes. Configure categories, booth fees, insurance requirements, and approve or decline each vendor application before they pay.',
  },
] as const

export function ForOrganizersLanding() {
  return (
    <>
      <ForOrganizersJsonLd />
      <main className="flex flex-1 flex-col">
        <section className="border-b border-stone-200 bg-gradient-to-b from-violet-50 to-cream">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-800">
              For market organizers
            </p>
            <h1 className="mt-3 font-heading text-4xl font-semibold text-foreground sm:text-5xl">
              Market organizer software for pop-up &amp; makers markets
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
              Popup Hub replaces spreadsheets and DMs with one coordinator hub — vendor
              applications, booth layouts, check-in, payouts, and a discovery map that drives
              foot traffic to your event.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup?role=coordinator"
                className="btn-tactile inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-forest px-8 py-3 text-base font-semibold text-white shadow-[var(--shadow-market-lift)] hover:bg-forest-deep touch-manipulation sm:w-auto"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Start hosting a market
              </Link>
              <Link
                href="/legal/faq"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-stone-200 bg-white px-8 py-3 text-base font-semibold text-foreground hover:bg-canvas touch-manipulation sm:w-auto"
              >
                Read organizer FAQ
              </Link>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
              Built in Canada by market operators who also vend at weekend markets — not a generic
              event ticketing tool.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-2xl border bg-white p-6 shadow-sm"
            >
              <Icon className="h-8 w-8 text-violet-700" aria-hidden />
              <h2 className="mt-3 font-heading text-lg font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>

        <section className="border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">
              How market organizers use Popup Hub
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map(({ step, title, description }) => (
                <li key={step} className="text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-900">
                    {step}
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="font-heading text-2xl font-semibold text-foreground">
            Market organizer FAQ
          </h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map(({ question, answer }) => (
              <div key={question}>
                <dt className="font-semibold text-foreground">{question}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{answer}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-sm text-muted-foreground">
            Shoppers discover your published markets on{' '}
            <Link href="/discover" className="font-semibold text-forest hover:underline">
              Popup Hub discovery
            </Link>
            . Vendors apply through your market listing — you stay in control of approvals and booth
            fees.
          </p>
        </section>

        <section className="border-t border-stone-200 bg-violet-50/60">
          <div className="mx-auto max-w-5xl px-4 py-14 text-center">
            <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
              Ready to organize your next market?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Create a coordinator account, publish your first event, and replace manual vendor
              spreadsheets with market management software built for recurring pop-up markets.
            </p>
            <Link
              href="/signup?role=coordinator"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-forest px-8 py-3 text-base font-semibold text-white hover:bg-forest-deep"
            >
              Create coordinator account
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
