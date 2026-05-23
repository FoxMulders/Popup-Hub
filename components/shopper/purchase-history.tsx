import { createClient } from '@/lib/supabase/server'
import { formatCents } from '@/lib/square/client'
import { format } from 'date-fns'
import type { ShopperPurchase } from '@/types/database'

export async function PurchaseHistory({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: purchases } = await supabase
    .from('shopper_purchases')
    .select('*, vendor:profiles!shopper_purchases_vendor_id_fkey(full_name), event:events(name)')
    .eq('shopper_id', userId)
    .order('purchased_at', { ascending: false })
    .limit(20)

  if (!purchases || purchases.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <h3 className="font-semibold text-gray-900">Purchase history</h3>
        <p className="mt-2 text-sm text-gray-500">
          Digital receipts from vendor booth purchases will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Purchase history</h3>
      <ul className="space-y-3">
        {(purchases as ShopperPurchase[]).map((p) => {
          const vendor = (p as ShopperPurchase & { vendor?: { full_name: string } }).vendor
          const event = (p as ShopperPurchase & { event?: { name: string } | null }).event
          return (
            <li key={p.id} className="flex justify-between gap-3 border-b pb-3 text-sm last:border-0">
              <div>
                <p className="font-medium">{p.description ?? 'Market purchase'}</p>
                <p className="text-xs text-gray-500">
                  {vendor?.full_name}
                  {event?.name ? ` · ${event.name}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{formatCents(p.amount_cents)}</p>
                <p className="text-xs text-gray-400">
                  {format(new Date(p.purchased_at), 'MMM d, yyyy')}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
