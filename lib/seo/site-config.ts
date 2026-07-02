import type { Metadata } from 'next'
import { resolvePublicAppOrigin, PRODUCTION_CANONICAL_ORIGIN } from '@/lib/url/public-app-url'

export { PRODUCTION_CANONICAL_ORIGIN }

export const SITE_NAME = 'Popup Hub'

/** Homepage default title — layout template appends "| Popup Hub" on child pages. */
export const DEFAULT_SITE_TITLE = 'Discover Local Makers Markets'

export const DEFAULT_SITE_DESCRIPTION =
  'Discover local pop-up markets across Canada, browse confirmed vendors before you go, and run booth layout and day-of operations with Popup Hub.'

export const COMPARE_PAGE_TITLE = 'Intent vs. Impressions: Market Marketing Comparison'

export const COMPARE_PAGE_DESCRIPTION =
  'Street signs, social feeds, and free listings vs. PopupHub — a structural breakdown for event coordinators on where marketing budget actually drives foot traffic.'

export const ORGANIZERS_PAGE_TITLE = 'Market Organizer Software'

export const ORGANIZERS_PAGE_DESCRIPTION =
  'Run pop-up and makers markets from one hub — vendor applications, booth layouts, check-in, payouts, and patron discovery. Built by market operators in Canada.'

export const VENDORS_PAGE_TITLE = 'Vendor Market Application'

export const ABOUT_PAGE_TITLE = 'About Popup Hub'

export const CONTACT_PAGE_TITLE = 'Contact Popup Hub'

export const CONTACT_PAGE_DESCRIPTION =
  'Get in touch with the Popup Hub team — questions about markets, vendor applications, or organizer tools.'

export const TWITTER_SITE = process.env.NEXT_PUBLIC_TWITTER_SITE?.trim()

export const TWITTER_CREATOR = process.env.NEXT_PUBLIC_TWITTER_CREATOR?.trim()

export const VENDORS_PAGE_DESCRIPTION =
  'Apply to pop-up and makers markets with one vendor passport. Browse open listings, verify organizers with HubGuard, and pay booth fees securely — free to join.'

export const DEFAULT_KEYWORDS = [
  'popup market',
  'makers market',
  'farmers market',
  'vendor market',
  'local markets Canada',
  'market organizer',
  'market coordinator',
  'market management software',
  'popup market software',
  'vendor market software',
  'booth layout',
  'quarter auction',
]

export const DEFAULT_OG_IMAGE_PATH = '/opengraph-image'

export const DEFAULT_OG_IMAGE_WIDTH = 1200

export const DEFAULT_OG_IMAGE_HEIGHT = 630

function resolveOrganizationSameAs(): string[] {
  const configured = process.env.NEXT_PUBLIC_ORG_SOCIAL_URLS?.trim()
  const fromEnv =
    configured?.split(',').map((url) => url.trim()).filter(Boolean) ?? []
  const base = [resolvePublicAppOrigin()]
  return [...new Set([...base, ...fromEnv])]
}

export const ORGANIZATION = {
  name: SITE_NAME,
  legalName: 'Popup Hub',
  url: resolvePublicAppOrigin(),
  logoPath: '/icons/icon-512x512.png',
  get sameAs() {
    return resolveOrganizationSameAs()
  },
}

export function siteMetadataBase(): Metadata['metadataBase'] {
  return new URL(resolvePublicAppOrigin())
}

export function defaultOpenGraphImages(title: string) {
  const image = DEFAULT_OG_IMAGE_PATH
  return [
    {
      url: image,
      width: DEFAULT_OG_IMAGE_WIDTH,
      height: DEFAULT_OG_IMAGE_HEIGHT,
      alt: title,
    },
  ]
}
