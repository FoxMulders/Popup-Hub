import type { VendorApplicationSnapshot } from '@/components/coordinator/dashboard/booth-placement-status'

type ApplicationRow = {
  id: string
  event_id: string
  vendor_id: string
  status: VendorApplicationSnapshot['status']
  payment_status: VendorApplicationSnapshot['payment_status']
  payment_method: string | null
  application_payment_status: string | null
  booth_number: number | null
  table_count?: number | null
  vendor?: { full_name?: string | null } | { full_name?: string | null }[] | null
  category?: { name?: string | null } | { name?: string | null }[] | null
}

function vendorNameFromRow(app: ApplicationRow): string | null {
  const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor
  return vendor?.full_name ?? null
}

function categoryNameFromRow(app: ApplicationRow): string | null {
  const category = Array.isArray(app.category) ? app.category[0] : app.category
  return category?.name ?? null
}

export function toVendorApplicationSnapshot(app: ApplicationRow): VendorApplicationSnapshot {
  return {
    id: app.id,
    vendor_id: app.vendor_id,
    status: app.status,
    payment_status: app.payment_status,
    payment_method: app.payment_method,
    application_payment_status: app.application_payment_status,
    booth_number: app.booth_number,
    categoryName: categoryNameFromRow(app),
    vendorName: vendorNameFromRow(app),
    tableCount: Math.max(1, app.table_count ?? 1),
  }
}

export function partitionDashboardApplicationSnapshots(apps: ApplicationRow[]): {
  approved: VendorApplicationSnapshot[]
  pending: VendorApplicationSnapshot[]
} {
  const approved: VendorApplicationSnapshot[] = []
  const pending: VendorApplicationSnapshot[] = []

  for (const app of apps) {
    const snapshot = toVendorApplicationSnapshot(app)
    if (
      app.status === 'approved' ||
      app.status === 'pending_insurance' ||
      app.status === 'waitlisted'
    ) {
      approved.push(snapshot)
    }
    if (app.status === 'pending' || app.status === 'pending_insurance') {
      pending.push(snapshot)
    }
  }

  return { approved, pending }
}
