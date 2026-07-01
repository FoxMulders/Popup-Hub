import Link from 'next/link'
import { Mail, MessageCircleQuestion } from 'lucide-react'
import { SiteContentShell } from '@/components/layout/site-content-shell'
import { JsonLdScript } from '@/components/seo/json-ld-script'
import { GuestNav } from '@/components/nav/guest-nav'
import { buildContactPageJsonLd } from '@/lib/seo/contact-json-ld'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import {
  CONTACT_PAGE_DESCRIPTION,
  CONTACT_PAGE_TITLE,
} from '@/lib/seo/site-config'
import { SUPPORT_CONTACT_EMAIL } from '@/lib/legal/contacts'

export const metadata = buildPublicMetadata({
  title: CONTACT_PAGE_TITLE,
  description: CONTACT_PAGE_DESCRIPTION,
  path: '/contact',
})

export default function ContactPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col site-surface">
      <GuestNav />
      <SiteContentShell>
        <JsonLdScript data={buildContactPageJsonLd()} />
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-sage-700">Contact</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {CONTACT_PAGE_TITLE}
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
            Questions about discovering markets, applying as a vendor, or running events with Popup
            Hub? We&apos;re happy to help.
          </p>

          <div className="mt-8 space-y-4">
            <a
              href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
              className="marketing-glass-card flex items-start gap-4 p-5 transition-colors hover:bg-sage-50/50"
            >
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Email support</p>
                <p className="mt-1 text-sm text-muted-foreground">{SUPPORT_CONTACT_EMAIL}</p>
              </div>
            </a>

            <Link
              href="/legal/faq"
              className="marketing-glass-card flex items-start gap-4 p-5 transition-colors hover:bg-sage-50/50"
            >
              <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">FAQ</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quick answers for patrons, vendors, and coordinators.
                </p>
              </div>
            </Link>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            For legal policies, see our{' '}
            <Link href="/legal/about" className="font-medium text-forest hover:underline">
              About
            </Link>
            ,{' '}
            <Link href="/legal/privacy" className="font-medium text-forest hover:underline">
              Privacy Policy
            </Link>
            , and{' '}
            <Link href="/legal/terms" className="font-medium text-forest hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </main>
      </SiteContentShell>
    </div>
  )
}
