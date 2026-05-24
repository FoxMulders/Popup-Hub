import type { Metadata } from 'next'
import { publicAppUrl } from '@/lib/url/public-app-url'

const SITE_NAME = 'Popup Hub'
const DEFAULT_OG_IMAGE = publicAppUrl('/icons/icon-512x512.png')

export function buildPublicMetadata({
  title,
  description,
  path,
  imageUrl,
  type = 'website',
}: {
  title: string
  description: string
  path: string
  imageUrl?: string | null
  type?: 'website' | 'article'
}): Metadata {
  const url = publicAppUrl(path)
  const image = imageUrl?.trim() ? imageUrl : DEFAULT_OG_IMAGE

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
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
