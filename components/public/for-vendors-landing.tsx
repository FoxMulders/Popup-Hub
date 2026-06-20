import Link from 'next/link'
import { ShieldAlert, Store } from 'lucide-react'
import { ForVendorsJsonLd } from '@/components/seo/for-vendors-json-ld'
import { MarketingCtaBand } from '@/components/public/marketing/marketing-cta-band'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'
import { VendorSignupPassportPreview } from '@/components/marketing/vendor-signup-passport-preview'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { VENDOR_OPEN_MARKETS_HREF } from '@/lib/marketing/vendor-journey'

const FAQ = [
  {
    question: 'Is it free to join Popup Hub as a vendor?',
    answer:
      'Yes. Creating and maintaining your vendor passport is free. You only pay booth fees set by market organizers when you apply for a space.',
  },
  {
    question: 'What is a vendor passport?',
    answer:
      'Your passport is a reusable vendor profile — business name, categories, photos, and documents — so you apply to open and juried markets without resubmitting the same PDF every week.',
  },
  {
    question: 'Can I browse markets before signing up?',
    answer:
      'Yes. Discover upcoming markets, see confirmed vendor counts, and explore listings as a guest. Sign up when you are ready to apply.',
  },
  {
    question: 'How do I avoid market scams?',
    answer:
      'Search organizers in HubGuard before paying booth fees. Read vendor reviews, check official links, and look for verified scam alerts on Popup Hub.',
  },
] as const

export function ForVendorsLanding() {
  return (
    <>
      <ForVendorsJsonLd />
      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden marketing-hero-mesh text-white">
          <MarketingHeroBackdrop />
          <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
              <Store className="h-3.5 w-3.5" aria-hidden />
              For vendors &amp; artisans
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Apply to makers markets with one vendor passport
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/80 sm:text-lg">
              Build your profile once, browse open and juried markets near you, and verify organizers
              with HubGuard before you send booth fees.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup?role=vendor"
                className="marketing-pill marketing-pill--secondary inline-flex min-h-12 w-full items-center justify-center gap-2 sm:w-auto"
              >
                Create free vendor account
              </Link>
              <Link
                href={VENDOR_OPEN_MARKETS_HREF}
                className="marketing-pill min-h-12 w-full border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
              >
                Browse open markets
              </Link>
            </div>
            <Link
              href={TRUST_DIRECTORY_LINKS.check.href}
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white hover:underline underline-offset-2"
            >
              <ShieldAlert className="h-4 w-4" aria-hidden />
              {TRUST_DIRECTORY_LINKS.check.label} — verify organizers first →
            </Link>
          </div>
          <div className="marketing-section-divider" aria-hidden />
        </section>

        <section className="bg-cream px-4 py-16 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                One passport for every market
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Popup Hub replaces one-off application PDFs with a reusable vendor profile. Juried
                markets review your passport; open markets let you apply and pay booth fees in one
                flow.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li>Free to create — no subscription or listing fee</li>
                <li>Apply to multiple Alberta markets from one dashboard</li>
                <li>Upload insurance and product photos once, reuse per event</li>
                <li>Check organizer trust reports before paying booth fees</li>
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup?role=vendor" className="marketing-pill marketing-pill--primary min-h-11">
                  Start your passport
                </Link>
                <Link
                  href="/legal/faq"
                  className="marketing-pill min-h-11 border border-stone-200 bg-white text-foreground hover:bg-canvas"
                >
                  Vendor FAQ
                </Link>
              </div>
            </div>
            <VendorSignupPassportPreview />
          </div>
        </section>

        <section className="border-t border-stone-200/60 bg-linen px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Vendor FAQ</h2>
            <dl className="mt-6 space-y-6">
              {FAQ.map(({ question, answer }) => (
                <div key={question} className="marketing-glass-card p-5">
                  <dt className="font-semibold text-foreground">{question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <MarketingCtaBand />
      </main>
    </>
  )
}
