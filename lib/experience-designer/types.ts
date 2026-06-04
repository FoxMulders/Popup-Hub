export type ExperienceDesignerStep = 1 | 2 | 3 | 4

export type ExperienceTheme =
  | 'haunted_manor'
  | 'cyber_heist'
  | 'pirate_vault'
  | 'space_station'

export type ExperienceVenueType =
  | 'popup_trailer'
  | 'warehouse'
  | 'retail_suite'
  | 'outdoor_pavilion'

/** Home party vs commercial venue — drives Master Generator compiler policy. */
export type ExperienceDeploymentMode = 'home' | 'commercial'

export interface ExperienceConstraints {
  theme: ExperienceTheme
  venueType: ExperienceVenueType
  targetPlayerCount: number
  deploymentMode: ExperienceDeploymentMode
}

export interface ZoneBomLine {
  sku: string
  name: string
  quantity: number
  unitCostCents: number
}

import type { MaterialChecklistLinkItem } from '@/lib/experience-designer/material-checklist-schema'

export type { MaterialChecklistLinkItem }

export interface RoomZone {
  id: string
  name: string
  zoneType: 'entry' | 'corridor' | 'puzzle' | 'climax' | 'utility'
  position: { x: number; y: number }
  puzzleTitle?: string
  puzzleSummary?: string
  bom?: ZoneBomLine[]
  /** Normalized puzzle materials with Amazon.ca affiliate links (no static prices). */
  materialChecklist?: MaterialChecklistLinkItem[]
  arduinoCode?: string
}

export interface ZoneConnection {
  id: string
  fromZoneId: string
  toZoneId: string
  label?: string
}

export type RoomFlowPattern = 'linear_4zone' | 'multilinear' | 'nonlinear_open'

export interface RoomSkeleton {
  zones: RoomZone[]
  connections: ZoneConnection[]
  flowPattern?: RoomFlowPattern
  flowSummary?: string
  generatedAt?: string
}

export interface CouncilVerdict {
  personaId: string
  title: string
  score: number
  wowFactor: boolean
  criticalFeedback: string
}

export interface CouncilReport {
  passed: boolean
  averageScore: number
  wowCount: number
  iterations: number
  revisionNotes?: string
  verdicts?: CouncilVerdict[]
}

export interface CouncilTelemetry {
  councilStatus: 'idle' | 'generating' | 'reviewing' | 'ready'
  activeAgents: string[]
  consensusScore: number
  tokensUsed: number
  lastAction?: string
  councilReport?: CouncilReport
  generationEngine?: string
}
