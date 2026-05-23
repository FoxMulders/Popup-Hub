import { randomUUID } from 'crypto'
import { squareClient } from './client'

export interface RefundPaymentResult {
  refundId: string | null
  error: string | null
}

/**
 * Issue a full refund against an existing Square payment (Refunds API).
 */
export async function refundSquarePayment(params: {
  paymentId: string
  amountCents: number
  reason: string
  idempotencyKey?: string
}): Promise<RefundPaymentResult> {
  const { paymentId, amountCents, reason } = params
  const idempotencyKey = (params.idempotencyKey ?? `rf-${randomUUID()}`).slice(0, 45)

  try {
    const response = await squareClient.refunds.refundPayment({
      idempotencyKey,
      paymentId,
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      reason,
    })

    const refund = response.refund
    if (!refund?.id) {
      return { refundId: null, error: 'Square returned no refund id' }
    }

    return { refundId: refund.id, error: null }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'errors' in err
          ? JSON.stringify((err as { errors: unknown }).errors)
          : 'Refund failed'
    return { refundId: null, error: message }
  }
}
