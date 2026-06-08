const GEMINI_KEY_ENV = [
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
] as const

/** Groq key — `POPUPHUB_API_KEY` is the Vercel alias for the backup provider. */
const GROQ_KEY_ENV = ['GROQ_API_KEY', 'POPUPHUB_API_KEY'] as const

export function resolveGeminiApiKey(): string | undefined {
  for (const key of GEMINI_KEY_ENV) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

export function resolveGroqApiKey(): string | undefined {
  for (const key of GROQ_KEY_ENV) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

/** Strip AI Gateway-style `provider/model` prefixes for the Google REST API. */
export function normalizeGeminiModelId(modelId: string): string {
  const trimmed = modelId.trim()
  const slash = trimmed.indexOf('/')
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

export function resolveGeminiModelId(): string {
  const configured = process.env.GEMINI_MODEL_ID?.trim()
  return normalizeGeminiModelId(configured || 'gemini-2.5-flash')
}

/** Vision model for flyer OCR — defaults to Gemini 2.5 Flash. */
export function resolveFlyerGeminiModelId(): string {
  const configured =
    process.env.FLYER_GEMINI_MODEL_ID?.trim() || 'google/gemini-2.5-flash'
  return normalizeGeminiModelId(configured)
}

export function resolveGroqModelId(): string {
  return process.env.GROQ_MODEL_ID?.trim() || 'llama-3.2-90b-vision-preview'
}
