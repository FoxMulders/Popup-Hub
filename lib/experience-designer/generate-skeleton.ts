import { apiFetch } from '@/lib/api/api-fetch'
import type {
  CouncilTelemetry,
  ExperienceConstraints,
  RoomSkeleton,
} from '@/lib/experience-designer/types'

export interface GenerateSkeletonResult {
  roomSkeleton: RoomSkeleton
  telemetry: CouncilTelemetry
  sessionId?: string
}

export interface GeneratePuzzlesResult {
  roomSkeleton: RoomSkeleton
  telemetry: CouncilTelemetry
  sessionId?: string
}

export async function fetchArchitecturalSkeleton(
  constraints: ExperienceConstraints,
  sessionId?: string
): Promise<GenerateSkeletonResult> {
  return apiFetch<GenerateSkeletonResult>('/api/experience-designer/generate-skeleton', {
    method: 'POST',
    body: JSON.stringify({ ...constraints, sessionId }),
  })
}

export async function fetchPuzzlesForSkeleton(
  constraints: ExperienceConstraints,
  roomSkeleton: RoomSkeleton,
  sessionId?: string
): Promise<GeneratePuzzlesResult> {
  return apiFetch<GeneratePuzzlesResult>('/api/experience-designer/generate-puzzles', {
    method: 'POST',
    body: JSON.stringify({ ...constraints, roomSkeleton, sessionId }),
  })
}
