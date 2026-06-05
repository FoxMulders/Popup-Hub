import type { Metadata } from 'next'
import { resolvePublicAppOrigin } from '@/lib/url/public-app-url'

export const SITE_NAME = 'Popup Hub'

export const DEFAULT_SITE_DESCRIPTION =
  'Discover local markets, manage vendor booths, and run digital quarter auctions with Popup Hub.'

export const DEFAULT_OG_IMAGE_PATH = '/icons/icon-512x512.png'

export function siteMetadataBase(): Metadata['metadataBase'] {
  return new URL(resolvePublicAppOrigin())
}

export function defaultOpenGraphImages(title: string) {
  const image = DEFAULT_OG_IMAGE_PATH
  return [{ url: image, width: 512, height: 512, alt: title }]
}
