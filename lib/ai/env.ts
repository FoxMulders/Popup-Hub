/** Primary AI gateway — all in-app LLM calls route through OpenRouter. */
const OPENROUTER_KEY_ENV = ['OPENROUTER_API_KEY'] as const

/** @deprecated Direct Gemini keys — kept for migration; prefer OPENROUTER_API_KEY. */
const GEMINI_KEY_ENV = [
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
] as const

/** @deprecated Direct Groq keys — kept for migration; prefer OPENROUTER_API_KEY. */
const GROQ_KEY_ENV = ['GROQ_API_KEY', 'POPUPHUB_API_KEY'] as const

export function resolveOpenRouterApiKey(): string | undefined {
  for (const key of OPENROUTER_KEY_ENV) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(resolveOpenRouterApiKey())
}

/** @deprecated Use isOpenRouterConfigured() — legacy direct-provider check. */
export function resolveGeminiApiKey(): string | undefined {
  for (const key of GEMINI_KEY_ENV) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

/** @deprecated Use OpenRouter task routing instead of direct Groq. */
export function resolveGroqApiKey(): string | undefined {
  for (const key of GROQ_KEY_ENV) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

/** @deprecated Model selection is task-based via lib/ai/tasks.ts. */
export function normalizeGeminiModelId(modelId: string): string {
  const trimmed = modelId.trim()
  const slash = trimmed.indexOf('/')
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

/** @deprecated Use resolveModelForTask('vision_json'). */
export function resolveGeminiModelId(): string {
  const configured = process.env.GEMINI_MODEL_ID?.trim()
  return normalizeGeminiModelId(configured || 'gemini-2.5-flash')
}

/** @deprecated Use resolveModelForTask('flyer_vision'). */
export function resolveFlyerGeminiModelId(): string {
  const configured =
    process.env.FLYER_GEMINI_MODEL_ID?.trim() || 'google/gemini-2.5-flash'
  return normalizeGeminiModelId(configured)
}

/** @deprecated Use resolveModelForTask('flyer_vision') fallback. */
export function resolveGroqModelId(): string {
  return process.env.GROQ_MODEL_ID?.trim() || 'llama-3.2-90b-vision-preview'
}

/** True when any AI provider key is available (OpenRouter preferred). */
export function isAiConfigured(): boolean {
  return isOpenRouterConfigured() || Boolean(resolveGeminiApiKey()) || Boolean(resolveGroqApiKey())
}
