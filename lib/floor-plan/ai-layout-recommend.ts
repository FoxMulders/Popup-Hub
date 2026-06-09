/**
 * Claude 3.5 Sonnet layout assessment — evaluate current room layout and
 * suggest coordinate fixes for safety and traffic flow.
 * Server-only; invoked from `/api/layout/recommend`.
 */

import { openRouterChatForTask } from '@/lib/ai/openrouter'
import { detectPlacedObjectOverlaps } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  clipBoothToLocalRoom,
  clampDeltaToRect,
  insetBounds,
  ROOM_PLACEMENT_CLEARANCE_FT,
  wallInsetClearanceFt,
} from '@/lib/floor-plan/boundary-constraints'
import type {
  AiAutoArrangeFixture,
  AiTrafficFlowLoop,
} from '@/lib/floor-plan/ai-auto-arrange'

export interface LayoutRecommendObjectSnapshot {
  id: string
  kind: PlacedObject['kind']
  x: number
  y: number
  width: number
  height: number
  rotation: number
  label?: string
  categoryName?: string | null
}

export interface LayoutRecommendRequest {
  roomName: string
  roomWidthFt: number
  roomLengthFt: number
  aisleWidthFt?: number
  objects: LayoutRecommendObjectSnapshot[]
  fixtures: AiAutoArrangeFixture[]
  trafficFlow?: AiTrafficFlowLoop
}

export interface LayoutRecommendResponse {
  recommendedObjects: LayoutRecommendObjectSnapshot[]
  changelog: string[]
  rationale: string
  model?: string
  usedFallback?: boolean
  overlapWarning?: boolean
}

function buildLayoutRecommendPrompt(input: LayoutRecommendRequest): string {
  const aisleWidthFt = input.aisleWidthFt ?? 8

  const trafficSection = input.trafficFlow
    ? `
TRAFFIC-FLOW LOOP (mandatory — preserve a continuous patron path Entry → Exit):
${JSON.stringify(input.trafficFlow, null, 2)}

TRAFFIC RULES:
- Keep the primary circulation loop ≥ ${aisleWidthFt}' wide with no dead-ends.
- Emergency exits and exit doors must have clear egress paths — never block with booths.
- Orient vendor booth fronts toward the primary loop where possible.
- Patron seating stays in lower-velocity zones, not in primary aisles.`
    : `
DOORS / EXITS (route high-traffic flow through these — avoid bottlenecks):
${JSON.stringify(input.fixtures, null, 2)}`

  return `You are a venue safety and traffic-flow assessor for indoor pop-up markets.

ROOM: "${input.roomName}" — ${input.roomWidthFt}' wide × ${input.roomLengthFt}' long (origin top-left, x→right, y→down, feet).

CURRENT LAYOUT (${input.objects.length} objects — evaluate overlaps, egress, and sightlines):
${JSON.stringify(input.objects, null, 2)}

ENTRY / EXIT FIXTURES:
${JSON.stringify(input.fixtures, null, 2)}
${trafficSection}

TASK:
- Review the CURRENT layout for overlapping objects, blocked emergency paths, narrow aisles, and poor patron sightlines.
- Make MINIMAL coordinate adjustments — prefer small shifts over wholesale rearrangement.
- Return EVERY input object id in recommendedObjects (same count as input).
- Adjust only x, y, and rotation; preserve id, kind, width, height, label, and categoryName.
- Eliminate overlaps between movable objects; maintain ≥ ${aisleWidthFt}' walkways between rows.
- Keep objects inside the room with ${ROOM_PLACEMENT_CLEARANCE_FT}' inset from walls where applicable.
- changelog: specific human-readable bullets (e.g. "Shifted Row B 2 feet north to clear the emergency exit path").
- rationale: one brief paragraph on how the revised layout improves patron sightlines and safety.

Respond with JSON only:
{
  "recommendedObjects": [{ "id", "kind", "x", "y", "width", "height", "rotation", ... }],
  "changelog": [string],
  "rationale": string
}`
}

export function parseLayoutRecommendResponse(
  raw: string,
  sourceObjects: LayoutRecommendObjectSnapshot[]
): LayoutRecommendResponse {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('AI response did not contain JSON')
  }

  const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
    recommendedObjects?: LayoutRecommendObjectSnapshot[]
    changelog?: string[]
    rationale?: string
  }

  if (!Array.isArray(parsed.recommendedObjects) || parsed.recommendedObjects.length === 0) {
    throw new Error('AI response missing recommendedObjects array')
  }

  const rawById = new Map(
    parsed.recommendedObjects.map((rawObj) => [String(rawObj.id), rawObj])
  )
  const recommendedObjects = sourceObjects.map((source) => {
    const rawObj = rawById.get(source.id)
    if (!rawObj) return source
    return {
      ...source,
      x: Number(rawObj.x),
      y: Number(rawObj.y),
      rotation: rawObj.rotation != null ? Number(rawObj.rotation) : source.rotation,
      width: Number(rawObj.width ?? source.width),
      height: Number(rawObj.height ?? source.height),
      kind: (rawObj.kind ?? source.kind) as PlacedObject['kind'],
      label: rawObj.label ?? source.label,
      categoryName: rawObj.categoryName ?? source.categoryName,
    }
  })

  const changelog = Array.isArray(parsed.changelog)
    ? parsed.changelog.map((line) => String(line).trim()).filter(Boolean)
    : []

  const rationale =
    typeof parsed.rationale === 'string' && parsed.rationale.trim()
      ? parsed.rationale.trim()
      : 'Layout adjustments improve circulation and safety.'

  return { recommendedObjects, changelog, rationale }
}

function clipObjectToLocalRoom(
  obj: LayoutRecommendObjectSnapshot,
  roomW: number,
  roomH: number
): LayoutRecommendObjectSnapshot {
  if (obj.kind === 'booth') {
    const clipped = clipBoothToLocalRoom(
      obj as PlacedObject & { kind: 'booth' },
      roomW,
      roomH
    )
    return {
      ...obj,
      x: clipped.x,
      y: clipped.y,
    }
  }

  const clearance = wallInsetClearanceFt(obj as PlacedObject)
  const inner = insetBounds(
    { minX: 0, minY: 0, maxX: roomW, maxY: roomH },
    clearance
  )
  if (inner.width <= 0 || inner.height <= 0) return obj
  const { dx, dy } = clampDeltaToRect(obj, inner)
  if (dx === 0 && dy === 0) return obj
  return { ...obj, x: obj.x + dx, y: obj.y + dy }
}

/** Merge AI coordinates onto source snapshots; clip to room bounds. */
export function applyRecommendedCoordinates(
  sourceObjects: LayoutRecommendObjectSnapshot[],
  recommendedObjects: LayoutRecommendObjectSnapshot[],
  roomW: number,
  roomH: number
): { objects: LayoutRecommendObjectSnapshot[]; overlapWarning: boolean } {
  const byId = new Map(recommendedObjects.map((o) => [o.id, o]))
  const objects = sourceObjects.map((source) => {
    const rec = byId.get(source.id)
    if (!rec) return source
    const merged = {
      ...source,
      x: rec.x,
      y: rec.y,
      rotation: rec.rotation ?? source.rotation,
    }
    return clipObjectToLocalRoom(merged, roomW, roomH)
  })

  const overlapSet = detectPlacedObjectOverlaps(objects as PlacedObject[])
  return { objects, overlapWarning: overlapSet.size > 0 }
}

export async function recommendLayoutWithAi(
  input: LayoutRecommendRequest
): Promise<LayoutRecommendResponse> {
  const aisleWidthFt = input.aisleWidthFt ?? 8
  const payload: LayoutRecommendRequest = { ...input, aisleWidthFt }

  const result = await openRouterChatForTask({
    task: 'layout_recommend',
    jsonMode: true,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You assess indoor market floor plans for safety and traffic flow. Output strict JSON with recommendedObjects (full object list), changelog, and rationale. Coordinates in feet, top-left origin.',
      },
      { role: 'user', content: buildLayoutRecommendPrompt(payload) },
    ],
  })

  const parsed = parseLayoutRecommendResponse(result.content, input.objects)
  const { objects, overlapWarning } = applyRecommendedCoordinates(
    input.objects,
    parsed.recommendedObjects,
    input.roomWidthFt,
    input.roomLengthFt
  )

  return {
    recommendedObjects: objects,
    changelog: parsed.changelog,
    rationale: parsed.rationale,
    model: result.model,
    usedFallback: result.usedFallback,
    overlapWarning,
  }
}
