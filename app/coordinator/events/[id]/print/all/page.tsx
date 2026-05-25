import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintTrigger } from '../print-trigger'
import { PrintFloorplan } from '@/components/coordinator/print-floorplan'
import { getActiveRoom, roomsFromBoothLayout } from '@/lib/booth-planner/layout-rooms'
import type { BoothLayout } from '@/types/database'
import { extractNestedPassport } from '@/lib/applications/extract-nested-passport'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PrintAllPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, location_name, address, start_at, end_at, coordinator_id')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()

  const [{ data: applications }, { data: layoutRow }] = await Promise.all([
    supabase
      .from('booth_applications')
      .select(`
        id,
        booth_number,
        checked_in,
        vendor:profiles!booth_applications_vendor_id_fkey(
          full_name,
          phone,
          passport:vendor_passports(business_name)
        ),
        category:categories(name)
      `)
      .eq('event_id', id)
      .eq('status', 'approved')
      .order('booth_number', { ascending: true, nullsFirst: false }),
    supabase.from('booth_layouts').select('*').eq('event_id', id).maybeSingle(),
  ])

  const rows = (applications ?? []).map((a) => ({
    id: a.id,
    booth_number: a.booth_number,
    checked_in: a.checked_in ?? false,
    vendor: Array.isArray(a.vendor) ? a.vendor[0] : a.vendor,
    passport: extractNestedPassport(a),
    category: Array.isArray(a.category) ? (a.category[0] ?? null) : a.category,
  }))

  const startDate = new Date(event.start_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let printLayout: BoothLayout | null = null
  let roomName: string | undefined
  if (layoutRow) {
    const layout = layoutRow as BoothLayout
    const { rooms, activeRoomId } = roomsFromBoothLayout(layout)
    const active = getActiveRoom(rooms, activeRoomId)
    roomName = active.name
    printLayout = {
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
  }

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          nav, header, footer, .no-print, .print\\:hidden { display: none !important; }
          body { margin: 0; background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-page { padding: 0.35in; }
          .print-floorplan { page-break-before: always; }
        }
        body { background: #fff; color: #000; font-family: system-ui, sans-serif; }
      `}</style>

      <div className="print-page max-w-5xl mx-auto px-6 py-8 print:p-0">
        <article className="mb-8 border-b-2 border-black pb-4">
          <h1 className="font-heading text-2xl font-bold text-black">{event.name}</h1>
          <p className="text-sm text-black mt-1">{startDate}</p>
          <p className="text-sm text-black">{event.location_name} — {event.address}</p>
          <p className="text-sm text-black mt-2">
            Approved vendors: {rows.length} · Printed {new Date().toLocaleString()}
          </p>
        </article>

        <section aria-label="Vendor roster">
          <h2 className="font-heading text-lg font-semibold text-black mb-3">Vendor Roster</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border border-black px-3 py-2 text-left font-semibold w-16">Booth #</th>
                <th className="border border-black px-3 py-2 text-left font-semibold">Vendor</th>
                <th className="border border-black px-3 py-2 text-left font-semibold">Business</th>
                <th className="border border-black px-3 py-2 text-left font-semibold">Category</th>
                <th className="border border-black px-3 py-2 text-left font-semibold">Phone</th>
                <th className="border border-black px-3 py-2 text-center font-semibold w-24">Check-In</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-black px-3 py-4 text-center">
                    No approved vendors yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-black px-3 py-2 text-center font-medium">
                      {row.booth_number ?? '—'}
                    </td>
                    <td className="border border-black px-3 py-2">{row.vendor?.full_name ?? '—'}</td>
                    <td className="border border-black px-3 py-2">{row.passport?.business_name ?? '—'}</td>
                    <td className="border border-black px-3 py-2">{row.category?.name ?? '—'}</td>
                    <td className="border border-black px-3 py-2">{row.vendor?.phone ?? '—'}</td>
                    <td className="border border-black px-3 py-2 text-center">
                      <span className="inline-block h-4 w-4 border-2 border-black" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {printLayout ? (
          <section className="print-floorplan mt-10" aria-label="Floorplan">
            <PrintFloorplan layout={printLayout} eventName={event.name} roomName={roomName} />
          </section>
        ) : null}
      </div>
    </>
  )
}
