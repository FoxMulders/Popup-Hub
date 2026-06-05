/** True when an upstream LLM response indicates quota, rate limit, or overload — safe to try Groq. */
export function isProviderLimitError(status: number, body: string): boolean {
  if (status === 429 || status === 503 || status === 402) return true

  const normalized = body.toLowerCase()
  return (
    normalized.includes('resource_exhausted') ||
    normalized.includes('quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('rate_limit') ||
    normalized.includes('insufficient') ||
    normalized.includes('overloaded') ||
    normalized.includes('too many requests') ||
    normalized.includes('exceeded') ||
    normalized.includes('billing') ||
    normalized.includes('token limit') ||
    normalized.includes('max tokens')
  )
}
