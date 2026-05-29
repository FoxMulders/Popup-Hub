import type { ApplicationStatus, PaymentStatus, PaymentMethod } from '@/types/database'
import { isApplicationPaid } from '@/lib/applications/payment-fields'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'

export type { BoothPlacementStatus } from '@/lib/coordinator/booth-placement-status'
export { BOOTH_STATUS_THEME, formatCadCurrency } from '@/lib/coordinator/booth-placement-status'

export interface VendorApplicationSnapshot {
  id: string
  vendor_id: string
  status: ApplicationStatus
  payment_status: PaymentStatus
  payment_method: string | null
  application_payment_status: string | null
  booth_number: number | null
  categoryName?: string | null
  vendorName?: string | null
}

export function deriveBoothPlacementStatus(
  booth: BoothObject,
  appByVendorId: ReadonlyMap<string, VendorApplicationSnapshot>,
  vipHoldApplicationIds: ReadonlySet<string>,
  appByApplicationId?: ReadonlyMap<string, VendorApplicationSnapshot>
): BoothPlacementStatus {
  if (!booth.vendorId) return 'unassigned'
  const app =
    appByVendorId.get(booth.vendorId) ??
    appByApplicationId?.get(booth.vendorId)
  if (!app) return 'assigned_unpaid'
  if (app.status === 'waitlisted' || vipHoldApplicationIds.has(app.id)) return 'vip_hold'
  if (
    isApplicationPaid({
      payment_status: app.payment_status,
      payment_method: app.payment_method as PaymentMethod | null,
      application_payment_status: app.application_payment_status as
        | 'PENDING_REVIEW'
        | 'COMPLETED'
        | 'EXPIRED'
        | null,
    })
  ) {
    return 'paid'
  }
  return 'assigned_unpaid'
}
