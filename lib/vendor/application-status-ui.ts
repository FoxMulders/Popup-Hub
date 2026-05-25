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

export type VendorApplicationFilter = 'all' | 'active' | 'pending' | 'approved' | 'waitlisted' | 'closed'

export function filterVendorApplications<T extends { status: ApplicationStatus; event?: { status?: string } | null }>(
  applications: T[],
  filter: VendorApplicationFilter,
): T[] {
  switch (filter) {
    case 'pending':
      return applications.filter(
        (app) => app.status === 'pending' || app.status === 'pending_insurance',
      )
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
