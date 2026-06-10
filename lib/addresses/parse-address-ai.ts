import { openRouterChatForTask } from '@/lib/ai/openrouter'
import {
  coerceParsedAddress,
  formatParsedAddress,
  hasParsedAddressSignal,
  type ParsedAddressComponents,
} from '@/lib/addresses/parsed-address'

const PARSE_PROMPT = `You parse unstructured venue or mailing addresses into structured JSON for Google Maps geocoding.

Return ONLY a JSON object with these exact keys (use empty strings when unknown):
{
  "street_number": "",
  "route": "",
  "locality": "",
  "administrative_area_level_1": "",
  "postal_code": "",
  "country": ""
}

Rules:
- street_number: building number only
- route: street name (e.g. "Main Street NW")
- locality: city or town
- administrative_area_level_1: province or state abbreviation when possible (e.g. "AB", "ON")
- postal_code: formatted postal/ZIP code
- country: country name (default Canada → "Canada" when implied)
- Prefer Canadian formatting when the input looks Canadian
- Do not invent data that is not implied by the input`

export interface ParseAddressAiResult {
  components: ParsedAddressComponents
  formatted: string
  model: string
  usedFallback: boolean
}

export async function parseAddressWithAi(rawAddress: string): Promise<ParseAddressAiResult | null> {
  const trimmed = rawAddress.trim()
  if (trimmed.length < 5) return null

  const { content, model, usedFallback } = await openRouterChatForTask({
    task: 'chat_json',
    jsonMode: true,
    temperature: 0,
    messages: [
      { role: 'system', content: PARSE_PROMPT },
      { role: 'user', content: trimmed },
    ],
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  const components = coerceParsedAddress(parsed)
  if (!hasParsedAddressSignal(components)) return null

  return {
    components,
    formatted: formatParsedAddress(components),
    model,
    usedFallback,
  }
}
