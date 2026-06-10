import { NextResponse } from 'next/server'
import { validateSquareWebhook } from '@/lib/square/webhook'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import { resolveBoothCheckoutFromApplication } from '@/lib/monetization/resolve-booth-checkout'
import { applyWalletDepositCredit, isDepositBalanceApplied } from '@/lib/wallet/adjust-balance'
import { suspendVendorForPaymentDispute } from '@/lib/vendor/fraud-actions'

async function handlePaymentDispute(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  paymentId: string,
  signal: 'payment.disputed' | 'dispute.created' | 'payment.failed' | 'refund.completed'
) {
  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      event_id,
      vendor_id,
      status,
      event:events(coordinator_id)
    `)
    .eq('square_payment_id', paymentId)
    .maybeSingle()

  if (!application?.vendor_id || !application.event_id) return

  const eventRow = Array.isArray(application.event)
    ? application.event[0]
    : application.event

  await suspendVendorForPaymentDispute(supabase, {
    vendorId: application.vendor_id,
    eventId: application.event_id,
    applicationId: application.id,
    signal,
    processorReference: paymentId,
    actorId: eventRow?.coordinator_id ?? null,
  })
}

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
          payment_status,
          table_count,
          event:events(
            coordinator_id,
            listing_type,
            booth_price_cents,
            multi_table_discount_percent,
            platform_fee_mode,
            platform_fee_flat_cents,
            platform_fee_bps,
            pass_fees_to_vendor,
            end_at
          )
        `)
        .eq('square_payment_id', squarePaymentId)
        .maybeSingle()

      if (application) {
        if (application.payment_status === 'paid') {
          console.log(`[Square webhook] payment.completed already settled: ${squarePaymentId}`)
          break
        }

        const eventRow = Array.isArray(application.event)
          ? application.event[0]
          : application.event

        const { data: limit } = await supabase
          .from('event_category_limits')
          .select('price_per_booth')
          .eq('event_id', application.event_id)
          .eq('category_id', application.category_id)
          .maybeSingle()

        const checkout = await resolveBoothCheckoutFromApplication(supabase, {
          pricePerBooth: limit?.price_per_booth,
          tableCount: application.table_count ?? 1,
          eventRow,
          coordinatorId: eventRow?.coordinator_id ?? '',
        })

        const feeConfig = resolveEventFeeConfig(eventRow)

        const { error: txError } = await recordPlatformTransaction(supabase, {
          boothApplicationId: application.id,
          eventId: application.event_id,
          vendorId: application.vendor_id,
          coordinatorId: eventRow?.coordinator_id ?? '',
          categoryId: application.category_id,
          totalAmountCents: checkout.totalChargedCents,
          platformFeeCents: checkout.platformFeeCents,
          baseBoothCents: checkout.baseBoothCents,
          feeModeUsed: feeConfig.mode,
          processorChargeId: squarePaymentId,
          status: 'completed',
          processor: 'square',
          externalProcessorPayout: true,
          eventEndAt: eventRow?.end_at ?? null,
        })

        if (txError) {
          console.error('[Square webhook] platform transaction failed:', txError, {
            squarePaymentId,
            applicationId: application.id,
          })
        }
      }

      const { data: wtx } = await supabase
        .from('wallet_transactions')
        .select('id, wallet_id, amount, metadata')
        .eq('square_payment_id', squarePaymentId)
        .eq('type', 'deposit')
        .maybeSingle()

      if (wtx && !isDepositBalanceApplied(wtx.metadata as Record<string, unknown>)) {
        const credit = await applyWalletDepositCredit(supabase, {
          walletId: wtx.wallet_id,
          amountCents: wtx.amount,
          transactionId: wtx.id,
        })

        if (!credit.ok) {
          console.error('[Square webhook] wallet deposit credit failed', {
            squarePaymentId,
            walletId: wtx.wallet_id,
            error: credit.error,
          })
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

      await handlePaymentDispute(supabase, payment.id, 'payment.failed')
      break
    }

    case 'payment.disputed':
    case 'dispute.created':
    case 'dispute.state.updated': {
      const paymentId =
        event.data?.object?.payment?.id ??
        event.data?.object?.dispute?.payment_id ??
        event.data?.object?.dispute?.disputed_payment?.payment_id

      if (paymentId) {
        await handlePaymentDispute(
          supabase,
          paymentId,
          eventType === 'payment.disputed' ? 'payment.disputed' : 'dispute.created'
        )
      }
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

      if (refund.payment_id) {
        await handlePaymentDispute(supabase, refund.payment_id, 'refund.completed')
      }

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
