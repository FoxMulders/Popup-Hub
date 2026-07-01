import { ImageResponse } from 'next/og'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { OgImageCard, OG_IMAGE_SIZE } from '@/lib/seo/og-image-template'

export const alt = 'Market event on Popup Hub'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EventOpenGraphImage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('name, location_name, start_at, city, market_city')
    .eq('id', id)
    .in('status', ['published', 'active', 'completed'])
    .maybeSingle()

  const name = event?.name?.trim() || 'Local makers market'
  const dateLabel = event?.start_at
    ? format(new Date(event.start_at), 'EEE, MMM d, yyyy')
    : null
  const place =
    event?.location_name?.trim() ||
    event?.city?.trim() ||
    event?.market_city?.trim() ||
    null
  const subtitle = [place, dateLabel].filter(Boolean).join(' · ') || 'Browse confirmed vendors on Popup Hub'

  return new ImageResponse(
    <OgImageCard eyebrow="Popup Hub · Market" title={name} subtitle={subtitle} />,
    { ...size },
  )
}
