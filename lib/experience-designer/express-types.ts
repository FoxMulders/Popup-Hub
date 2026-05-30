/** Shapes returned by the Tipsy Fox / Master Generator Express backend. */

export type ExpressFlowPattern = 'linear_4zone' | 'multilinear' | 'nonlinear_open'

export type ExpressTargetInterface = 'home_party' | 'commercial_venue'

export interface ExpressRoomZone {
  zone_id: string
  name: string
  primary_player_action: string
  suggested_hardware_profile?: string
}

export interface ExpressRoomSkeleton {
  flow_pattern: ExpressFlowPattern
  zones: ExpressRoomZone[]
  flow_summary: string
}

export interface ExpressCouncilVerdict {
  personaId: string
  title: string
  score: number
  wow_factor: boolean
  critical_feedback: string
}

export interface ExpressCouncilReport {
  passed: boolean
  averageScore: number
  wowCount: number
  iterations: number
  revisionNotes?: string
  verdicts?: ExpressCouncilVerdict[]
}

export interface ExpressPuzzle {
  id: string
  title: string
  objective?: string
  howItWorks?: string
  category?: 'logic' | 'physical' | 'electronic'
  stageHint?: string
  bill_of_materials?: string[]
  required_parts_and_props?: string[]
  electronicDetails?: {
    parts?: string[]
    arduinoCode?: string
  }
}

export interface MasterGeneratorApiResponse {
  roomSkeleton: ExpressRoomSkeleton
  councilReport?: ExpressCouncilReport
  puzzles?: ExpressPuzzle[]
  tokensUsed?: number
  generationEngine?: string
}

export interface MasterGeneratorApiRequest {
  theme: string
  venueType: string
  targetPlayerCount: number
  targetInterface: ExpressTargetInterface
  mode: 'skeleton' | 'puzzles'
  sessionId?: string
}
