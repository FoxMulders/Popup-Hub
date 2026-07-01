import { ImageResponse } from 'next/og'
import { OgImageCard, OG_IMAGE_SIZE } from '@/lib/seo/og-image-template'

export const alt = 'Discover Local Makers Markets'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <OgImageCard
        title="Discover local makers markets"
        subtitle="Browse confirmed vendors, apply with one passport, and run market day from one hub — built in Canada."
      />
    ),
    { ...size },
  )
}
