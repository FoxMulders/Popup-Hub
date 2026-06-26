import { isPassportQrEligible } from '@/lib/passport/passport-token'
import { publicAppUrl } from '@/lib/url/public-app-url'
import type { BoothApplication } from '@/types/database'

export function isBoothSignEligible(
  app: Pick<
    BoothApplication,
    'status' | 'payment_status' | 'application_payment_status' | 'payment_method'
  >
): boolean {
  return isPassportQrEligible(app)
}

export function buildBoothSignProfilePath(eventId: string, vendorId: string): string {
  return `/events/${eventId}/vendors/${vendorId}`
}

export function buildBoothSignProfileUrl(
  eventId: string,
  vendorId: string,
  origin?: string
): string {
  return publicAppUrl(buildBoothSignProfilePath(eventId, vendorId), origin)
}
