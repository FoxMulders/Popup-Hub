import type { ApplicationStatus } from '@/types/database'

/** Resolve final application status after coordinator/instant approval. */
export function resolvePostApprovalStatus(
  marketInsuranceRequired: boolean | null | undefined,
): Extract<ApplicationStatus, 'approved' | 'pending_insurance'> {
  return marketInsuranceRequired ? 'pending_insurance' : 'approved'
}

export function isReservedBoothStatus(status: ApplicationStatus): boolean {
  return status === 'approved' || status === 'pending_insurance'
}

export function isFullyApprovedStatus(status: ApplicationStatus): boolean {
  return status === 'approved'
}
