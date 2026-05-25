import type { ApplicationStatus } from '@/types/database'

export type VendorHistoryApplication = {
  id: string
  status: ApplicationStatus
  checked_in: boolean
  event_id: string
  event?: {
    start_at?: string
    end_at?: string
    status?: string
  } | null
}

export interface VendorPlatformHistory {
  approved: number
  declined: number
  participated: number
  noShowCanceled: number
  reliabilityPercent: number | null
  reliabilityTone: 'success' | 'warning' | 'danger' | 'neutral'
  reliabilityLabel: string
}

function eventHasEnded(event: VendorHistoryApplication['event']): boolean {
  if (!event) return false
  if (event.status === 'completed' || event.status === 'cancelled') return true
  const end = event.end_at ?? event.start_at
  if (!end) return false
  return new Date(end).getTime() < Date.now()
}

export function computeVendorPlatformHistory(
  applications: VendorHistoryApplication[],
  excludeApplicationId?: string,
): VendorPlatformHistory {
  const rows = excludeApplicationId
    ? applications.filter((row) => row.id !== excludeApplicationId)
    : applications

  let approved = 0
  let declined = 0
  let participated = 0
  let noShowCanceled = 0

  for (const row of rows) {
    if (row.status === 'rejected') {
      declined += 1
      continue
    }

    if (row.status === 'cancelled') {
      noShowCanceled += 1
      continue
    }

    if (row.status === 'approved' || row.status === 'pending_insurance') {
      approved += 1
      if (row.checked_in) {
        participated += 1
      } else if (eventHasEnded(row.event)) {
        noShowCanceled += 1
      }
      continue
    }

    if (row.checked_in) {
      participated += 1
    }
  }

  const reliabilityPercent =
    approved > 0 ? Math.round((participated / approved) * 100) : null

  let reliabilityTone: VendorPlatformHistory['reliabilityTone'] = 'neutral'
  let reliabilityLabel = 'No approval history yet'

  if (reliabilityPercent != null) {
    if (reliabilityPercent >= 85 && noShowCanceled === 0) {
      reliabilityTone = 'success'
      reliabilityLabel = `${reliabilityPercent}% reliability`
    } else if (reliabilityPercent >= 60 && noShowCanceled <= 1) {
      reliabilityTone = 'warning'
      reliabilityLabel = `${reliabilityPercent}% reliability — review history`
    } else {
      reliabilityTone = 'danger'
      reliabilityLabel = `${reliabilityPercent}% reliability — caution advised`
    }
  } else if (declined > 0 || noShowCanceled > 0) {
    reliabilityTone = 'warning'
    reliabilityLabel = 'Limited track record'
  }

  return {
    approved,
    declined,
    participated,
    noShowCanceled,
    reliabilityPercent,
    reliabilityTone,
    reliabilityLabel,
  }
}
