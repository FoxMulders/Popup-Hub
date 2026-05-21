import { paymentsApi } from './client'
import { randomUUID } from 'crypto'

interface CreateBoothPaymentParams {
  sourceId: string
  amountCents: number
  vendorId: string
  eventId: string
  applicationId: string
  coordinatorMerchantId: string | null
  platformFeeBps: number
}

export async function createBoothPayment(params: CreateBoothPaymentParams) {
  const { sourceId, amountCents, vendorId, eventId, applicationId, platformFeeBps } = params
  const appFeeAmount = Math.round((amountCents * platformFeeBps) / 10000)

  try {
    const response = await paymentsApi.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      appFeeMoney: appFeeAmount > 0
        ? { amount: BigInt(appFeeAmount), currency: 'USD' }
        : undefined,
      note: `Popup Hub booth booking — event ${eventId}`,
      referenceId: applicationId,
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
