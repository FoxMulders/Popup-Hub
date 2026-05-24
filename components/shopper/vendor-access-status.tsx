import { createClient } from '@/lib/supabase/server'
import { accessRequestStatusLabel } from '@/lib/vendor/access'
import Link from 'next/link'

export async function VendorAccessStatus({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: requests } = await supabase
    .from('vendor_access_requests')
    .select('*, coordinator:profiles!vendor_access_requests_coordinator_id_fkey(full_name)')
    .eq('shopper_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!requests || requests.length === 0) return null

  return (
    <div className="rounded-2xl border bg-white p-6">
      <h3 className="font-semibold text-foreground mb-3">Vendor access requests</h3>
      <ul className="space-y-2 text-sm">
        {requests.map((request) => {
          const coordinator = Array.isArray(request.coordinator)
            ? request.coordinator[0]
            : request.coordinator
          return (
            <li key={request.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
              <span>{coordinator?.full_name ?? 'Organizer'}</span>
              <span className="text-muted-foreground">{accessRequestStatusLabel(request.status)}</span>
            </li>
          )
        })}
      </ul>
      <Link href="/discover" className="mt-3 inline-block text-xs font-semibold text-forest hover:underline">
        Browse organizers
      </Link>
    </div>
  )
}
