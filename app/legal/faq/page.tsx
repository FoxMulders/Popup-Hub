import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal/legal-document'
import { PLATFORM_FAQ } from '@/lib/legal/faq-content'

export const metadata: Metadata = {
  title: 'FAQ — Popup Hub',
  description: 'Frequently asked questions about discovering markets, vending, and hosting events on Popup Hub.',
}

const LAST_UPDATED = 'May 24, 2026'

export default function FaqPage() {
  return (
    <LegalDocument title="Frequently Asked Questions" lastUpdated={LAST_UPDATED}>
      <p>
        Quick answers about using Popup Hub as a patron, vendor, or market coordinator. For legal
        policies, see our{' '}
        <a href="/legal/privacy">Privacy Policy</a> and <a href="/legal/terms">Terms of Service</a>.
      </p>

      <dl className="not-prose mt-8 space-y-6">
        {PLATFORM_FAQ.map(({ question, answer }) => (
          <div key={question} className="rounded-xl border border-stone-200 bg-white/60 px-4 py-4 sm:px-5">
            <dt className="font-heading text-base font-semibold text-foreground">{question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</dd>
          </div>
        ))}
      </dl>
    </LegalDocument>
  )
}
