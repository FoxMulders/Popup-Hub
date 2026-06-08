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
  x: number
  y: number
  width: number
  height: number
  kind: 'door' | 'emergency_exit'
  doorType?: 'entrance' | 'exit'
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
        : 'Mix vendor booths and patron tables with clear separation.'

  return `You are a venue layout optimizer for indoor pop-up markets.

ROOM: "${input.roomName}" — ${input.roomWidthFt}' wide × ${input.roomLengthFt}' long (origin top-left, x→right, y→down, feet).
MODE: ${input.mode} — ${MODE_GUIDANCE[input.mode]}
SCOPE: ${input.scope}. ${patronNote}

OBJECTS TO PLACE (${input.items.length}):
${JSON.stringify(input.items, null, 2)}

FIXED OBSTACLES (do not overlap — include ${ROOM_PLACEMENT_CLEARANCE_FT}' clearance):
${JSON.stringify(input.obstacles, null, 2)}

DOORS / EXITS (route high-traffic flow through these — avoid dead-ends and bottlenecks):
${JSON.stringify(input.fixtures, null, 2)}

CONSTRAINTS:
- Every placement must keep the full ${ROOM_PLACEMENT_CLEARANCE_FT}' inset from walls: x ≥ ${ROOM_PLACEMENT_CLEARANCE_FT}, y ≥ ${ROOM_PLACEMENT_CLEARANCE_FT}, x+width ≤ ${input.roomWidthFt - ROOM_PLACEMENT_CLEARANCE_FT}, y+height ≤ ${input.roomLengthFt - ROOM_PLACEMENT_CLEARANCE_FT}.
- Maintain ≥ ${input.aisleWidthFt}' clear walkways between rows and around clusters.
- Maximize vendor visibility from main aisles; patrons should see booth fronts without weaving through dead-ends.
- Route traffic from entrance doors toward vendor tables and exits without narrow choke points.
- Same-category vendors should cluster when space allows but never violate aisle width.
- Return EXACTLY one placement per item id; coordinates are top-left corner in feet.

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

/** Apply AI placements to booth objects in room-local coordinates; clip out-of-bounds slots. */
export function applyAiPlacementsToBooths(
  booths: BoothObject[],
  placements: AiAutoArrangePlacement[],
  roomW: number,
  roomH: number
): { booths: BoothObject[]; clippedCount: number } {
  const byId = new Map(placements.map((p) => [p.id, p]))
  let clippedCount = 0
  const updated = booths.map((booth) => {
    const slot = byId.get(booth.id)
    if (!slot) return booth
    const before = { ...booth, x: slot.x, y: slot.y, rotation: slot.rotation ?? booth.rotation ?? 0 }
    const after = clipBoothToLocalRoom(before, roomW, roomH)
    if (after.x !== slot.x || after.y !== slot.y) clippedCount++
    return after
  })
  return { booths: updated, clippedCount }
}

export function isPatronBooth(b: BoothObject): boolean {
  return isGuestTableBooth(b)
}
