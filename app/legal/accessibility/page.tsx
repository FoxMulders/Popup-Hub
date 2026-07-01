import { LegalDocument } from '@/components/legal/legal-document'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Accessibility Statement',
  description: 'Popup Hub commitment to digital accessibility and WCAG 2.1 Level AA in Canada.',
  path: '/legal/accessibility',
})

const LAST_UPDATED = 'May 22, 2026'

export default function AccessibilityPage() {
  return (
    <LegalDocument title="Accessibility Statement" lastUpdated={LAST_UPDATED}>
      <p>
        Popup Hub is committed to ensuring digital accessibility for people with disabilities. We strive
        to improve the user experience for everyone and apply relevant accessibility standards across our
        shopper, vendor, and coordinator experiences.
      </p>

      <h2>1. Conformance target</h2>
      <p>
        Popup Hub aims to conform with the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA.
        These guidelines explain how to make web content more accessible to people with a wide range of
        disabilities, including visual, auditory, physical, speech, cognitive, language, learning, and
        neurological disabilities.
      </p>

      <h2>2. Legal alignment</h2>
      <p>
        Our accessibility program is designed to support compliance expectations under Canadian law,
        including:
      </p>
      <ul>
        <li>
          The <strong>Accessible Canada Act (ACA)</strong> and related federal accessibility
          requirements for digital services.
        </li>
        <li>
          The <strong>Accessibility for Ontarians with Disabilities Act (AODA)</strong> and its Integrated
          Accessibility Standards, including applicable web and customer-service requirements.
        </li>
        <li>
          Provincial accessibility standards in Alberta, British Columbia, Manitoba, Nova Scotia, and
          other provinces and territories where our services are offered.
        </li>
        <li>
          The <strong>Canadian Human Rights Act</strong>, which prohibits discrimination based on
          disability in federally regulated contexts.
        </li>
      </ul>
      <p>
        While we work toward WCAG 2.1 Level AA conformance, we recognize that accessibility is an ongoing
        effort and not all content may yet meet every success criterion.
      </p>

      <h2>3. Measures we take</h2>
      <ul>
        <li>Semantic HTML landmarks, labels, and heading structure in core user flows.</li>
        <li>Keyboard navigability for primary actions, forms, and dialogs.</li>
        <li>Sufficient color contrast for text and interactive controls in our design system.</li>
        <li>Text alternatives for meaningful images where feasible.</li>
        <li>Responsive layouts that support zoom and reflow on mobile devices.</li>
        <li>Accessibility reviews during feature development and before major releases.</li>
      </ul>

      <h2>4. Known limitations</h2>
      <p>
        Some third-party embeds—such as map interfaces, payment widgets, or live auction components—may
        rely on vendor accessibility support outside our direct control. We select partners with strong
        accessibility track records and advocate for improvements when gaps are identified.
      </p>

      <h2>5. Feedback and assistance</h2>
      <p>
        If you experience difficulty accessing any part of Popup Hub, or if you require content in an
        alternative format, please contact us. We welcome your feedback and will make reasonable efforts
        to provide the information or functionality you need.
      </p>
      <ul>
        <li>
          Email: <a href="mailto:accessibility@popuphub.app">accessibility@popuphub.app</a>
        </li>
        <li>Subject line: &ldquo;Accessibility feedback&rdquo;</li>
        <li>
          Please include the page URL, a description of the barrier encountered, and your preferred
          contact method.
        </li>
      </ul>
      <p>We aim to respond to accessibility inquiries within five (5) business days.</p>

      <h2>6. Continuous improvement</h2>
      <p>
        Popup Hub periodically audits key workflows—market discovery, vendor applications, coordinator
        review tools, and checkout—and prioritizes remediation of barriers identified through automated
        scans, manual testing, and user reports.
      </p>
    </LegalDocument>
  )
}
