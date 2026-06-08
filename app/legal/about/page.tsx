import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal/legal-document'
import {
  ABOUT_CLOSING,
  ABOUT_DISCOVERY,
  ABOUT_FEES,
  ABOUT_FEES_INTRO,
  ABOUT_FOUNDERS,
  ABOUT_INTRO,
  ABOUT_LAST_UPDATED,
  ABOUT_SIGNATURE,
  ABOUT_TRUST,
} from '@/lib/legal/about-content'

export const metadata: Metadata = {
  title: 'About Us — Popup Hub',
  description:
    'Why Popup Hub exists, how our fees work, and the story behind the platform from Brad and Sonia at The Tipsy Fox.',
}

export default function AboutPage() {
  return (
    <LegalDocument title="About Popup Hub" lastUpdated={ABOUT_LAST_UPDATED}>
      <p className="lead">{ABOUT_INTRO}</p>

      <p>{ABOUT_FOUNDERS}</p>

      <p>{ABOUT_FEES_INTRO}</p>

      <ul>
        {ABOUT_FEES.map(({ role, detail }) => (
          <li key={role}>
            <strong>{role}:</strong> {detail}
          </li>
        ))}
      </ul>

      <p>{ABOUT_TRUST}</p>

      {ABOUT_DISCOVERY.split('\n\n').map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}

      {ABOUT_CLOSING.split('\n\n').map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}

      <p className="not-prose mt-10 font-heading text-base font-semibold text-foreground">{ABOUT_SIGNATURE}</p>
    </LegalDocument>
  )
}
