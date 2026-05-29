import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  return key || null
}

export function isStripeConfigured(): boolean {
  return !!getStripeSecretKey()
}

export function getStripeClient(): Stripe {
  const key = getStripeSecretKey()
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key)
  }

  return stripeClient
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null
}
