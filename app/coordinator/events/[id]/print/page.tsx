import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintTrigger } from './print-trigger'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PrintRosterPage({ params }: Props) {
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

  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      id,
      booth_number,
      checked_in,
      vendor:profiles(full_name, phone),
      passport:vendor_passports(business_name),
      category:categories(name)
    `)
    .eq('event_id', id)
    .eq('status', 'approved')
    .order('booth_number', { ascending: true, nullsFirst: false })

  const rows = (applications ?? []).map((a) => ({
    id: a.id,
    booth_number: a.booth_number,
    checked_in: a.checked_in ?? false,
    vendor: Array.isArray(a.vendor) ? a.vendor[0] : a.vendor,
    passport: Array.isArray(a.passport) ? (a.passport[0] ?? null) : a.passport,
    category: Array.isArray(a.category) ? (a.category[0] ?? null) : a.category,
  }))

  const startDate = new Date(event.start_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          nav, header, footer, .no-print { display: none !important; }
          body { margin: 0; font-family: sans-serif; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
        body { font-family: system-ui, sans-serif; }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 py-8 print:p-4">
        {/* Header */}
        <div className="mb-6 border-b pb-4">
          <h1 className="font-heading text-2xl font-semibold text-foreground">{event.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{startDate}</p>
          <p className="text-sm text-muted-foreground">{event.location_name} — {event.address}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Approved vendors: {rows.length} &nbsp;|&nbsp;
            Printed: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Roster table */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-canvas">
              <th className="border border-stone-300 px-3 py-2 text-left font-semibold w-16">Booth #</th>
              <th className="border border-stone-300 px-3 py-2 text-left font-semibold">Vendor Name</th>
              <th className="border border-stone-300 px-3 py-2 text-left font-semibold">Business Name</th>
              <th className="border border-stone-300 px-3 py-2 text-left font-semibold">Category</th>
              <th className="border border-stone-300 px-3 py-2 text-left font-semibold">Phone</th>
              <th className="border border-stone-300 px-3 py-2 text-center font-semibold w-24">Checked In</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-stone-300 px-3 py-4 text-center text-muted-foreground">
                  No approved vendors yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="even:bg-canvas/50">
                  <td className="border border-stone-300 px-3 py-2 text-center font-medium">
                    {row.booth_number ?? '—'}
                  </td>
                  <td className="border border-stone-300 px-3 py-2">
                    {row.vendor?.full_name ?? '—'}
                  </td>
                  <td className="border border-stone-300 px-3 py-2">
                    {row.passport?.business_name ?? '—'}
                  </td>
                  <td className="border border-stone-300 px-3 py-2">
                    {row.category?.name ?? '—'}
                  </td>
                  <td className="border border-stone-300 px-3 py-2">
                    {row.vendor?.phone ?? '—'}
                  </td>
                  <td className="border border-stone-300 px-3 py-2 text-center">
                    <span className="inline-block h-4 w-4 border-2 border-gray-400 rounded" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
