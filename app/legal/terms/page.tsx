import { LegalDocument } from '@/components/legal/legal-document'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Terms of Service — Popup Hub',
  description: 'Terms governing use of the Popup Hub marketplace platform in Canada.',
  path: '/legal/terms',
})

const LAST_UPDATED = 'May 22, 2026'

export default function TermsOfServicePage() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Popup Hub, including
        our website, mobile experiences, and related services (collectively, the &ldquo;Platform&rdquo;).
        The Platform is offered to users in Canada. By creating an account or using the Platform, you agree
        to these Terms.
      </p>

      <h2>1. The Platform</h2>
      <p>
        Popup Hub provides software that helps shoppers discover markets, vendors apply for booth space,
        and coordinators publish and manage events. Popup Hub is a technology platform—not the organizer
        of any in-person market unless explicitly stated in writing.
      </p>

      <h2>2. Accounts and eligibility</h2>
      <ul>
        <li>You must provide accurate registration information and keep your account credentials secure.</li>
        <li>You must be at least 18 years old, or the age of majority in your jurisdiction, to register.</li>
        <li>
          Coordinators and vendors are responsible for their own licenses, permits, insurance, tax
          obligations, and compliance with local health and safety rules.
        </li>
      </ul>

      <h2>3. Payments and fees</h2>
      <p>
        Certain booth fees, platform fees, or auction transactions may be processed through integrated
        payment partners such as Square. Pricing displayed at checkout is authoritative. Refunds, when
        applicable, follow the coordinator&apos;s published policy and applicable payment-network rules.
      </p>

      <h2>4. No partnership</h2>
      <p>
        Using the Platform does <strong>not</strong> create a joint venture, partnership, employment,
        franchise, or agency relationship between Popup Hub and any user, coordinator, vendor, or shopper.
        Coordinators and vendors remain independent parties. Popup Hub does not direct day-to-day booth
        operations, hiring, or on-site staffing for third-party events.
      </p>

      <h2>5. User content and conduct</h2>
      <p>
        You retain ownership of content you upload (for example, business descriptions, product photos,
        and logos). You grant Popup Hub a limited license to host, display, and transmit that content
        solely to operate the Platform. You agree not to upload unlawful, misleading, or infringing
        material, and not to interfere with Platform security or other users.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by applicable law, Popup Hub and its officers, directors,
        employees, and affiliates will not be liable for any indirect, incidental, special, consequential,
        or punitive damages, or for lost profits, data, goodwill, or business interruption arising from
        your use of the Platform or attendance at any third-party event listed on the Platform.
      </p>
      <p>
        <strong>
          Popup Hub&apos;s total cumulative liability to you for any claims arising out of or relating to
          these Terms or the Platform is limited to the greater of (a) the total amount you paid to Popup
          Hub in the twelve (12) months immediately preceding the event giving rise to the claim, or (b)
          zero dollars (CAD $0) if you are on a free or beta tier and have not paid platform
          fees during that period.
        </strong>
      </p>
      <p>
        Some jurisdictions do not allow certain liability exclusions; in those cases, our liability is
        limited to the minimum extent required by law.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. Popup Hub
        does not guarantee uninterrupted service, error-free listings, or the quality, safety, or legality
        of any coordinator-run event or vendor offering.
      </p>

      <h2>8. Governing law and jurisdiction</h2>
      <p>
        These Terms are governed by the laws of the Province of Alberta and the applicable federal laws
        of Canada, without regard to conflict-of-law principles.
      </p>
      <p>
        You agree that the courts located in Alberta, Canada, have exclusive jurisdiction over disputes
        arising from these Terms, except where mandatory consumer-protection rules in your home province
        or territory require a different forum.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be posted on this page with
        an updated &ldquo;Last updated&rdquo; date. Continued use after changes become effective constitutes
        acceptance of the revised Terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        For contractual notices or legal inquiries, contact{' '}
        <a href="mailto:thetipsyfoxyeg@gmail.com">thetipsyfoxyeg@gmail.com</a>.
      </p>
    </LegalDocument>
  )
}
