import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { suspendVendorForPaymentDispute } from '@/lib/vendor/fraud-actions'

/**
 * Dev-only helper to simulate Square dispute webhooks.
 * POST { applicationId, signal?: 'payment.disputed' | 'refund.completed' | 'payment.failed' }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const body = (await request.json()) as {
    applicationId?: string
    signal?: 'payment.disputed' | 'refund.completed' | 'payment.failed' | 'dispute.created'
  }

  if (!body.applicationId) {
    return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const { data: application } = await supabase
    .from('booth_applications')
    .select('id, event_id, vendor_id')
    .eq('id', body.applicationId)
    .maybeSingle()

  if (!application?.vendor_id || !application.event_id) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const result = await suspendVendorForPaymentDispute(supabase, {
    vendorId: application.vendor_id,
    eventId: application.event_id,
    applicationId: application.id,
    signal: body.signal ?? 'payment.disputed',
    processorReference: `mock-${Date.now()}`,
  })

  return NextResponse.json({ ok: true, ...result })
}
