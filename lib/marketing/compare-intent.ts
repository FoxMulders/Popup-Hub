/** Public marketing comparison page — intent vs impressions. */
export const COMPARE_INTENT_HREF = '/compare'

export const COMPARE_INTENT_HEADER = {
  title: '🪧 Street Signs vs. 📱 Social Feeds vs. 🎪 The App in Their Pocket',
  subtitle:
    "Every event coordinator asks the same question: 'How do I guarantee feet on the ground?' Before you spend another dollar on generic marketing or waste hours updating 'free' forums, look at the structural reality of where your ad budget and time actually go.",
} as const

export interface ComparisonChannel {
  id: 'street-signs' | 'social-media' | 'popuphub'
  label: string
  body: string
  isPremium?: boolean
}

export interface ComparisonPillar {
  id: string
  title: string
  channels: ComparisonChannel[]
}

export const COMPARE_INTENT_PILLARS: ComparisonPillar[] = [
  {
    id: 'visibility-gap',
    title: '1. The Visibility Gap (Where do eyes go?)',
    channels: [
      {
        id: 'street-signs',
        label: 'Street Signs',
        body: 'Relies entirely on passive commuters glancing away from the road for 2 seconds. Zero tracking, zero intent, weather-dependent.',
      },
      {
        id: 'social-media',
        label: 'Social Media',
        body: 'Puts your event in a chaotic, algorithm-driven feed between political rants and viral videos. You are paying for "impressions," not attention.',
      },
      {
        id: 'popuphub',
        label: 'PopupHub App',
        body: 'Sits directly on a smartphone screen inside an ecosystem built for one exclusive purpose: finding local markets. In-app native ads yield double the click-through rate (0.56% CTR) of standard mobile web placements.',
        isPremium: true,
      },
    ],
  },
  {
    id: 'intent-filter',
    title: '2. The Intent Filter (Who is looking?)',
    channels: [
      {
        id: 'street-signs',
        label: 'Street Signs & Social',
        body: 'Broad, low-intent targeting. You waste budget showing your artisan market to people who only shop at big-box retail.',
      },
      {
        id: 'popuphub',
        label: 'PopupHub App',
        body: 'Pure, high-intent hyperlocal traffic. 82% of consumers utilize "near me" local discovery apps to make immediate purchasing decisions. Our users open the app because they are actively looking to visit a market today.',
        isPremium: true,
      },
    ],
  },
  {
    id: 'friction-point',
    title: '3. The Friction Point (How do they act?)',
    channels: [
      {
        id: 'street-signs',
        label: 'Street Signs',
        body: 'High friction. A patron must memorize your dates, cross-streets, and URL while driving past.',
      },
      {
        id: 'social-media',
        label: 'Social Media',
        body: 'Medium friction. They click a link, wait for an external browser to load, and usually drop off before signing up.',
      },
      {
        id: 'popuphub',
        label: 'PopupHub App',
        body: 'Zero friction. Patrons have live maps, automatic push notifications, and neighborhood event tracking directly on them. Hyperlocal app positioning delivers a massive 157% increase in real-world foot-traffic conversion compared to broad digital ads.',
        isPremium: true,
      },
    ],
  },
]

export const COMPARE_INTENT_OBJECTION = {
  heading: "🤔 'But I can already list my event for free elsewhere...'",
  subCopy:
    "It is easy to confuse hosting a webpage with driving targeted traffic. Here is what happens when you rely strictly on 'free' channels:",
  items: [
    {
      id: 'own-website',
      label: 'Your Own Website',
      body: 'You are on a desert island. You are only reaching people who already know your name. It does nothing to find the new weekend shoppers or traveling artisans you need to scale.',
    },
    {
      id: 'general-calendars',
      label: 'General Event Calendars',
      body: 'Your market gets buried under corporate webinars, garage sales, and concert listings. You are fighting for attention in an ocean of noise. Niche marketplaces outperform general directories by over 380% in actual conversion rates because general traffic lacks specific intent.',
    },
  ],
  footerCallout: "PopupHub isn't a general directory; it's a dedicated local market ecosystem.",
} as const

export const COMPARE_INTENT_CTA = {
  title: '🛑 STOP PAYING FOR IMPRESSIONS. START BUYING INTENT.',
  body: "Street signs get missed. Social media algorithms force you to pay just to reach a fraction of your target audience. 'Free' listings cost you hundreds of attendees in lost foot traffic. Whether you are promoting an external landing page or boosting a regional event category, PopupHub places your market directly on the screens of dedicated local patrons who carry our app for one specific reason: to show up, support local, and buy from organizers like you.",
} as const
