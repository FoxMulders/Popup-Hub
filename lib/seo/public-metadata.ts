import type { Metadata } from 'next'
import {
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_SITE_DESCRIPTION,
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
}: {
  title: string
  description: string
  path: string
  imageUrl?: string | null
  type?: 'website' | 'article'
  noIndex?: boolean
}): Metadata {
  const url = publicAppUrl(path)
  const imagePath = imageUrl?.trim() || DEFAULT_OG_IMAGE_PATH
  const image = imagePath.startsWith('http') ? imagePath : publicAppUrl(imagePath)

  return {
    metadataBase: siteMetadataBase(),
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
      locale: 'en_CA',
      images: [{ url: image, alt: title }],
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
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_CA',
    images: defaultOpenGraphImages(SITE_NAME),
  },
  twitter: {
    card: 'summary_large_image',
  },
}
