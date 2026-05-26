import { parsedFlyerSchema, type ParsedFlyerResponse } from '@/lib/flyer/types'
import { normalizeFlyerDate, normalizeFlyerTime } from '@/lib/flyer/normalize'

/**
 * Vision prompt for OpenAI's vision-capable chat completions endpoint.
 *
 * The prompt is intentionally strict about reading the *visual text* on the
 * flyer (largest title block, headline market name, printed street address)
 * so the wizard can populate event name + address directly from the poster
 * — not from the uploaded filename or the host organization tagline. The
 * test flyer "3rd Annual Christmas Market" hosted by the Slovenian Canadian
 * Association at 16703 - 66 Street NW must yield:
 *   { eventName: "Christmas Market", venueName: "Slovenian Hall" (or similar),
 *     address: "16703 - 66 Street NW, Edmonton, AB" }
 */
const FLYER_PARSE_PROMPT = `You are an OCR + extraction model that reads market and quarter-auction event posters.
Carefully READ the visible printed text on the flyer image. Do NOT guess from filenames or context outside the image.

Return ONLY valid JSON with these keys (use null when the value is not visible or you are uncertain):
{
  "eventName": string | null,
  "venueName": string | null,
  "address": string | null,
  "date": string | null,
  "startTime": string | null,
  "endTime": string | null,
  "description": string | null,
  "ticketPrice": string | null
}

Rules:
- eventName: the actual MARKET / EVENT TITLE printed on the poster — usually the largest stylised text block (e.g. "Christmas Market", "Spring Bazaar", "Summer Craft Fair"). Strip prefixes like "3rd Annual", "The", "Annual", and the host organization name. Never use the host association's name as the event name. Never use the uploaded file's name. If only an organization name is visible and no distinct event title, return null.
- venueName: the building / hall / venue name printed on the flyer (e.g. "Slovenian Hall", "Servus Place", "St Albert Community Centre"). The hosting association's name counts ONLY when the venue itself isn't separately printed. Do not include the street address here.
- address: the printed street address as written on the flyer, including unit / suite if present. Combine multi-line addresses into a single comma-separated string. Append the city + province if visible (e.g. "16703 - 66 Street NW, Edmonton, AB"). Do NOT include the venue name in this field.
- date: prefer ISO YYYY-MM-DD when the year is unambiguous, else use the printed wording (e.g. "Saturday, November 30").
- startTime / endTime: prefer 24-hour HH:mm; otherwise return the printed text (e.g. "9:30 AM").
- description: a one or two sentence neutral summary suitable for a market listing — not raw OCR dump and not marketing fluff.
- ticketPrice: admission, booth fee, or ticket price exactly as printed including currency symbol. Use "FREE" when the flyer says free entry / free admission.

If the image is too blurry or has no readable text, return all null values.`

function fileToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Filename-based fallback used when no OpenAI API key is configured.
 *
 * Intentionally does NOT populate the event name from the filename — the
 * coordinator complained that uploads like "Craft_Fair_Poster_2024.png"
 * were filling the market name with the file slug. Returning null lets the
 * UI render an empty "name" field that the coordinator can type manually
 * instead of being seeded with garbage.
 *
 * The filename date heuristic is preserved because date prefixes
 * ("2024-11-30-poster.png") are common and unambiguous.
 */
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

  return parsedFlyerSchema.parse({
    eventName: null,
    venueName: null,
    address: null,
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
          role: 'system',
          content:
            'You extract event-listing data from market posters. Output strict JSON only — never prose, never markdown, never wrap in code fences.',
        },
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
      venueName: data.venueName ?? null,
      address: data.address ?? null,
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
