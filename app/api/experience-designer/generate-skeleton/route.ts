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
import type { ExperienceConstraints } from '@/lib/experience-designer/types'
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

function parseConstraints(body: unknown): ExperienceConstraints | null {
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
    theme: theme as ExperienceConstraints['theme'],
    venueType: venueType as ExperienceConstraints['venueType'],
    targetPlayerCount,
    deploymentMode:
      deploymentMode === 'home' || deploymentMode === 'commercial'
        ? deploymentMode
        : 'commercial',
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

  const body = await request.json().catch(() => null)
  const constraints = parseConstraints(body)
  if (!constraints) {
    return NextResponse.json({ error: 'Invalid constraints payload', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const sessionId =
    body && typeof body === 'object' && typeof (body as { sessionId?: unknown }).sessionId === 'string'
      ? (body as { sessionId: string }).sessionId
      : undefined

  try {
    const upstream = await invokeMasterGenerator(constraints, 'skeleton', sessionId)
    const roomSkeleton = mapExpressSkeletonToRoomSkeleton(upstream.roomSkeleton)
    const telemetry = mapCouncilReportToTelemetry(upstream.councilReport, constraints, {
      status: upstream.councilReport?.passed ? 'ready' : 'reviewing',
      generationEngine: upstream.generationEngine,
    })

    return NextResponse.json({
      roomSkeleton,
      councilReport: upstream.councilReport
        ? mapExpressCouncilReport(upstream.councilReport)
        : undefined,
      telemetry,
      sessionId: upstream.sessionId,
      generationEngine: upstream.generationEngine,
    })
  } catch (err) {
    if (err instanceof MasterGeneratorConfigError) {
      return NextResponse.json({ error: err.message, code: 'BACKEND_NOT_CONFIGURED' }, { status: 503 })
    }
    if (err instanceof MasterGeneratorUpstreamError) {
      return NextResponse.json({ error: err.message, code: 'UPSTREAM_ERROR' }, { status: 502 })
    }
    console.error('[experience-designer/generate-skeleton]', err)
    return NextResponse.json({ error: 'Failed to generate skeleton', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
