import { NextResponse } from 'next/server'
import { validateSquareWebhook } from '@/lib/square/webhook'
import { createServiceClient } from '@/lib/supabase/server'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-square-hmacsha256-signature') ?? ''
  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/square/webhook`

  if (!validateSquareWebhook(rawBody, signature, notificationUrl)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const event = JSON.parse(rawBody)
  const eventType: string = event.type ?? ''

  switch (eventType) {
    case 'payment.completed': {
      const payment = event.data?.object?.payment
      if (!payment) break

      const squarePaymentId: string = payment.id
      const amountCents = Number(payment.amount_money?.amount ?? 0)

      const { data: application } = await supabase
        .from('booth_applications')
        .select(`
          id,
          event_id,
          vendor_id,
          category_id,
          event:events(
            coordinator_id,
            platform_fee_mode,
            platform_fee_flat_cents,
            platform_fee_bps
          )
        `)
        .eq('square_payment_id', squarePaymentId)
        .maybeSingle()

      if (application) {
        const eventRow = Array.isArray(application.event)
          ? application.event[0]
          : application.event

        const feeConfig = resolveEventFeeConfig(eventRow)
        const platformFeeCents = computePlatformFeeCents(amountCents || 0, feeConfig)

        await recordPlatformTransaction(supabase, {
          boothApplicationId: application.id,
          eventId: application.event_id,
          vendorId: application.vendor_id,
          coordinatorId: eventRow?.coordinator_id ?? '',
          categoryId: application.category_id,
          totalAmountCents: amountCents,
          platformFeeCents,
          feeModeUsed: feeConfig.mode,
          processorChargeId: squarePaymentId,
          status: 'completed',
        })
      } else {
        await supabase
          .from('booth_applications')
          .update({ payment_status: 'paid', square_payment_id: squarePaymentId })
          .eq('square_payment_id', squarePaymentId)
      }

      const { data: wtx } = await supabase
        .from('wallet_transactions')
        .select('id, wallet_id, amount')
        .eq('square_payment_id', squarePaymentId)
        .eq('type', 'deposit')
        .maybeSingle()

      if (wtx) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', wtx.wallet_id)
          .single()

        if (wallet) {
          await supabase
            .from('wallets')
            .update({ balance: wallet.balance + wtx.amount })
            .eq('id', wtx.wallet_id)
        }
      }

      console.log(`[Square webhook] payment.completed: ${squarePaymentId}`)
      break
    }

    case 'payment.failed': {
      const payment = event.data?.object?.payment
      if (!payment) break

      await supabase
        .from('booth_applications')
        .update({ payment_status: 'unpaid' })
        .eq('square_payment_id', payment.id)

      await supabase
        .from('platform_transactions')
        .update({ status: 'failed' })
        .eq('processor_charge_id', payment.id)

      break
    }

    case 'refund.completed': {
      const refund = event.data?.object?.refund
      if (!refund) break

      await supabase
        .from('booth_applications')
        .update({ payment_status: 'refunded' })
        .eq('square_payment_id', refund.payment_id)

      await supabase
        .from('platform_transactions')
        .update({ status: 'refunded' })
        .eq('processor_charge_id', refund.payment_id)

      await supabase
        .from('refund_exceptions')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('square_payment_id', refund.payment_id)

      break
    }

    case 'refund.failed': {
      const refund = event.data?.object?.refund
      if (!refund?.payment_id) break

      await supabase
        .from('refund_exceptions')
        .update({
          status: 'pending_retry',
          error_message: refund.status ?? 'Square refund failed',
          last_retry_at: new Date().toISOString(),
        })
        .eq('square_payment_id', refund.payment_id)

      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
