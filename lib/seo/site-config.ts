import type { Metadata } from 'next'
import { resolvePublicAppOrigin, PRODUCTION_CANONICAL_ORIGIN } from '@/lib/url/public-app-url'

export { PRODUCTION_CANONICAL_ORIGIN }

export const SITE_NAME = 'Popup Hub'

export const DEFAULT_SITE_TITLE = 'Popup Hub — Discover Local Makers Markets'

export const DEFAULT_SITE_DESCRIPTION =
  'Discover local pop-up markets across Canada, browse confirmed vendors before you go, and run booth layout and day-of operations with Popup Hub.'

export const ORGANIZERS_PAGE_TITLE =
  'Market Organizer Software — Popup Hub'

export const ORGANIZERS_PAGE_DESCRIPTION =
  'Run pop-up and makers markets from one hub — vendor applications, booth layouts, check-in, payouts, and patron discovery. Built by market operators in Canada.'

export const VENDORS_PAGE_TITLE = 'Vendor Market Application — Popup Hub'

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
