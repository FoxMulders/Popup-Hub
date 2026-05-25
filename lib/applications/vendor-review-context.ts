import {
  buildCategoryCapacityRows,
  getCategoryAvailability,
  type CategoryCapacityRow,
} from '@/lib/coordinator/category-capacity-rows'
import type { BoothApplication, EventCategoryLimit } from '@/types/database'

const BOOTH_TYPE_LABEL: Record<string, string> = {
  inside: 'Inside booth',
  wall: 'Wall / perimeter',
  power: 'Electricity ⚡',
  any: 'Any placement',
}

export interface VendorRequestSummary {
  categoryName: string
  boothLabel: string
  tableLabel: string
  powerRequired: boolean
  neighborPreference: string | null
  attendanceLabel: string | null
}

export interface MarketInventorySummary {
  categoryRow: CategoryCapacityRow | null
  categoryCapLabel: string
  categoryCapTone: 'open' | 'low' | 'full' | 'neutral'
  powerApproved: number
  powerMax: number
  powerRemaining: number
  powerLabel: string
}

export interface InsuranceReviewStatus {
  tone: 'success' | 'warning' | 'neutral'
  label: string
  detail: string
  documentUrl: string | null
}

export function buildVendorRequestSummary(
  app: BoothApplication,
  categoryNameById: Record<string, string>,
  categoryLimit?: EventCategoryLimit | null,
): VendorRequestSummary {
  const categoryName =
    app.category?.name ?? categoryNameById[app.category_id] ?? 'Uncategorized'
  const boothType = app.requested_booth_type ?? categoryLimit?.booth_type ?? 'any'
  const tableFt = app.table_length_ft ?? categoryLimit?.table_length_ft ?? 10

  return {
    categoryName,
    boothLabel: BOOTH_TYPE_LABEL[boothType] ?? 'Standard booth',
    tableLabel: `${tableFt}×${tableFt} ft footprint`,
    powerRequired: boothType === 'power' || categoryLimit?.booth_type === 'power',
    neighborPreference: app.neighbor_preference,
    attendanceLabel: app.attending_dates?.length
      ? app.attending_dates.join(', ')
      : null,
  }
}

export function buildMarketInventorySummary(
  app: BoothApplication,
  applications: BoothApplication[],
  categoryLimits: EventCategoryLimit[],
): MarketInventorySummary {
  const capacityRows = buildCategoryCapacityRows(
    categoryLimits,
    applications.map((row) => ({
      category_id: row.category_id,
      status: row.status,
    })),
  )

  const categoryRow =
    capacityRows.find((row) => row.categoryId === app.category_id) ?? null

  const availability = categoryRow
    ? getCategoryAvailability(categoryRow.approvedCount, categoryRow.maxSlots)
    : null

  const powerLimits = categoryLimits.filter((limit) => limit.booth_type === 'power')
  const powerMax = powerLimits.reduce((sum, limit) => sum + limit.max_slots, 0)
  const powerApproved = applications.filter(
    (row) =>
      row.event_id === app.event_id &&
      (row.status === 'approved' || row.status === 'pending_insurance') &&
      (row.requested_booth_type === 'power' ||
        categoryLimits.find((limit) => limit.category_id === row.category_id)?.booth_type ===
          'power'),
  ).length
  const powerRemaining = Math.max(0, powerMax - powerApproved)

  const categoryCapLabel = categoryRow
    ? `${categoryRow.approvedCount}/${categoryRow.maxSlots} ${categoryRow.categoryName} vendors approved`
    : 'Category capacity not configured'

  return {
    categoryRow,
    categoryCapLabel,
    categoryCapTone: availability?.tone ?? 'neutral',
    powerApproved,
    powerMax,
    powerRemaining,
    powerLabel:
      powerMax > 0
        ? `${powerRemaining} electricity spot${powerRemaining === 1 ? '' : 's'} remaining`
        : 'No dedicated electricity slots configured',
  }
}

export function buildInsuranceReviewStatus(
  app: BoothApplication,
  marketInsuranceRequired: boolean,
): InsuranceReviewStatus {
  if (app.market_insurance_url) {
    return {
      tone: 'success',
      label: 'Insurance proof uploaded',
      detail: 'Vendor submitted liability documentation for this market.',
      documentUrl: app.market_insurance_url,
    }
  }

  if (marketInsuranceRequired) {
    return {
      tone: 'warning',
      label: 'No insurance provided',
      detail: 'This market requires proof of liability insurance before final approval.',
      documentUrl: null,
    }
  }

  return {
    tone: 'neutral',
    label: 'Insurance not required',
    detail: 'This market does not require uploaded insurance proof.',
    documentUrl: null,
  }
}
