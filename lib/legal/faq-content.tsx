import { ReactNode } from 'react';

export interface FaqItem {
  question: string;
  answer: ReactNode;
}

export const PLATFORM_FAQ: FaqItem[] = [
  {
    question: 'What is Popup Hub?',
    answer:
      'Popup Hub helps patrons discover local community markets, vendors apply for booth space, and coordinators run events — from applications and floor plans to check-in and checkout on market day.',
  },
  {
    question: 'Why should I choose Popup Hub instead of just running my markets through social media DMs and spreadsheets?',
    answer: (
      <div className="space-y-3">
        <p>
          Operating a pop-up market through Instagram DMs, email threads, and manual spreadsheets wastes hours of administrative time and exposes your business to massive fraud risks. Popup Hub brings the entire artisan community into a single, unified ecosystem built by vendors, for organizers:
        </p>
        <p>
          <strong>Zero-Spreadsheet Management:</strong> Say goodbye to administrative chaos. Instantly review juried applications, manage accepted makers, and map out your venue layout visually using our drag-and-drop Blueprint Studio.
        </p>
        <p>
          <strong>Community-Driven Trust:</strong> Our built-in verification network balances vendor safety with coordinator cash flow. New organizers get a 25% advance immediately to secure their venue, while the remaining 75% is held safely by the platform until the event successfully completes. You can bypass this hold by earning community trust — either 3 vouches from verified organizers or 10 vouches from verified vendors who have worked your markets.
        </p>
        <p>
          <strong>Flexible Fee Controls:</strong> Keep 100% of your listed booth price. Coordinators can choose whether payment processing and platform fees (3% + $1) are deducted from their payouts or automatically passed through to vendors at checkout.
        </p>
        <p>
          <strong>Built-In Marketing & Discovery:</strong> Stop shouting into social media algorithms. Vendors can upload 30-second Passport Stories directly to their unified profile, letting patrons discover and "Meet the Maker" before they even step through the venue doors. Popup Hub moves your market operations away from chaotic group chats into a professional, secure, and automated headquarters that helps you scale your business.
        </p>
      </div>
    ),
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
    answer: (
      <div className="space-y-3">
        <p>
          Creating an account and building your digital profile or vendor passport is completely free for everyone. The cost depends on your role in the market:
        </p>
        <p>
          <strong>For Vendors:</strong> Applying to markets is free; you only pay the specific booth fees set by the market coordinators. If a coordinator has enabled processing fee pass-through, you will pay a small 3% + $1 transaction tax at checkout to secure your 75% escrow refund protection.
        </p>
        <p>
          <strong>For Coordinators:</strong> There are no monthly subscriptions. Popup Hub takes a flat platform fee of 3% + $1 per booth transaction. Best of all, you have a toggle switch on your dashboard to pass this entire fee directly onto the vendor at checkout so you keep 100% of your listed booth price.
        </p>
        <p>
          <strong>A Note on Trust & Offline Payments:</strong> If an unverified coordinator processes transactions off the platform (like manual e-Transfers or cash), those transactions cannot clear the 75% escrow hold or count toward your community-trusted status. Attempting to bypass tracking to avoid fees breaks community trust and will result in an immediate reliability rating penalty for both the host and the vendor. Keeping transactions transparent directly protects the community, automates your verification, and funds our upcoming patron mobile app to drive foot traffic straight to your events.
        </p>
      </div>
    ),
  },
  {
    question: 'Why does Popup Hub charge fees?',
    answer: (
      <>
        <p className="mb-3">
          Popup Hub was built by fellow vendors — Brad and Sonia of The Tipsy Fox — to simplify chaotic 
          market logistics and unite local communities in one coordinated effort. Coordinator platform fees 
          (3% + $1 per booth) keep our discovery tools and operations software funded so patrons can find 
          every local market in one place. 
        </p>
        <p className="mb-3">
          To further protect our community, holding funds in escrow is our direct answer to combat market 
          fraud. This protective holding period is not there to withhold hard-earned revenue from honest 
          coordinators; rather, it serves as a critical safety net so that vendors can recoup their deposits 
          should an unwanted fraudulent actor sneak into the ecosystem. By securing these transactions during 
          the booking phase, we isolate malicious accounts before they can cause widespread financial damage 
          to local small businesses.
        </p>
        <p className="mb-4">
          Moving forward, these fees will also directly fund the development and launch of our dedicated 
          mobile app for patrons. Because a mobile application requires continuous maintenance, hosting, 
          and updates to stay live on the App Stores, these transaction fees ensure our patron discovery 
          features remain completely free for vendors and shoppers while providing a high-traffic, 
          reliable platform that drives foot traffic straight to your local events.
        </p>
        <p>
          <a href="/legal/about" className="text-emerald-700 hover:underline font-medium">
            Read our full story
          </a>{' '}
          for the transparent breakdown of how fees work and why keeping the system honest matters for everyone.
        </p>
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
];