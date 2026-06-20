import type { Metadata } from 'next'
import {
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  SITE_NAME,
  defaultOpenGraphImages,
  siteMetadataBase,
} from '@/lib/seo/site-config'
import { publicAppUrl } from '@/lib/url/public-app-url'

export function buildPublicMetadata({
  title,
  description,
  path,
  imageUrl,
  type = 'website',
  noIndex = false,
  keywords,
}: {
  title: string
  description: string
  path: string
  imageUrl?: string | null
  type?: 'website' | 'article'
  noIndex?: boolean
  keywords?: string[]
}): Metadata {
  const url = publicAppUrl(path)
  const imagePath = imageUrl?.trim() || DEFAULT_OG_IMAGE_PATH
  const image = imagePath.startsWith('http') ? imagePath : publicAppUrl(imagePath)
  const isDefaultOg = !imageUrl?.trim() || imagePath === DEFAULT_OG_IMAGE_PATH
  const resolvedKeywords = keywords ?? DEFAULT_KEYWORDS
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()

  return {
    metadataBase: siteMetadataBase(),
    title,
    description,
    keywords: resolvedKeywords,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    ...(googleVerification
      ? { verification: { google: googleVerification } }
      : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
      locale: 'en_CA',
      images: [
        {
          url: image,
          alt: title,
          ...(isDefaultOg
            ? { width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT }
            : {}),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

/** Root layout defaults — role-specific title applied in `generateMetadata`. */
export const rootLayoutMetadata: Omit<Metadata, 'title'> = {
  metadataBase: siteMetadataBase(),
  description: DEFAULT_SITE_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_CA',
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: defaultOpenGraphImages(SITE_NAME),
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
  },
}

export function buildPrivatePortalMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  }
}
