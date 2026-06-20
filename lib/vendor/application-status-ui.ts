import type { ApplicationStatus } from '@/types/database'
import { marketStatusBadge } from '@/lib/theme/market'

export interface VendorApplicationStatusUi {
  label: string
  badgeClass: string
  nextStep: string
  canFollowUp: boolean
}

export const VENDOR_APPLICATION_STATUS_UI: Record<ApplicationStatus, VendorApplicationStatusUi> = {
  pending: {
    label: 'Pending Review',
    badgeClass: marketStatusBadge.warning,
    nextStep: 'The organizer is reviewing your application. You will be notified when they decide.',
    canFollowUp: true,
  },
  pending_insurance: {
    label: 'Pending Proof of Insurance',
    badgeClass: marketStatusBadge.warning,
    nextStep: 'Upload your market insurance proof below, or follow up with the organizer if you have questions.',
    canFollowUp: true,
  },
  approved: {
    label: 'Approved',
    badgeClass: marketStatusBadge.success,
    nextStep: 'Your booth is confirmed. Check event details for load-in times and logistics.',
    canFollowUp: false,
  },
  waitlisted: {
    label: 'Waitlisted',
    badgeClass: marketStatusBadge.warning,
    nextStep: 'You will be notified if a booth opens from a cancellation.',
    canFollowUp: true,
  },
  rejected: {
    label: 'Declined',
    badgeClass: marketStatusBadge.error,
    nextStep: 'This market did not select your application. Discover other open markets to apply again.',
    canFollowUp: false,
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: marketStatusBadge.neutral,
    nextStep: 'This event was cancelled. Refunds are handled according to payment method.',
    canFollowUp: false,
  },
}

export type VendorApplicationFilter =
  | 'all'
  | 'active'
  | 'pending'
  | 'pending_insurance'
  | 'approved'
  | 'waitlisted'
  | 'closed'

/** Vendor already has a booth application — show its status even when the market is closed to new applicants. */
export function hasExistingVendorApplication(
  status: ApplicationStatus | null | undefined,
): boolean {
  return status != null
}

export const VENDOR_REAPPLICATION_BLOCKED_MESSAGE =
  'You already applied to this market. Additional applications are not accepted.'

/**
 * UI shape used when an application's market closes before the organizer
 * could decide on it. Only triggered for `pending` rows — `waitlisted`
 * intentionally survives closure (the user may still get pulled in), and
 * `pending_insurance` represents an already-approved seat that needs
 * follow-through, so neither receive this terminal treatment.
 */
export const VENDOR_APPLICATION_CLOSED_UNSELECTED_UI: VendorApplicationStatusUi = {
  label: 'Applications closed — not selected',
  badgeClass: marketStatusBadge.neutral,
  nextStep:
    'This market closed before the organizer reviewed your application. Discover other open markets to apply again.',
  canFollowUp: false,
}

/**
 * Resolve the *effective* status UI for a vendor row given whether the
 * market is still open to new/pending applications. When applications
 * have closed and the row is still in `pending`, surface a terminal
 * "Applications closed — not selected" state instead of the perpetual
 * "Pending Review" badge.
 *
 * Pass `applicationsOpen={true}` (or omit) for the legacy unconditional
 * mapping — useful when callers don't know the event timing.
 */
export function resolveVendorApplicationStatusUi(
  status: ApplicationStatus,
  applicationsOpen = true,
): VendorApplicationStatusUi {
  if (!applicationsOpen && status === 'pending') {
    return VENDOR_APPLICATION_CLOSED_UNSELECTED_UI
  }
  return VENDOR_APPLICATION_STATUS_UI[status]
}

/** Short label for vendor market cards — always leads with "Applied". */
export function vendorApplicationCardBadgeLabel(
  status: ApplicationStatus,
  applicationsOpen = true,
): string {
  const ui = resolveVendorApplicationStatusUi(status, applicationsOpen)
  return `Applied · ${ui.label}`
}

export function filterVendorApplications<T extends { status: ApplicationStatus; event?: { status?: string } | null }>(
  applications: T[],
  filter: VendorApplicationFilter,
): T[] {
  switch (filter) {
    case 'pending':
      return applications.filter(
        (app) => app.status === 'pending' || app.status === 'pending_insurance',
      )
    case 'pending_insurance':
      return applications.filter((app) => app.status === 'pending_insurance')
    case 'approved':
      return applications.filter((app) => app.status === 'approved')
    case 'waitlisted':
      return applications.filter((app) => app.status === 'waitlisted')
    case 'closed':
      return applications.filter(
        (app) =>
          app.status === 'rejected' ||
          app.status === 'cancelled' ||
          app.event?.status === 'cancelled',
      )
    case 'active':
      return applications.filter(
        (app) =>
          app.status === 'pending' ||
          app.status === 'pending_insurance' ||
          app.status === 'approved' ||
          app.status === 'waitlisted',
      )
    default:
      return applications
  }
}
