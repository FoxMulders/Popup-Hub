import { parsedFlyerSchema, type ParsedFlyerResponse } from '@/lib/flyer/types'
import { normalizeFlyerDate, normalizeFlyerTime } from '@/lib/flyer/normalize'

const FLYER_PARSE_PROMPT = `You extract structured event details from a market or quarter-auction flyer/poster image.
Return ONLY valid JSON with these keys (use null when not visible or uncertain):
{
  "eventName": string | null,
  "date": string | null,
  "startTime": string | null,
  "endTime": string | null,
  "location": string | null,
  "description": string | null,
  "ticketPrice": string | null
}
Rules:
- date: prefer ISO YYYY-MM-DD
- startTime/endTime: 24-hour HH:mm when possible, else clear 12-hour text
- location: venue name and address combined in one string if needed
- description: 1-3 sentence summary for vendors/shoppers, not raw OCR dump
- ticketPrice: admission, booth fee, or ticket price as printed (include currency symbol if shown)`

function fileToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

function heuristicFromFilename(fileName: string): ParsedFlyerResponse {
  const base = fileName.replace(/\.[^.]+$/, '')
  const dateMatch =
    base.match(/(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})/) ??
    base.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/)

  let date: string | null = null
  if (dateMatch) {
    if (dateMatch[1].length === 4) {
      date = normalizeFlyerDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
    } else {
      date = normalizeFlyerDate(`${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`)
    }
  }

  const eventName = base
    .replace(/(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})/, '')
    .replace(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/, '')
    .replace(/[-_]+/g, ' ')
    .trim()

  return parsedFlyerSchema.parse({
    eventName: eventName.length > 3 ? eventName : null,
    date,
    startTime: null,
    endTime: null,
    location: null,
    description: null,
    ticketPrice: null,
  })
}

export async function parseFlyerWithVision(input: {
  buffer: Buffer
  mimeType: string
  fileName: string
}): Promise<{ data: ParsedFlyerResponse; source: 'openai' | 'heuristic' }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    return { data: heuristicFromFilename(input.fileName), source: 'heuristic' }
  }

  const dataUrl = fileToDataUrl(input.buffer, input.mimeType)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_FLYER_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: FLYER_PARSE_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('[parse-flyer] OpenAI error', response.status, detail)
    throw new Error('Flyer vision parse failed')
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Empty flyer parse response')
  }

  const raw = JSON.parse(content) as unknown
  const data = parsedFlyerSchema.parse(raw)

  return {
    data: parsedFlyerSchema.parse({
      eventName: data.eventName ?? null,
      date: normalizeFlyerDate(data.date ?? null) ?? data.date ?? null,
      startTime: normalizeFlyerTime(data.startTime ?? null) ?? data.startTime ?? null,
      endTime: normalizeFlyerTime(data.endTime ?? null) ?? data.endTime ?? null,
      location: data.location ?? null,
      description: data.description ?? null,
      ticketPrice: data.ticketPrice ?? null,
    }),
    source: 'openai',
  }
}
