/** Pre-signup copy — what vendors need before their first application. */
export const VENDOR_PASSPORT_SIGNUP_PREVIEW = {
  title: 'Your vendor passport — apply once, reuse everywhere',
  steps: [
    {
      title: 'Build your passport',
      detail: 'Business name and at least one product category — takes about five minutes.',
    },
    {
      title: 'Browse open markets',
      detail: 'See juried and instant-book listings near you — no duplicate PDFs per market.',
    },
    {
      title: 'Apply and pay booth fees',
      detail: 'Organizers review juried markets; insurance or photos may be requested per event.',
    },
  ],
  required: ['Business name', 'Product category'],
  oftenRequested: ['Product photos', 'Insurance certificate', 'HubGuard organizer check'],
} as const

export const VENDOR_OPEN_MARKETS_HREF = '/discover'
