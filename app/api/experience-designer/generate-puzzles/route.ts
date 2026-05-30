import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  invokeMasterGenerator,
  MasterGeneratorConfigError,
  MasterGeneratorUpstreamError,
} from '@/lib/experience-designer/master-generator-proxy'
import {
  mapCouncilReportToTelemetry,
  mapExpressSkeletonToRoomSkeleton,
} from '@/lib/experience-designer/map-express-response'
import type { ExperienceConstraints, RoomSkeleton } from '@/lib/experience-designer/types'
import type { ExpressCouncilReport } from '@/lib/experience-designer/express-types'

function mapExpressCouncilReport(report: ExpressCouncilReport) {
  return {
    passed: report.passed,
    averageScore: report.averageScore,
    wowCount: report.wowCount,
    iterations: report.iterations,
    revisionNotes: report.revisionNotes,
    verdicts: report.verdicts?.map((v) => ({
      personaId: v.personaId,
      title: v.title,
      score: v.score,
      wowFactor: v.wow_factor,
      criticalFeedback: v.critical_feedback,
    })),
  }
}

function parseBody(body: unknown): {
  constraints: ExperienceConstraints
  sessionId?: string
  roomSkeleton?: RoomSkeleton
} | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const theme = record.theme
  const venueType = record.venueType
  const targetPlayerCount = Number(record.targetPlayerCount)
  const deploymentMode = record.deploymentMode

  if (
    typeof theme !== 'string' ||
    typeof venueType !== 'string' ||
    !Number.isFinite(targetPlayerCount) ||
    targetPlayerCount < 1
  ) {
    return null
  }

  return {
    constraints: {
      theme: theme as ExperienceConstraints['theme'],
      venueType: venueType as ExperienceConstraints['venueType'],
      targetPlayerCount,
      deploymentMode:
        deploymentMode === 'home' || deploymentMode === 'commercial'
          ? deploymentMode
          : 'commercial',
    },
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined,
    roomSkeleton:
      record.roomSkeleton && typeof record.roomSkeleton === 'object'
        ? (record.roomSkeleton as RoomSkeleton)
        : undefined,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const parsed = parseBody(await request.json().catch(() => null))
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid request payload', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { constraints, sessionId, roomSkeleton: existingSkeleton } = parsed

  try {
    const upstream = await invokeMasterGenerator(constraints, 'puzzles', sessionId)
    const roomSkeleton = mapExpressSkeletonToRoomSkeleton(
      upstream.roomSkeleton,
      upstream.puzzles,
      existingSkeleton
    )
    const telemetry = mapCouncilReportToTelemetry(upstream.councilReport, constraints, {
      status: 'reviewing',
      generationEngine: upstream.generationEngine,
      lastAction: 'Puzzle package staged — inspect zones for BOM and Arduino previews.',
    })

    return NextResponse.json({
      roomSkeleton,
      councilReport: upstream.councilReport
        ? mapExpressCouncilReport(upstream.councilReport)
        : undefined,
      telemetry,
      sessionId: upstream.sessionId ?? sessionId,
      generationEngine: upstream.generationEngine,
    })
  } catch (err) {
    if (err instanceof MasterGeneratorConfigError) {
      return NextResponse.json({ error: err.message, code: 'BACKEND_NOT_CONFIGURED' }, { status: 503 })
    }
    if (err instanceof MasterGeneratorUpstreamError) {
      return NextResponse.json({ error: err.message, code: 'UPSTREAM_ERROR' }, { status: 502 })
    }
    console.error('[experience-designer/generate-puzzles]', err)
    return NextResponse.json({ error: 'Failed to generate puzzles', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
