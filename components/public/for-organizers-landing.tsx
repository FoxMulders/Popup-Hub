import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { ForOrganizersJsonLd } from '@/components/seo/for-organizers-json-ld'
import { MarketingCtaBand } from '@/components/public/marketing/marketing-cta-band'
import { MarketingFeatures } from '@/components/public/marketing/marketing-features'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'

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
        <section className="relative overflow-hidden marketing-hero-mesh text-white">
          <MarketingHeroBackdrop />
          <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
            <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
              For market organizers
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Market organizer software for pop-up &amp; makers markets
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/80 sm:text-lg">
              Replace spreadsheets and DMs with one coordinator hub — vendor applications, booth
              layouts, check-in, payouts, and a discovery map that drives foot traffic to your event.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup?role=coordinator"
                className="marketing-pill marketing-pill--secondary inline-flex min-h-12 w-full items-center justify-center gap-2 sm:w-auto"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Start hosting a market
              </Link>
              <Link
                href="/legal/faq"
                className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
              >
                Read organizer FAQ
              </Link>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/65">
              Built in Canada by market operators who also vend at weekend markets — not a generic
              event ticketing tool.
            </p>
          </div>
          <div className="marketing-section-divider" aria-hidden />
        </section>

        <MarketingFeatures />

        <section className="bg-cream px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How market organizers use Popup Hub
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map(({ step, title, description }) => (
                <li key={step} className="marketing-glass-card p-6 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-forest text-sm font-bold text-primary-foreground">
                    {step}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-stone-200/60 bg-linen px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Market organizer FAQ</h2>
            <dl className="mt-6 space-y-6">
              {FAQ.map(({ question, answer }) => (
                <div key={question} className="marketing-glass-card p-5">
                  <dt className="font-semibold text-foreground">{question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</dd>
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
          </div>
        </section>

        <MarketingCtaBand />
      </main>
    </>
  )
}
