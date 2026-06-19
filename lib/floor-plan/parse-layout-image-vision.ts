import { z } from 'zod'
import { generateJsonFromVision } from '@/lib/ai/generate-json-vision'

const layoutImageBoothSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().optional(),
  label: z.string().nullable().optional(),
})

const layoutImageFixtureSchema = z.object({
  kind: z.enum(['wall', 'door', 'emergency_exit', 'stage', 'label']),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().optional(),
  label: z.string().nullable().optional(),
})

export const parsedLayoutImageSchema = z.object({
  roomWidthFt: z.number().positive().nullable(),
  roomLengthFt: z.number().positive().nullable(),
  booths: z.array(layoutImageBoothSchema).default([]),
  fixtures: z.array(layoutImageFixtureSchema).default([]),
  notes: z.string().nullable().optional(),
})

export type ParsedLayoutImage = z.infer<typeof parsedLayoutImageSchema>

const LAYOUT_VISION_SYSTEM =
  'You read floor plan drawings and market layout sketches. Output strict JSON only — no markdown.'

function buildLayoutVisionPrompt(roomWidthFt?: number, roomLengthFt?: number): string {
  const dims =
    roomWidthFt && roomLengthFt
      ? `Known room size: ${roomWidthFt}' × ${roomLengthFt}'. Place coordinates in feet from top-left origin.`
      : 'Estimate coordinates in feet; include roomWidthFt and roomLengthFt if visible on the drawing.'

  return `Analyze this market / venue floor plan image.
${dims}

Return JSON:
{
  "roomWidthFt": number | null,
  "roomLengthFt": number | null,
  "booths": [{ "x", "y", "width", "height", "rotation?", "label?" }],
  "fixtures": [{ "kind": "wall"|"door"|"emergency_exit"|"stage"|"label", "x", "y", "width", "height", "rotation?", "label?" }],
  "notes": string | null
}

Rules:
- booths: vendor tables / booth rectangles only (typical 6–10 ft wide).
- fixtures: walls, doors, exits, stage, text labels.
- All units in feet; rotation in degrees clockwise.
- If unclear, return empty arrays and explain in notes.`
}

export async function parseLayoutImageWithVision(input: {
  buffer: Buffer
  mimeType: string
  roomWidthFt?: number
  roomLengthFt?: number
}): Promise<ParsedLayoutImage> {
  const dataUrl = `data:${input.mimeType};base64,${input.buffer.toString('base64')}`
  const { content } = await generateJsonFromVision({
    task: 'spatial_vision',
    systemPrompt: LAYOUT_VISION_SYSTEM,
    userPrompt: buildLayoutVisionPrompt(input.roomWidthFt, input.roomLengthFt),
    dataUrl,
    mimeType: input.mimeType,
  })

  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    return { roomWidthFt: null, roomLengthFt: null, booths: [], fixtures: [], notes: 'Could not parse vision response' }
  }

  const parsed = parsedLayoutImageSchema.safeParse(raw)
  if (!parsed.success) {
    return { roomWidthFt: null, roomLengthFt: null, booths: [], fixtures: [], notes: 'Invalid layout structure from vision' }
  }
  return parsed.data
}
