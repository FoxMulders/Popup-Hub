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

export function resolveGeminiModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || 'gemini-2.0-flash'
}

export function resolveGroqModelId(): string {
  return process.env.GROQ_MODEL_ID?.trim() || 'llama-3.2-90b-vision-preview'
}
