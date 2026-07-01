export type SeoGuideSection = {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export type SeoGuide = {
  slug: string
  title: string
  description: string
  lastUpdated: string
  keywords: string[]
  audience: 'vendors' | 'coordinators' | 'patrons' | 'all'
  sections: SeoGuideSection[]
  relatedLinks: Array<{ href: string; label: string }>
}

export const SEO_GUIDES: SeoGuide[] = [
  {
    slug: 'running-profitable-popup-market',
    title: 'The Ultimate Guide to Running a Profitable Pop-up Market in Canada',
    description:
      'A practical playbook for Canadian market organizers — booth economics, vendor curation, patron discovery, and day-of operations without spreadsheet chaos.',
    lastUpdated: 'June 27, 2026',
    audience: 'coordinators',
    keywords: [
      'run a pop-up market Canada',
      'profitable makers market',
      'market organizer guide',
      'artisan fair planning',
    ],
    sections: [
      {
        heading: 'Start with a repeatable market model',
        paragraphs: [
          'Profitable pop-up markets are rarely one-off experiments. The organizers who grow sustainably treat each date as part of a series — predictable booth fees, a recognizable brand, and vendors who return because applications, payments, and communication are professional.',
          'Before you publish your first listing, decide your market type: juried artisan fair, open community pop-up, farmers market hybrid, or themed night market. Each model attracts different vendors and sets different patron expectations.',
        ],
      },
      {
        heading: 'Booth economics that vendors will accept',
        paragraphs: [
          'Vendors compare booth fees against expected foot traffic, category mix, and how hard you make it to apply and get paid. Transparent pricing, clear refund policies, and published dates reduce no-shows and support requests.',
        ],
        bullets: [
          'Publish booth sizes, fees, and what is included (table, power, tent requirement).',
          'Collect booth fees through a traceable checkout flow — not personal e-transfer requests in DMs.',
          'Pass platform fees to vendors at checkout if you want to keep 100% of your listed booth price.',
        ],
      },
      {
        heading: 'Replace admin chaos with one coordinator hub',
        paragraphs: [
          'Spreadsheets break when you add juried reviews, insurance documents, waitlists, and booth assignments. Popup Hub connects vendor applications, booth layout, patron discovery, and market-day check-in so your team is not rebuilding the same list every week.',
        ],
      },
      {
        heading: 'Drive patron discovery, not just vendor fill',
        paragraphs: [
          'A full vendor roster only matters if shoppers know who is attending. Publish confirmed vendor counts, booth maps, and maker profiles before market day so regulars can plan their route and new visitors have a reason to choose your event over scrolling Instagram.',
        ],
      },
    ],
    relatedLinks: [
      { href: '/for-organizers', label: 'Market organizer software' },
      { href: '/legal/guides/instagram-dms-to-dashboard', label: 'Move off Instagram DMs' },
      { href: '/discover', label: 'Discover markets' },
    ],
  },
  {
    slug: 'instagram-dms-to-dashboard',
    title: 'How to Move Your Market From Instagram DMs and Spreadsheets to a Professional Dashboard',
    description:
      'Step-by-step migration for market organizers still running vendor intake through DMs, Google Forms, and shared spreadsheets.',
    lastUpdated: 'June 27, 2026',
    audience: 'coordinators',
    keywords: [
      'replace Google Forms vendor applications',
      'market vendor spreadsheet',
      'Instagram DM vendor applications',
      'market management software Canada',
    ],
    sections: [
      {
        heading: 'Why DMs and spreadsheets fail at scale',
        paragraphs: [
          'Instagram DMs are great for community energy and terrible for audit trails. Vendor photos get buried, payment screenshots are hard to verify, and impersonation scams target organizers who collect booth fees through unofficial channels.',
          'Spreadsheets also fail silently — duplicate rows, broken formulas, and version conflicts show up on market morning when you need a booth map, not a debugging session.',
        ],
      },
      {
        heading: 'A 30-day migration plan',
        paragraphs: [
          'You do not need to rebuild your entire season overnight. Most coordinators can migrate in four weeks while keeping their existing social presence.',
        ],
        bullets: [
          'Week 1: Publish your next market on Popup Hub with categories, fees, and juried or open applications.',
          'Week 2: Link your official application URL from Instagram bio, Facebook group pinned post, and email signature.',
          'Week 3: Import returning vendors and stop accepting new applications via DM.',
          'Week 4: Publish your booth layout and patron map so shoppers see confirmed vendors before they arrive.',
        ],
      },
      {
        heading: 'What to tell vendors during the switch',
        paragraphs: [
          'Vendors tolerate change when it saves them time. Emphasize one reusable passport profile, HubGuard organizer verification, and a single place to track application status and booth payment.',
        ],
      },
    ],
    relatedLinks: [
      { href: '/for-organizers', label: 'Start hosting on Popup Hub' },
      { href: '/for-organizers/embed', label: 'Official application badges' },
      { href: '/legal/guides/safe-vendor-application-checklist', label: 'Safe application checklist' },
    ],
  },
  {
    slug: 'find-legit-vendor-applications',
    title: 'How to Find Legit Artisan Market Vendor Applications Near You',
    description:
      'Find real vendor calls in Canada, verify organizers before paying booth fees, and avoid impersonation scams on social media.',
    lastUpdated: 'June 27, 2026',
    audience: 'vendors',
    keywords: [
      'find artisan market vendor applications',
      'legit craft fair application',
      'vendor call near me',
      'HubGuard verify organizer',
    ],
    sections: [
      {
        heading: 'Search where applications actually live',
        paragraphs: [
          'Legitimate markets publish vendor calls on official websites, verified Popup Hub listings, or organizer pages with consistent branding — not random DMs from personal accounts.',
          'Start with city-specific searches like “Edmonton artisan market vendor application” or browse published markets on Popup Hub to see which events are accepting vendors right now.',
        ],
      },
      {
        heading: 'Verify before you pay booth fees',
        paragraphs: [
          'Scam reports are rising across Alberta and BC craft communities. Before sending money, search the organizer in HubGuard, confirm official website and social links, and match the payment instructions to the organizer’s verified profile.',
        ],
        bullets: [
          'Official emails should match the market brand — not generic Gmail accounts for payment requests.',
          'Never pay booth fees through social media DMs unless you have verified the organizer through an official channel.',
          'Read community mentions and scam alerts on the organizer’s HubGuard trust report.',
        ],
      },
      {
        heading: 'Apply once with a vendor passport',
        paragraphs: [
          'Popup Hub lets you build a reusable vendor passport — business details, categories, photos, and documents — so juried markets get consistent information without you retyping the same PDF every weekend.',
        ],
      },
    ],
    relatedLinks: [
      { href: '/for-vendors', label: 'Vendor passport' },
      { href: '/check', label: 'HubGuard organizer search' },
    ],
  },
  {
    slug: 'craft-fair-booth-fees-canada',
    title: 'Craft Fair Booth Fees in Canada: What Vendors Should Expect Before They Pay',
    description:
      'Typical booth fee ranges, what fees usually include, red flags to watch for, and how to verify payment requests before you send money.',
    lastUpdated: 'June 27, 2026',
    audience: 'vendors',
    keywords: [
      'craft fair booth fees Canada',
      'makers market booth cost',
      'vendor booth fee Alberta',
      'artisan market booth price',
    ],
    sections: [
      {
        heading: 'What booth fees usually cover',
        paragraphs: [
          'Booth fees vary by city, venue, season, and whether the market is juried or open. A community hall pop-up might charge $100–$200 for a 10×10 space; large holiday shows can cost significantly more for premium placement.',
        ],
        bullets: [
          'Indoor wall or centre booths vs outdoor tent spaces',
          'Table inclusion, power access, and load-in windows',
          'Juried curation, marketing reach, and insurance requirements',
          'Multi-day blocks vs single-day vending',
        ],
      },
      {
        heading: 'Red flags before you pay',
        paragraphs: [
          'Professional organizers send payment instructions through official channels after acceptance — not through unsolicited social messages. If anything feels off, pause and verify.',
        ],
        bullets: [
          'Payment requested before you receive a clear acceptance email',
          'Instructions that do not match the organizer’s official website',
          'Pressure to pay immediately via personal e-transfer with no receipt trail',
          'Application forms hosted on unrelated domains with no market branding',
        ],
      },
      {
        heading: 'Use HubGuard before you commit',
        paragraphs: [
          'Search the organizer on Popup Hub HubGuard to review official links, vendor mentions, and published scam alerts. Legitimate markets increasingly publish their official application URL to help vendors avoid impersonators.',
        ],
      },
    ],
    relatedLinks: [
      { href: '/check', label: 'Verify an organizer' },
      { href: '/legal/guides/find-legit-vendor-applications', label: 'Find legit applications' },
      { href: '/for-vendors', label: 'Create vendor passport' },
    ],
  },
  {
    slug: 'meet-the-makers-market-day',
    title: 'Meet the Makers: How to Plan a Market Day Around Local Artisans',
    description:
      'Plan a smarter market visit in Canada — browse confirmed vendors, follow makers, and use booth maps before you arrive.',
    lastUpdated: 'June 27, 2026',
    audience: 'patrons',
    keywords: [
      'meet local makers',
      'artisan market near me',
      'plan market day',
      'Passport Stories makers',
    ],
    sections: [
      {
        heading: 'Browse the lineup before you go',
        paragraphs: [
          'The best market days start at home. Popup Hub shows confirmed vendor counts and maker profiles for published markets so you can decide which booths to visit first — jewelry, ceramics, candles, food, or kids’ crafts.',
        ],
      },
      {
        heading: 'Use the map to plan your route',
        paragraphs: [
          'Open the patron map for your market to see booth numbers and vendor placement. Regulars save time; first-time visitors avoid wandering the full hall looking for one maker.',
        ],
      },
      {
        heading: 'Meet the maker with Passport Stories',
        paragraphs: [
          'Many vendors share short Passport Stories — quick introductions to their craft, process, and what they are bringing to market day. Follow makers you love so you know where to find them at the next pop-up.',
        ],
      },
    ],
    relatedLinks: [
      { href: '/discover', label: 'Discover markets' },
    ],
  },
  {
    slug: 'safe-vendor-application-checklist',
    title: 'Safe Vendor Application Checklist for Canadian Craft Fairs',
    description:
      'A shareable checklist for artisans, craft associations, and community blogs — verify official applications and avoid booth-fee scams.',
    lastUpdated: 'June 27, 2026',
    audience: 'vendors',
    keywords: [
      'vendor application scam checklist',
      'craft fair scam prevention',
      'verify market organizer',
      'official vendor application Canada',
    ],
    sections: [
      {
        heading: 'Before you apply',
        paragraphs: [
          'Use this checklist before submitting personal information or product photos to any market call.',
        ],
        bullets: [
          'Confirm the application URL matches the organizer’s official website or verified Popup Hub listing.',
          'Search the organizer in HubGuard for reviews, official links, and scam alerts.',
          'Check that social posts link back to the same official domain — not a look-alike page.',
          'Avoid applications that demand payment before you are accepted.',
        ],
      },
      {
        heading: 'Before you pay booth fees',
        paragraphs: [
          'Payment is where impersonation scams hurt vendors most. Slow down and verify.',
        ],
        bullets: [
          'Match payment instructions to the acceptance email from the verified organizer.',
          'Do not pay through personal social media DMs.',
          'Save receipts and note the market name, date, and booth assignment in writing.',
          'When in doubt, contact the organizer through their official website — not a DM reply thread.',
        ],
      },
      {
        heading: 'Share this checklist',
        paragraphs: [
          'Craft associations, libraries, maker spaces, and local news outlets are welcome to link to this page. Organizers running on Popup Hub can embed official application badges so vendors know which URL is real.',
        ],
      },
    ],
    relatedLinks: [
      { href: '/check', label: 'HubGuard search' },
      { href: '/for-organizers/embed', label: 'Embed official badges' },
      { href: '/for-vendors', label: 'Vendor passport' },
    ],
  },
]

export const SEO_GUIDE_SLUGS = SEO_GUIDES.map((guide) => guide.slug)

export function getSeoGuide(slug: string): SeoGuide | null {
  return SEO_GUIDES.find((guide) => guide.slug === slug) ?? null
}
