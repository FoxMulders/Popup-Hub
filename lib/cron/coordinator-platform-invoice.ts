import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCoordinatorBalanceOwed,
  isBalanceDueForInvoice,
  resetCoordinatorBalanceAfterInvoice,
} from '@/lib/payments/account-balance'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'

export type CoordinatorInvoiceRunResult = {
  scanned: number
  invoiced: number
  skipped: number
  errors: string[]
  checkoutUrls: { coordinatorId: string; url: string }[]
}

/**
 * MVP consolidated billing: create Stripe Checkout sessions for balances due
 * (balance > $20 or calendar month-end with outstanding balance).
 * Balance resets when payment_intent.succeeded webhook fires (coordinator_platform_invoice).
 */
export async function processCoordinatorPlatformInvoices(
  supabase: SupabaseClient
): Promise<CoordinatorInvoiceRunResult> {
  const result: CoordinatorInvoiceRunResult = {
    scanned: 0,
    invoiced: 0,
    skipped: 0,
    errors: [],
    checkoutUrls: [],
  }

  const { data: rows, error } = await supabase
    .from('account_balances')
    .select('coordinator_id, balance_owed, last_invoiced_at')
    .gt('balance_owed', 0)

  if (error) {
    result.errors.push(error.message)
    return result
  }

  const now = new Date()
  const dueRows = (rows ?? []).filter((row) =>
    isBalanceDueForInvoice(Number(row.balance_owed), row.last_invoiced_at, now)
  )

  result.scanned = dueRows.length

  if (!isStripeConfigured()) {
    result.skipped = dueRows.length
    result.errors.push('Stripe is not configured — cannot create invoice checkout sessions')
    return result
  }

  const stripe = getStripeClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  for (const row of dueRows) {
    const balanceOwed = Number(row.balance_owed)
    if (balanceOwed <= 0) {
      result.skipped += 1
      continue
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', row.coordinator_id)
      .single()

    if (profile?.role !== 'coordinator' || !profile.email) {
      result.skipped += 1
      continue
    }

    const amountCents = Math.round(balanceOwed * 100)
    if (amountCents < 50) {
      result.skipped += 1
      continue
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: profile.email,
        line_items: [
          {
            price_data: {
              currency: 'cad',
              unit_amount: amountCents,
              product_data: {
                name: 'Popup Hub platform fees',
                description: `Consolidated platform fees (${balanceOwed.toFixed(2)} CAD)`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/coordinator/payment-methods?platform_invoice=success`,
        cancel_url: `${baseUrl}/coordinator/payment-methods?platform_invoice=cancelled`,
        payment_intent_data: {
          metadata: {
            kind: 'coordinator_platform_invoice',
            coordinator_id: row.coordinator_id,
            amount_cents: String(amountCents),
          },
        },
      })

      if (session.url) {
        result.checkoutUrls.push({ coordinatorId: row.coordinator_id, url: session.url })
      }
      result.invoiced += 1
    } catch (err) {
      result.errors.push(
        `${row.coordinator_id}: ${err instanceof Error ? err.message : 'checkout failed'}`
      )
    }
  }

  return result
}

export async function finalizeCoordinatorPlatformInvoicePayment(
  supabase: SupabaseClient,
  params: { coordinatorId: string; paymentIntentId: string }
): Promise<void> {
  const balance = await getCoordinatorBalanceOwed(supabase, params.coordinatorId)
  if (balance <= 0) return

  await resetCoordinatorBalanceAfterInvoice(supabase, params.coordinatorId)
}
