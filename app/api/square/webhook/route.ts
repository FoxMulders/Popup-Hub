import { NextResponse } from 'next/server'
import { validateSquareWebhook } from '@/lib/square/webhook'
import { createServiceClient } from '@/lib/supabase/server'

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

      const referenceId: string = payment.reference_id ?? ''
      const squarePaymentId: string = payment.id

      // Update booth application payment status by square_payment_id reference
      await supabase
        .from('booth_applications')
        .update({ payment_status: 'paid', square_payment_id: squarePaymentId })
        .eq('square_payment_id', squarePaymentId)

      // Update wallet transaction if this was a wallet deposit
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

      console.log(`[Square webhook] payment.completed: ${squarePaymentId} ref=${referenceId}`)
      break
    }

    case 'payment.failed': {
      const payment = event.data?.object?.payment
      if (!payment) break

      await supabase
        .from('booth_applications')
        .update({ payment_status: 'unpaid' })
        .eq('square_payment_id', payment.id)

      break
    }

    case 'refund.completed': {
      const refund = event.data?.object?.refund
      if (!refund) break

      await supabase
        .from('booth_applications')
        .update({ payment_status: 'refunded' })
        .eq('square_payment_id', refund.payment_id)

      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
