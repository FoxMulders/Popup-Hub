import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PublicFloorplan } from '@/components/shopper/public-floorplan'
import { ArrowLeft } from 'lucide-react'
import type { BoothLayout } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ booth?: string }>
}

export default async function EventMapPage({ params, searchParams }: Props) {
  const { id } = await params
  const { booth } = await searchParams
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, name')
    .eq('id', id)
    .in('status', ['published', 'active', 'completed'])
    .single()

  if (!event) notFound()

  const { data: layoutRow } = await supabase
    .from('booth_layouts')
    .select('*')
    .eq('event_id', id)
    .maybeSingle()

  if (!layoutRow) notFound()

  const highlightBooth = booth ? parseInt(booth, 10) : null

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 pb-28">
      <Link
        href={`/events/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {event.name}
      </Link>
      <h1 className="font-heading text-xl font-semibold">Venue map</h1>
      <p className="text-sm text-muted-foreground">
        Search vendors, tap a booth, or follow a route through the market.
      </p>
      <PublicFloorplan
        layout={layoutRow as BoothLayout}
        highlightBoothNumber={Number.isFinite(highlightBooth) ? highlightBooth : null}
        mode="patron"
      />
    </div>
  )
}
