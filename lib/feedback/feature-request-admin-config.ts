import type { FeatureImpactLevel, FeatureSubmitterRole } from '@/lib/feedback/feature-request-config'
import type { FeatureRequestStatus } from '@/types/database'

export const FEATURE_REQUEST_STATUSES: {
  value: FeatureRequestStatus
  label: string
}[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
]

export function isValidFeatureRequestStatus(value: string): value is FeatureRequestStatus {
  return FEATURE_REQUEST_STATUSES.some((option) => option.value === value)
}

export function featureRequestStatusLabel(status: FeatureRequestStatus): string {
  return FEATURE_REQUEST_STATUSES.find((option) => option.value === status)?.label ?? status
}

export function submitterRoleBadgeClass(role: FeatureSubmitterRole): string {
  switch (role) {
    case 'coordinator':
      return 'bg-sky-100 text-sky-900 border-sky-200'
    case 'vendor':
      return 'bg-harvest-100 text-harvest-900 border-harvest-200'
    case 'patron':
      return 'bg-sage-100 text-sage-900 border-sage-200'
  }
}

export function submitterRoleLabel(role: FeatureSubmitterRole): string {
  switch (role) {
    case 'coordinator':
      return 'Coordinator'
    case 'vendor':
      return 'Vendor'
    case 'patron':
      return 'Patron'
  }
}

export function impactLevelBadgeVariant(
  level: FeatureImpactLevel
): 'destructive' | 'warning' | 'success' {
  switch (level) {
    case 'critical':
      return 'destructive'
    case 'workflow_blocked':
      return 'warning'
    case 'nice_to_have':
      return 'success'
  }
}

export function impactLevelShortLabel(level: FeatureImpactLevel): string {
  switch (level) {
    case 'critical':
      return 'Critical'
    case 'workflow_blocked':
      return 'Blocked'
    case 'nice_to_have':
      return 'Nice to Have'
  }
}
