import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintTrigger } from '../print-trigger'
import { PrintFloorplan } from '@/components/coordinator/print-floorplan'
import { getActiveRoom, roomsFromBoothLayout } from '@/lib/booth-planner/layout-rooms'
import type { BoothLayout } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PrintLayoutPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, coordinator_id')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()

  const { data: layoutRow } = await supabase
    .from('booth_layouts')
    .select('*')
    .eq('event_id', id)
    .maybeSingle()

  if (!layoutRow) notFound()

  const layout = layoutRow as BoothLayout
  const { rooms, activeRoomId } = roomsFromBoothLayout(layout)
  const active = getActiveRoom(rooms, activeRoomId)
  const printLayout: BoothLayout = {
    ...layout,
    venue_width: active.venue_width,
    venue_length: active.venue_length,
    booth_width: active.booth_width,
    booth_length: active.booth_length,
    entrance: active.entrance,
    spacing_mode: active.spacing_mode,
    cells: active.cells,
    venue_elements: active.venue_elements,
  }

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          nav, header, footer, .no-print { display: none !important; }
          body { margin: 0; background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-floorplan { padding: 0.25in; }
        }
        body { background: #fff; color: #000; }
      `}</style>
      <div className="max-w-[100vw] overflow-x-auto px-6 py-8 print:p-0">
        <PrintFloorplan layout={printLayout} eventName={event.name} roomName={active.name} />
      </div>
    </>
  )
}
