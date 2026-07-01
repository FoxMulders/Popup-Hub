import { ImageResponse } from 'next/og'
import { OgImageCard, OG_IMAGE_SIZE } from '@/lib/seo/og-image-template'
import { getMarketCitySeoPage } from '@/lib/seo/market-city-pages'

export const alt = 'Local makers markets on Popup Hub'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

type Props = {
  params: Promise<{ city: string }>
}

export default async function MarketCityOpenGraphImage({ params }: Props) {
  const { city: citySlug } = await params
  const city = getMarketCitySeoPage(citySlug)
  const title = city?.headline ?? 'Discover local makers markets'
  const subtitle =
    city?.description ??
    'Find upcoming pop-up and makers markets — see confirmed vendors before you go.'

  return new ImageResponse(
    <OgImageCard eyebrow="Popup Hub · Markets" title={title} subtitle={subtitle} />,
    { ...size },
  )
}
