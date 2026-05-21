import { SquareClient, SquareEnvironment } from 'square'

const environment =
  process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment,
})

export const oAuthApi = squareClient.oAuth
export const customersApi = squareClient.customers
export const ordersApi = squareClient.orders
export const paymentsApi = squareClient.payments

/** Convert display dollars to cents integer */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/** Format cents integer as a USD currency string */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
