import type { ReactNode } from 'react'

export interface FaqItem {
  question: string
  answer: ReactNode
}

export const PLATFORM_FAQ: FaqItem[] = [
  {
    question: 'What is Popup Hub?',
    answer:
      'Popup Hub helps patrons discover local community markets, vendors apply for booth space, and coordinators run events — from applications and floor plans to check-in and checkout on market day.',
  },
  {
    question: 'Do I need an account to discover markets?',
    answer:
      'No. You can explore upcoming markets on Discover without signing in. Create a free account to save favorites, use your wallet, and get the most from quarter auctions and vendor features.',
  },
  {
    question: 'How do I apply as a vendor?',
    answer:
      'Sign up as a Vendor, complete your vendor passport (business details and product info), then discover open markets under Apply for open markets. Each event may have its own categories, fees, and approval process.',
  },
  {
    question: 'How much does Popup Hub cost for vendors and coordinators?',
    answer:
      'For vendors, creating an account and building your vendor passport is completely free; you only pay the specific booth fees set by individual market coordinators. For coordinators, Popup Hub charges a platform fee of 3% + $1 per booth transaction to power our system. Please note: Attempting to bypass platform tracking (such as neglecting to record official offline vendor payments) breaks community trust and will result in an immediate reliability rating penalty for both the host coordinator and the participating vendor. Keeping the system honest directly funds our unified market discovery tools and upcoming mobile app to drive foot traffic straight to your events.',
  },
  {
    question: 'Why does Popup Hub charge fees?',
    answer: (
      <>
        Popup Hub was built by fellow vendors — Brad and Sonia of The Tipsy Fox — to simplify chaotic
        market logistics and unite local communities in one coordinated effort. Coordinator platform fees
        (3% + $1 per booth) keep discovery tools, operations software, and our upcoming mobile app funded
        so patrons can find every local market in one place. Vendor passports and patron discovery stay
        free.{' '}
        <a href="/legal/about">Read our full story</a> for the transparent breakdown of how fees work and
        why keeping the system honest matters for everyone.
      </>
    ),
  },
  {
    question: 'How do I host a market as a coordinator?',
    answer:
      'Sign up as a Coordinator, create an event from your dashboard, configure booth categories and fees, approve vendor applications, and use the Spatial Planner and Live Operations tools on market day.',
  },
  {
    question: 'What are quarter auctions?',
    answer:
      'Some markets run digital quarter auctions where patrons bid on donated vendor items using quarters in their Popup Hub wallet. Availability depends on the event — check the market page for auction details.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'For policy or legal questions, email thetipsyfoxyeg@gmail.com. For product help, include your account email and a short description of the issue when contacting us.',
  },
]
