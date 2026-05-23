import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/** Notify vendor followers of sold-out or flash-sale product updates. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    product_id?: string
    alert_type?: 'sold_out' | 'flash_sale'
  }

  const { product_id, alert_type } = body
  if (!product_id || !alert_type) {
    return NextResponse.json({ error: 'product_id and alert_type required' }, { status: 400 })
  }

  const { data: product } = await supabase
    .from('vendor_products')
    .select('id, name, vendor_id')
    .eq('id', product_id)
    .eq('vendor_id', user.id)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data: followers } = await supabase
    .from('vendor_follows')
    .select('user_id')
    .eq('vendor_id', user.id)

  if (!followers || followers.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 })
  }

  const { data: vendorProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const vendorName = vendorProfile?.full_name ?? 'A vendor you follow'
  const message =
    alert_type === 'flash_sale'
      ? `${vendorName}: flash sale on ${product.name}!`
      : `${vendorName}: ${product.name} is sold out.`

  const service = await createServiceClient()
  const rows = followers.map((f) => ({
    user_id: f.user_id,
    type: alert_type === 'flash_sale' ? 'vendor_flash_sale' : 'vendor_sold_out',
    message,
    metadata: { vendor_id: user.id, product_id: product.id, product_name: product.name },
  }))

  await service.from('notifications').insert(rows)

  return NextResponse.json({ ok: true, notified: rows.length })
}
