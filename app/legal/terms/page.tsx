import { LegalDocument } from '@/components/legal/legal-document'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/contacts'
import { LEGAL_ENTITY_NAME, PLATFORM_OPERATOR_LINE, PRODUCT_BRAND_NAME } from '@/lib/legal/entity'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Terms of Service',
  description: 'Terms governing use of the Popup Hub marketplace platform in Canada.',
  path: '/legal/terms',
})

const LAST_UPDATED = 'June 23, 2026'

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
        {PLATFORM_OPERATOR_LINE}. {PRODUCT_BRAND_NAME} provides software that helps shoppers discover
        markets, vendors apply for booth space, and coordinators publish and manage events. Popup Hub is
        a technology platform—not the organizer of any in-person market unless explicitly stated in
        writing.
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
      <p>
        Coordinators and vendors must accurately record booth payments within the Platform dashboard.
        Intentionally circumventing platform fee structures—such as failing to mark vendors as paid to
        avoid applicable processing—violates these Terms and may result in reduced platform visibility,
        account suspension, or other enforcement action.
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

      <h2>6. Platform intellectual property</h2>
      <p>
        The Platform, including all software, source code, object code, algorithms, user interfaces,
        designs, documentation, trade secrets, and the Popup Hub, HubGrid, HubGuard, and Vendor Passport
        names and branding (collectively, &ldquo;Platform IP&rdquo;), is owned by {LEGAL_ENTITY_NAME} and
        its licensors and is protected by Canadian and international copyright, trademark, and other
        intellectual property laws.
      </p>
      <p>
        Subject to these Terms, {LEGAL_ENTITY_NAME} grants you a limited, non-exclusive, non-transferable,
        revocable license to access and use the Platform solely for its intended purpose. This license
        does not permit you to copy, modify, distribute, sell, lease, sublicense, reverse engineer,
        decompile, disassemble, or create derivative works from any part of the Platform IP, except
        where applicable law expressly permits such activity and cannot be waived by contract.
      </p>

      <h2>7. Prohibited uses</h2>
      <p>You agree not to, and not to assist others to:</p>
      <ul>
        <li>
          Scrape, crawl, harvest, or bulk-extract data from the Platform using automated means (bots,
          scripts, or similar tools) without our prior written consent.
        </li>
        <li>
          Reverse engineer, decompile, or attempt to derive the source code, underlying algorithms, or
          non-public APIs of the Platform.
        </li>
        <li>
          Circumvent access controls, authentication, rate limits, or security measures.
        </li>
        <li>
          Use Platform data, listings, or APIs to build or operate a competing marketplace or coordinator
          service without authorization.
        </li>
        <li>
          Remove, obscure, or alter copyright, trademark, or proprietary notices on the Platform.
        </li>
      </ul>

      <h2>8. Copyright and infringement reports</h2>
      <p>
        If you believe content on the Platform infringes your copyright or other intellectual property
        rights, send a written notice to{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> including:
      </p>
      <ul>
        <li>Identification of the copyrighted work or rights claimed to be infringed.</li>
        <li>Identification of the material on the Platform and its location (URL or description).</li>
        <li>Your contact information and a statement of good-faith belief that use is not authorized.</li>
        <li>
          A statement, under penalty of perjury where applicable, that the information in the notice is
          accurate and that you are authorized to act on behalf of the rights holder.
        </li>
      </ul>
      <p>
        We may remove or disable access to reported material and terminate repeat infringers where
        appropriate under the Copyright Act (Canada) and these Terms.
      </p>

      <h2>9. Limitation of liability</h2>
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

      <h2>10. Disclaimers</h2>
      <p>
        The Platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. Popup Hub
        does not guarantee uninterrupted service, error-free listings, or the quality, safety, or legality
        of any coordinator-run event or vendor offering.
      </p>

      <h2>11. Governing law and jurisdiction</h2>
      <p>
        These Terms are governed by the laws of the Province of Alberta and the applicable federal laws
        of Canada, without regard to conflict-of-law principles.
      </p>
      <p>
        You agree that the courts located in Alberta, Canada, have exclusive jurisdiction over disputes
        arising from these Terms, except where mandatory consumer-protection rules in your home province
        or territory require a different forum.
      </p>

      <h2>12. Survival</h2>
      <p>
        Sections relating to Platform intellectual property, prohibited uses, copyright reports, limitation
        of liability, disclaimers, governing law, and survival itself continue in effect after your
        account is closed or you stop using the Platform.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be posted on this page with
        an updated &ldquo;Last updated&rdquo; date. Continued use after changes become effective constitutes
        acceptance of the revised Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        For contractual notices or legal inquiries, contact{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalDocument>
  )
}
