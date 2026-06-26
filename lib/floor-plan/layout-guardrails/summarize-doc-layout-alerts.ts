import type { FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  findCategoryClusterAlerts,
  type CategoryClusterAlert,
} from './category-cluster-alerts'
import { listMeltZoneIssues, type MeltZoneIssue } from './melt-zone-rules'
import { listOutdoorExposureIssues } from './outdoor-exposure-rules'

export interface DocLayoutAlertsSummary {
  meltZoneCount: number
  outdoorExposureCount: number
  clusterAlertCount: number
  meltZoneIssues: MeltZoneIssue[]
  outdoorExposureIssues: ReturnType<typeof listOutdoorExposureIssues>
  clusterAlerts: CategoryClusterAlert[]
}

export function summarizeDocLayoutAlerts(doc: FloorPlanDoc): DocLayoutAlertsSummary {
  const gridSpacingFt = doc.gridSpacingFt ?? 1
  const outdoorExposureIssues = listOutdoorExposureIssues(doc)
  const meltZoneIssues = listMeltZoneIssues(doc)
  const clusterAlerts = findCategoryClusterAlerts(doc.objects, gridSpacingFt)

  return {
    meltZoneCount: meltZoneIssues.length,
    outdoorExposureCount: outdoorExposureIssues.length,
    clusterAlertCount: clusterAlerts.length,
    meltZoneIssues,
    outdoorExposureIssues,
    clusterAlerts,
  }
}

export const LAYOUT_GUARDRAILS_EXPLANATION = {
  meltZoneTitle: 'Melt-zone warnings',
  meltZoneIntro:
    'Candles, wax, chocolate, and similar vendors should stay away from food trucks, bakeries, and hot food stations.',
  meltZoneDetail: `Orange tint when a melt-sensitive booth is within 8′ of a heat source. Advisory only — does not block publish.`,
  outdoorExposureTitle: 'Outdoor lot exposure',
  outdoorExposureIntro:
    'On outdoor markets, vendor booths on the open lot are exposed to sun, wind, and temperature swings.',
  outdoorExposureDetail:
    'Place booths inside a shaded hall or covered room when possible. Open-lot placement is advisory only.',
  clusterTitle: 'Category clustering',
  clusterIntro:
    'Too many same-category booths in one zone can oversaturate a row and hurt vendor diversity.',
  clusterDetail:
    'Advisory when 3 or more booths of the same category sit within a 6-column × 3-row neighborhood.',
} as const
