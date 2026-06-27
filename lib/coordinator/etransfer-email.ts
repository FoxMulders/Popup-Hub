export function resolveCoordinatorEtransferEmail(profile: {
  etransfer_payment_email?: string | null
  email?: string | null
} | null | undefined): string | null {
  const dedicated = profile?.etransfer_payment_email?.trim()
  if (dedicated) return dedicated
  return null
}
