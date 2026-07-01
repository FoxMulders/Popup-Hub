import { LegalDocument } from '@/components/legal/legal-document'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Privacy Policy',
  description: 'How Popup Hub collects, stores, and shares personal information in Canada.',
  path: '/legal/privacy',
})

const LAST_UPDATED = 'May 22, 2026'

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        Popup Hub (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy. This
        Privacy Policy explains what information we collect, how we use it, and the choices you have when
        you use our marketplace platform in Canada.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> name, email address, phone number (optional), role (shopper,
          vendor, or coordinator), and authentication identifiers managed through Supabase Auth.
        </li>
        <li>
          <strong>Profile media:</strong> user avatar images and vendor passport logos uploaded to your
          account.
        </li>
        <li>
          <strong>Vendor passport data:</strong> business name, category selections, product photos, bio,
          and optional contact or shop links you choose to publish.
        </li>
        <li>
          <strong>Event and application data:</strong> booth applications, attendance selections, payment
          status, and coordinator review notes necessary to operate markets.
        </li>
        <li>
          <strong>Usage and device data:</strong> log data, browser type, and approximate location derived
          from IP address or map interactions.
        </li>
      </ul>

      <h2>2. How we store and protect your data</h2>
      <p>
        Popup Hub uses Supabase, a secure cloud infrastructure provider, to store application data,
        authentication records, and uploaded media. Data in transit is protected with TLS encryption.
        Data at rest is stored within Supabase-managed databases and object storage using industry-standard
        access controls and encrypted storage parameters configured for production environments.
      </p>
      <p>
        <strong>Profile images and vendor assets:</strong> user avatar images, corporate passport logos,
        and related media files are uploaded to Supabase Storage buckets with role-based access policies.
        Contact email addresses associated with your account are stored in our Supabase Postgres database
        and are not exposed publicly except where you explicitly choose to share them.
      </p>

      <h2>3. How we share information</h2>
      <p>We share personal information only as needed to operate the Platform:</p>
      <ul>
        <li>
          <strong>With event coordinators:</strong> when you submit a market application, coordinators
          for that event receive the vendor passport details required to review your submission—including
          your business name, categories, logo, product images, and the contact email on your account—so
          they can approve booths, communicate about logistics, and run the event.
        </li>
        <li>
          <strong>With payment processors:</strong> Square or other processors receive payment and
          payout information necessary to complete transactions you authorize.
        </li>
        <li>
          <strong>With service providers:</strong> email (for example, Resend), SMS (for example, Twilio),
          and analytics vendors that process data under contractual confidentiality obligations.
        </li>
        <li>
          <strong>For legal reasons:</strong> when required by law, court order, or to protect rights,
          safety, and security.
        </li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>4. Public visibility</h2>
      <p>
        Approved vendor listings on published market pages may display business names, logos, and product
        photos you uploaded. Shoppers do not receive your private email address unless you publish a
        contact link in your passport.
      </p>

      <h2>5. Your rights in Canada</h2>
      <p>Under Canadian privacy law, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete personal information we hold about you.</li>
        <li>Withdraw consent where processing is consent-based.</li>
        <li>Request portability of certain account data.</li>
        <li>Opt out of non-essential marketing communications.</li>
        <li>Challenge our compliance with applicable privacy legislation.</li>
      </ul>
      <p>
        Popup Hub processes personal information in accordance with the Personal Information Protection
        and Electronic Documents Act (PIPEDA) and, where applicable, provincial privacy statutes such as
        Alberta&apos;s Personal Information Protection Act (PIPA), British Columbia&apos;s PIPA, and
        Quebec&apos;s Act respecting the protection of personal information in the private sector (Law 25).
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain account and application records while your account is active and for a reasonable period
        afterward to comply with legal, tax, and dispute-resolution obligations. You may request account
        deletion by contacting us; some records may be retained where required by law.
      </p>

      <h2>7. Children</h2>
      <p>
        Popup Hub is not directed to children under 13 (or 16 where applicable). We do not knowingly
        collect personal information from children.
      </p>

      <h2>8. Cross-border processing</h2>
      <p>
        Your information is primarily stored and processed in Canada. Some service providers (for example,
        payment, email, or SMS vendors) may process data outside Canada under contractual safeguards
        consistent with PIPEDA and applicable provincial requirements.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We will post updates on this page and revise the &ldquo;Last updated&rdquo; date. Material changes
        may also be communicated by email or in-app notice where appropriate.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy requests: <a href="mailto:privacy@popuphub.app">privacy@popuphub.app</a>
      </p>
    </LegalDocument>
  )
}
