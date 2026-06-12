/**
 * Gemini 2.5 Pro auto-arrange optimization — room analysis → coordinate array.
 * Server-only; invoked from `/api/coordinator/auto-arrange`.
 */

import { openRouterChatForTask } from '@/lib/ai/openrouter'
import type { AutoArrangeMode, AutoArrangeScope } from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import {
  clipBoothToLocalRoom,
  ROOM_PLACEMENT_CLEARANCE_FT,
} from '@/lib/floor-plan/boundary-constraints'
import {
  MIN_CLEARANCE_FT,
  validateBoothAgainstPlaced,
} from '@/lib/booth-planner/expanded-footprint'
import { rotatedAabb } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'

export interface AiAutoArrangeItem {
  id: string
  width: number
  height: number
  category?: string
  isPatron: boolean
}

export interface AiAutoArrangeObstacle {
  x: number
  y: number
  width: number
  height: number
  kind: string
}

export interface AiAutoArrangeFixture {
  id?: string
  role?: 'entry' | 'exit'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  centerX: number
  centerY: number
  wallEdge?: 'top' | 'right' | 'bottom' | 'left'
  kind: 'door' | 'emergency_exit'
  doorType?: 'entrance' | 'exit'
}

export interface AiTrafficFlowLoop {
  entryPoints: Array<{ x: number; y: number; wallEdge: string }>
  exitPoints: Array<{ x: number; y: number; wallEdge: string }>
  /** Instruct the model to route patrons entry → vendors → exit without dead-ends. */
  primaryPathHint: string
}

export interface AiAutoArrangeRequest {
  roomName: string
  roomWidthFt: number
  roomLengthFt: number
  mode: AutoArrangeMode
  scope: AutoArrangeScope
  aisleWidthFt: number
  items: AiAutoArrangeItem[]
  obstacles: AiAutoArrangeObstacle[]
  fixtures: AiAutoArrangeFixture[]
  trafficFlow?: AiTrafficFlowLoop
}

export interface AiAutoArrangePlacement {
  id: string
  x: number
  y: number
  rotation?: number
}

export interface AiAutoArrangeResponse {
  placements: AiAutoArrangePlacement[]
  rationale?: string
  model?: string
  usedFallback?: boolean
}

const MODE_GUIDANCE: Record<AutoArrangeMode, string> = {
  grid: 'Align booths in clear rows and columns with uniform aisles (~8 ft). Prioritize sightlines down each aisle.',
  staggered:
    'Use alternating half-row offsets (brick pattern) so patron sightlines peek between vendor rows.',
  'perimeter-only':
    'Place booths flush along the room perimeter loop (top → right → bottom → left), backs to walls, openings inward.',
}

function buildOptimizationPrompt(input: AiAutoArrangeRequest): string {
  const patronNote =
    input.scope === 'patron'
      ? 'These are PATRON seating tables — keep them grouped away from vendor zones with walking buffers.'
      : input.scope === 'vendor'
        ? 'These are VENDOR booths — maximize perimeter visibility and category spread.'
        : 'Place ALL vendor booths AND patron seating tables in one coordinated layout — vendor and patron assets must never overwrite each other.'

  const trafficSection = input.trafficFlow
    ? `
TRAFFIC-FLOW LOOP (mandatory — plot a continuous patron path from Entry to Exit):
${JSON.stringify(input.trafficFlow, null, 2)}

TRAFFIC RULES:
- Design a continuous traffic loop from each Entry point through the hall to each Exit point.
- Orient every VENDOR booth (isPatron=false) so its storefront/open side faces this primary circulation path.
- Place PATRON zones (isPatron=true) in secondary, low-velocity areas — room center, designated food corners, or zones offset from the main vendor aisle — so seating never bottlenecks the primary loop.
- Keep the primary loop ≥ ${input.aisleWidthFt}' wide with no dead-ends between Entry and Exit.`
    : `
DOORS / EXITS (route high-traffic flow through these — avoid dead-ends and bottlenecks):
${JSON.stringify(input.fixtures, null, 2)}`

  return `You are a venue layout optimizer for indoor pop-up markets.

ROOM: "${input.roomName}" — ${input.roomWidthFt}' wide × ${input.roomLengthFt}' long (origin top-left, x→right, y→down, feet).
MODE: ${input.mode} — ${MODE_GUIDANCE[input.mode]}
SCOPE: ${input.scope}. ${patronNote}

OBJECTS TO PLACE (${input.items.length}):
${JSON.stringify(input.items, null, 2)}

FIXED OBSTACLES (do not overlap — include ${ROOM_PLACEMENT_CLEARANCE_FT}' clearance):
${JSON.stringify(input.obstacles, null, 2)}

ENTRY / EXIT FIXTURES (exact coordinates and orientations — already snapped to perimeter walls):
${JSON.stringify(input.fixtures, null, 2)}
${trafficSection}

CONSTRAINTS:
- Every VENDOR booth (isPatron=false) must keep at least ${MIN_CLEARANCE_FT}' between its footprint and room walls: x ≥ ${MIN_CLEARANCE_FT}, y ≥ ${MIN_CLEARANCE_FT}, x+width ≤ ${input.roomWidthFt - MIN_CLEARANCE_FT}, y+height ≤ ${input.roomLengthFt - MIN_CLEARANCE_FT}.
- Maintain at least ${MIN_CLEARANCE_FT * 2}' edge-to-edge spacing between vendor booth footprints (treat each booth as width+6' × length+6' for collision).
- Patron tables (isPatron=true) keep ${ROOM_PLACEMENT_CLEARANCE_FT}' wall inset where applicable.
- Maintain ≥ ${input.aisleWidthFt}' clear walkways between rows and around clusters.
- Maximize vendor visibility from the primary traffic loop; patrons should see booth fronts without weaving through dead-ends.
- Same-category vendors should cluster when space allows but never violate aisle width.
- Return EXACTLY one placement per item id; coordinates are top-left corner in feet; rotation in degrees.

Respond with JSON only:
{
  "placements": [{ "id": string, "x": number, "y": number, "rotation": number }],
  "rationale": string
}`
}

export function parseAiLayoutResponse(raw: string): AiAutoArrangeResponse {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('AI response did not contain JSON')
  }
  const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
    placements?: AiAutoArrangePlacement[]
    rationale?: string
  }
  if (!Array.isArray(parsed.placements) || parsed.placements.length === 0) {
    throw new Error('AI response missing placements array')
  }
  return {
    placements: parsed.placements.map((p) => ({
      id: String(p.id),
      x: Number(p.x),
      y: Number(p.y),
      rotation: p.rotation != null ? Number(p.rotation) : 0,
    })),
    rationale: parsed.rationale,
  }
}

export async function optimizeLayoutWithAi(
  input: AiAutoArrangeRequest
): Promise<AiAutoArrangeResponse> {
  const result = await openRouterChatForTask({
    task: 'auto_arrange_layout',
    jsonMode: true,
    temperature: 0.15,
    messages: [
      {
        role: 'system',
        content:
          'You optimize indoor market floor plans. Output strict JSON with a placements array. All coordinates in feet, top-left origin.',
      },
      { role: 'user', content: buildOptimizationPrompt(input) },
    ],
  })

  const parsed = parseAiLayoutResponse(result.content)
  return {
    ...parsed,
    model: result.model,
    usedFallback: result.usedFallback,
  }
}

/** Apply AI placements to booth objects in room-local coordinates; reject invalid slots. */
export function applyAiPlacementsToBooths(
  booths: BoothObject[],
  placements: AiAutoArrangePlacement[],
  roomW: number,
  roomH: number
): { booths: BoothObject[]; clippedCount: number; rejectedCount: number } {
  const byId = new Map(placements.map((p) => [p.id, p]))
  let clippedCount = 0
  let rejectedCount = 0
  const placedRects: Array<{ x: number; y: number; width: number; height: number }> = []
  const updated = booths.map((booth) => {
    const slot = byId.get(booth.id)
    if (!slot) return booth
    const candidate: BoothObject = {
      ...booth,
      x: slot.x,
      y: slot.y,
      rotation: slot.rotation ?? booth.rotation ?? 0,
    }
    const raw = rotatedAabb(candidate)
    if (!validateBoothAgainstPlaced(raw, roomW, roomH, placedRects)) {
      rejectedCount++
      return booth
    }
    const after = clipBoothToLocalRoom(candidate, roomW, roomH)
    if (after.x !== slot.x || after.y !== slot.y) clippedCount++
    placedRects.push(rotatedAabb(after))
    return after
  })
  return { booths: updated, clippedCount, rejectedCount }
}

export function isPatronBooth(b: BoothObject): boolean {
  return isGuestTableBooth(b)
}
