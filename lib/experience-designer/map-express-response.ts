import type {
  CouncilTelemetry,
  ExperienceConstraints,
  RoomSkeleton,
  RoomZone,
  ZoneBomLine,
  ZoneConnection,
} from '@/lib/experience-designer/types'
import type {
  ExpressCouncilReport,
  ExpressPuzzle,
  ExpressRoomSkeleton,
  ExpressRoomZone,
} from '@/lib/experience-designer/express-types'

const THEME_LABELS: Record<ExperienceConstraints['theme'], string> = {
  haunted_manor: 'Haunted Manor',
  cyber_heist: 'Cyber Heist',
  pirate_vault: 'Pirate Vault',
  space_station: 'Space Station',
}

function inferZoneType(
  zone: ExpressRoomZone,
  index: number,
  total: number
): RoomZone['zoneType'] {
  const name = zone.name.toLowerCase()
  if (index === 0 || name.includes('entry') || name.includes('brief')) return 'entry'
  if (index === total - 1 || name.includes('finale') || name.includes('climax') || name.includes('exit')) {
    return 'climax'
  }
  if (name.includes('corridor') || name.includes('transition') || name.includes('hall')) return 'corridor'
  if (name.includes('control') || name.includes('reset') || name.includes('utility') || name.includes('staff')) {
    return 'utility'
  }
  return 'puzzle'
}

function connectionId(from: string, to: string): string {
  return `edge-${from}-${to}`
}

export function deriveConnectionsFromExpressSkeleton(
  skeleton: ExpressRoomSkeleton
): ZoneConnection[] {
  const zones = skeleton.zones.filter((z) => z.zone_id.trim())
  if (zones.length < 2) return []

  if (skeleton.flow_pattern === 'nonlinear_open') {
    const hub = zones[0]
    return zones.slice(1).map((zone) => ({
      id: connectionId(hub.zone_id, zone.zone_id),
      fromZoneId: hub.zone_id,
      toZoneId: zone.zone_id,
    }))
  }

  const connections: ZoneConnection[] = []
  for (let i = 0; i < zones.length - 1; i += 1) {
    connections.push({
      id: connectionId(zones[i].zone_id, zones[i + 1].zone_id),
      fromZoneId: zones[i].zone_id,
      toZoneId: zones[i + 1].zone_id,
      label: skeleton.flow_pattern === 'multilinear' && i > 0 && i % 2 === 0 ? 'merge' : undefined,
    })
  }
  return connections
}

function parseBomLine(raw: string, index: number): ZoneBomLine {
  const trimmed = raw.trim()
  const quantityMatch = trimmed.match(/^(\d+)\s*[x×]\s*(.+)$/i)
  const name = quantityMatch?.[2]?.trim() ?? trimmed
  const quantity = quantityMatch ? Number.parseInt(quantityMatch[1], 10) : 1
  const sku = `GEN-${index + 1}`
  return {
    sku,
    name,
    quantity: Number.isFinite(quantity) ? quantity : 1,
    unitCostCents: 0,
  }
}

function mergePuzzleIntoZone(zone: RoomZone, puzzle: ExpressPuzzle): RoomZone {
  const bomSources = [
    ...(puzzle.bill_of_materials ?? []),
    ...(puzzle.required_parts_and_props ?? []),
    ...(puzzle.electronicDetails?.parts ?? []),
  ]

  return {
    ...zone,
    puzzleTitle: puzzle.title,
    puzzleSummary: puzzle.howItWorks ?? puzzle.objective ?? zone.puzzleSummary,
    bom: bomSources.length
      ? bomSources.map((line, index) => parseBomLine(line, index))
      : zone.bom,
    arduinoCode: puzzle.electronicDetails?.arduinoCode ?? zone.arduinoCode,
  }
}

export function mapExpressSkeletonToRoomSkeleton(
  skeleton: ExpressRoomSkeleton,
  puzzles?: ExpressPuzzle[],
  existing?: RoomSkeleton | null
): RoomSkeleton {
  const positionById = new Map(
    (existing?.zones ?? []).map((zone) => [zone.id, zone.position] as const)
  )

  const zones: RoomZone[] = skeleton.zones
    .filter((zone) => zone.zone_id.trim() && zone.name.trim())
    .map((zone, index, list) => ({
      id: zone.zone_id,
      name: zone.name,
      zoneType: inferZoneType(zone, index, list.length),
      position: positionById.get(zone.zone_id) ?? { x: 0, y: 0 },
      puzzleSummary: zone.primary_player_action,
    }))

  const puzzleZones = zones.filter((z) => z.zoneType === 'puzzle' || z.zoneType === 'climax')
  const puzzleList = puzzles ?? []
  puzzleList.forEach((puzzle, index) => {
    const target = puzzleZones[index]
    if (!target) return
    const zoneIndex = zones.findIndex((z) => z.id === target.id)
    if (zoneIndex >= 0) zones[zoneIndex] = mergePuzzleIntoZone(zones[zoneIndex], puzzle)
  })

  return {
    zones,
    connections: deriveConnectionsFromExpressSkeleton(skeleton),
    flowPattern: skeleton.flow_pattern,
    flowSummary: skeleton.flow_summary,
    generatedAt: new Date().toISOString(),
  }
}

export function mapCouncilReportToTelemetry(
  report: ExpressCouncilReport | undefined,
  constraints: ExperienceConstraints,
  opts?: {
    status?: CouncilTelemetry['councilStatus']
    tokensUsed?: number
    lastAction?: string
    generationEngine?: string
  }
): CouncilTelemetry {
  const themeLabel = THEME_LABELS[constraints.theme]
  const verdicts = report?.verdicts ?? []
  const activeAgents = verdicts.length
    ? verdicts.map((v) => v.title)
    : report
      ? ['Council Chair']
      : []

  const consensusScore = report
    ? Math.round(Math.min(100, Math.max(0, (report.averageScore / 10) * 100)))
    : 0

  const councilStatus =
    opts?.status ??
    (report?.passed ? 'ready' : report ? 'reviewing' : 'idle')

  const mappedReport = report
    ? {
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
    : undefined

  return {
    councilStatus,
    activeAgents,
    consensusScore,
    tokensUsed: opts?.tokensUsed ?? 0,
    lastAction:
      opts?.lastAction ??
      (report
        ? report.passed
          ? `${themeLabel} skeleton approved — ${report.wowCount}/10 council wow votes (avg ${report.averageScore.toFixed(1)}/10).`
          : `Council revision ${report.iterations} — ${report.revisionNotes ?? 'Awaiting consensus.'}`
        : undefined),
    councilReport: mappedReport,
    generationEngine: opts?.generationEngine,
  }
}
