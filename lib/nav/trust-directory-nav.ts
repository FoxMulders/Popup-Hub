export const TRUST_DIRECTORY_LINKS = {
  check: {
    href: '/check',
    /** Page title and in-product name */
    label: 'Canopy',
    /** Shorter nav/menu label — full product name stays on `/check` */
    navLabel: 'Check organizers',
    tagline: 'Popup Hub security & fraud prevention',
    ctaOpen: 'Open Canopy',
    /** Hero / callout headline — always name Canopy explicitly */
    boothFeeHeadline: 'Before you pay for a booth, use Canopy to check the organizer',
  },
  review: { href: '/check/review', label: 'Review an organizer' },
} as const
