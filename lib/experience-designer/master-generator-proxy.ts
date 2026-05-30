import type { ExperienceConstraints } from '@/lib/experience-designer/types'
import type {
  ExpressCouncilReport,
  ExpressPuzzle,
  ExpressRoomSkeleton,
  ExpressTargetInterface,
  MasterGeneratorApiRequest,
  MasterGeneratorApiResponse,
} from '@/lib/experience-designer/express-types'

const DEVICE_ID = 'popup-hub-experience-designer'

export class MasterGeneratorConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MasterGeneratorConfigError'
  }
}

export class MasterGeneratorUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'MasterGeneratorUpstreamError'
  }
}

function resolveBackendBaseUrl(): string {
  const base =
    process.env.MASTER_GENERATOR_API_URL?.trim() ||
    process.env.TFE_BACKEND_URL?.trim() ||
    process.env.EXPERIENCE_DESIGNER_API_URL?.trim()
  if (!base) {
    throw new MasterGeneratorConfigError(
      'Master Generator backend is not configured. Set MASTER_GENERATOR_API_URL to your Express server base URL (e.g. http://localhost:4000).'
    )
  }
  return base.replace(/\/$/, '')
}

function resolveServiceToken(): string | undefined {
  const token =
    process.env.MASTER_GENERATOR_SERVICE_TOKEN?.trim() ||
    process.env.TFE_SERVICE_TOKEN?.trim()
  return token || undefined
}

function toTargetInterface(constraints: ExperienceConstraints): ExpressTargetInterface {
  return constraints.deploymentMode === 'home' ? 'home_party' : 'commercial_venue'
}

function backendHeaders(): HeadersInit {
  const token = resolveServiceToken()
  return {
    'Content-Type': 'application/json',
    'X-Device-Id': DEVICE_ID,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function backendFetch<T>(path: string, init: RequestInit): Promise<T> {
  const base = resolveBackendBaseUrl()
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...backendHeaders(), ...(init.headers ?? {}) },
  })

  const data = (await response.json().catch(() => null)) as
    | T
    | { error?: { message?: string; code?: string } | string }
    | null

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? typeof data.error === 'string'
          ? data.error
          : data.error?.message ?? `Upstream error (${response.status})`
        : `Upstream error (${response.status})`
    throw new MasterGeneratorUpstreamError(message, response.status)
  }

  return data as T
}

const VENUE_ENVIRONMENT: Record<ExperienceConstraints['venueType'], string> = {
  popup_trailer: 'Mobile popup trailer',
  warehouse: 'Warehouse bay',
  retail_suite: 'Retail suite',
  outdoor_pavilion: 'Outdoor pavilion',
}

const THEME_LABELS: Record<ExperienceConstraints['theme'], string> = {
  haunted_manor: 'Haunted Manor',
  cyber_heist: 'Cyber Heist',
  pirate_vault: 'Pirate Vault',
  space_station: 'Space Station',
}

const THEME_DESCRIPTIONS: Record<ExperienceConstraints['theme'], string> = {
  haunted_manor:
    'Victorian haunted estate with hidden passages, séance props, and atmospheric lighting.',
  cyber_heist: 'Neon corporate vault with RFID locks, relay panels, and coordinated team hacks.',
  pirate_vault: 'Shipwreck treasure hold with mechanical rigging puzzles and map fragments.',
  space_station: 'Orbital lab breach with airlock sequences and sensor calibration tasks.',
}

async function callDedicatedMasterGenerator(
  body: MasterGeneratorApiRequest
): Promise<MasterGeneratorApiResponse | null> {
  try {
    return await backendFetch<MasterGeneratorApiResponse>('/api/master-generator', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (err) {
    if (err instanceof MasterGeneratorUpstreamError && err.status === 404) {
      return null
    }
    throw err
  }
}

async function createPlanningSession(constraints: ExperienceConstraints): Promise<string> {
  const targetInterface = toTargetInterface(constraints)
  const data = await backendFetch<{ sessionId: string }>('/api/planning/session', {
    method: 'POST',
    body: JSON.stringify({
      playersConcurrent: constraints.targetPlayerCount,
      participantsTotal: constraints.targetPlayerCount,
      sessionDurationMinutes: 45,
      environmentType: VENUE_ENVIRONMENT[constraints.venueType],
      availableItems: ['Tables', 'Chairs', 'Extension cords', 'Tape', 'Locks'],
      existingPuzzles: [],
      targetInterface,
      operatingMode: constraints.deploymentMode === 'home' ? 'home' : 'venue',
      roomDifficulty: 'medium',
    }),
  })
  return data.sessionId
}

async function pickThemeId(sessionId: string, constraints: ExperienceConstraints): Promise<string> {
  const themesPayload = await backendFetch<{ themes?: { id: string; name: string }[] }>(
    '/api/themes/generate',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }
  )

  const themes = themesPayload.themes ?? []
  const label = THEME_LABELS[constraints.theme].toLowerCase()
  const matched =
    themes.find((theme) => theme.name.toLowerCase().includes(label.split(' ')[0] ?? '')) ??
    themes[0]

  if (matched?.id) return matched.id

  const custom = await backendFetch<{ theme: { id: string } }>('/api/themes/custom', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      name: THEME_LABELS[constraints.theme],
      description: THEME_DESCRIPTIONS[constraints.theme],
    }),
  })
  return custom.theme.id
}

interface PuzzlesGeneratePayload {
  roomSkeleton?: ExpressRoomSkeleton
  councilReport?: ExpressCouncilReport
  puzzles?: ExpressPuzzle[]
  generationEngine?: string
  error?: { message?: string }
}

async function orchestrateViaPuzzlesGenerate(
  constraints: ExperienceConstraints,
  mode: MasterGeneratorApiRequest['mode'],
  existingSessionId?: string
): Promise<MasterGeneratorApiResponse & { sessionId: string }> {
  const sessionId = existingSessionId ?? (await createPlanningSession(constraints))
  const themeId = await pickThemeId(sessionId, constraints)

  const payload = await backendFetch<PuzzlesGeneratePayload>('/api/puzzles/generate', {
    method: 'POST',
    body: JSON.stringify({ sessionId, themeId }),
  })

  if (!payload.roomSkeleton?.zones?.length) {
    throw new MasterGeneratorUpstreamError(
      payload.error?.message ?? 'Express backend did not return a room skeleton.',
      502
    )
  }

  return {
    roomSkeleton: payload.roomSkeleton,
    councilReport: payload.councilReport,
    puzzles: mode === 'puzzles' ? payload.puzzles : undefined,
    generationEngine: payload.generationEngine,
    sessionId,
  }
}

export async function invokeMasterGenerator(
  constraints: ExperienceConstraints,
  mode: MasterGeneratorApiRequest['mode'],
  existingSessionId?: string
): Promise<MasterGeneratorApiResponse & { sessionId?: string }> {
  const request: MasterGeneratorApiRequest = {
    theme: constraints.theme,
    venueType: constraints.venueType,
    targetPlayerCount: constraints.targetPlayerCount,
    targetInterface: toTargetInterface(constraints),
    mode,
    sessionId: existingSessionId,
  }

  const dedicated = await callDedicatedMasterGenerator(request)
  if (dedicated?.roomSkeleton?.zones?.length) {
    return { ...dedicated, sessionId: existingSessionId }
  }

  return orchestrateViaPuzzlesGenerate(constraints, mode, existingSessionId)
}
