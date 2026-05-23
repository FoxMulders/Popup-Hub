import { randomUUID } from 'crypto'
import { createSellerSquareClient } from './oauth'
import { paymentsApi } from './client'

interface CreateBoothPaymentParams {
  sourceId: string
  amountCents: number
  eventId: string
  applicationId: string
  coordinatorAccessToken: string
  platformFeeCents: number
}

export async function createBoothPayment(params: CreateBoothPaymentParams) {
  const {
    sourceId,
    amountCents,
    eventId,
    applicationId,
    coordinatorAccessToken,
    platformFeeCents,
  } = params

  const sellerClient = createSellerSquareClient(coordinatorAccessToken)
  const appFeeAmount = Math.min(Math.max(platformFeeCents, 0), amountCents)

  try {
    const response = await sellerClient.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      appFeeMoney:
        appFeeAmount > 0
          ? { amount: BigInt(appFeeAmount), currency: 'USD' }
          : undefined,
      note: `Popup Hub booth booking — event ${eventId}`,
      referenceId: applicationId.slice(0, 40),
    })

    return { paymentId: response.payment?.id ?? null, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment failed'
    return { paymentId: null, error: message }
  }
}

interface CreateWalletDepositParams {
  sourceId: string
  amountCents: number
  userId: string
  squareCustomerId?: string
}

export async function createWalletDeposit(params: CreateWalletDepositParams) {
  const { sourceId, amountCents, userId, squareCustomerId } = params

  try {
    const response = await paymentsApi.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      customerId: squareCustomerId,
      note: `Popup Hub wallet deposit — user ${userId}`,
    })

    return { paymentId: response.payment?.id ?? null, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment failed'
    return { paymentId: null, error: message }
  }
}
