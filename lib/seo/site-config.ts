import type { Metadata } from 'next'
import { resolvePublicAppOrigin } from '@/lib/url/public-app-url'

export const SITE_NAME = 'Popup Hub'

export const DEFAULT_SITE_TITLE = 'Popup Hub — Discover Local Makers Markets'

export const DEFAULT_SITE_DESCRIPTION =
  'Discover local pop-up markets, browse confirmed vendors before you go, and run booth layout and day-of operations with Popup Hub.'

export const DEFAULT_KEYWORDS = [
  'popup market',
  'makers market',
  'farmers market',
  'vendor market',
  'local markets Canada',
  'market coordinator',
  'booth layout',
  'quarter auction',
]

export const DEFAULT_OG_IMAGE_PATH = '/icons/icon-512x512.png'

export const ORGANIZATION = {
  name: SITE_NAME,
  legalName: 'Popup Hub',
  url: resolvePublicAppOrigin(),
  logoPath: DEFAULT_OG_IMAGE_PATH,
  sameAs: [] as string[],
}

export function siteMetadataBase(): Metadata['metadataBase'] {
  return new URL(resolvePublicAppOrigin())
}

export function defaultOpenGraphImages(title: string) {
  const image = DEFAULT_OG_IMAGE_PATH
  return [{ url: image, width: 512, height: 512, alt: title }]
}
