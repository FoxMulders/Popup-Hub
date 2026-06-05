import {
  resolveGeminiApiKey,
  resolveGeminiModelId,
  resolveGroqApiKey,
  resolveGroqModelId,
} from '@/lib/ai/env'
import { isProviderLimitError } from '@/lib/ai/provider-limit-error'

export type VisionJsonProvider = 'gemini' | 'groq'

export class VisionJsonProviderError extends Error {
  constructor(
    message: string,
    readonly provider: VisionJsonProvider,
    readonly status: number,
    readonly detail: string
  ) {
    super(message)
    this.name = 'VisionJsonProviderError'
  }
}

export class VisionJsonUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VisionJsonUnavailableError'
  }
}

async function callGeminiJsonVision(input: {
  systemPrompt: string
  userPrompt: string
  dataUrl: string
  mimeType: string
}): Promise<string> {
  const apiKey = resolveGeminiApiKey()
  if (!apiKey) {
    throw new VisionJsonUnavailableError('Gemini API key is not configured')
  }

  const model = resolveGeminiModelId()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: input.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: input.userPrompt },
            {
              inline_data: {
                mime_type: input.mimeType,
                data: input.dataUrl.replace(/^data:[^;]+;base64,/, ''),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  })

  const detail = await response.text()
  if (!response.ok) {
    throw new VisionJsonProviderError(
      'Gemini vision request failed',
      'gemini',
      response.status,
      detail
    )
  }

  const json = JSON.parse(detail) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
  if (!text?.trim()) {
    throw new VisionJsonProviderError(
      'Gemini returned an empty vision response',
      'gemini',
      502,
      detail
    )
  }

  return text
}

async function callGroqJsonVision(input: {
  systemPrompt: string
  userPrompt: string
  dataUrl: string
}): Promise<string> {
  const apiKey = resolveGroqApiKey()
  if (!apiKey) {
    throw new VisionJsonUnavailableError('Groq API key is not configured')
  }

  const model = resolveGroqModelId()
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: input.userPrompt },
            { type: 'image_url', image_url: { url: input.dataUrl } },
          ],
        },
      ],
    }),
  })

  const detail = await response.text()
  if (!response.ok) {
    throw new VisionJsonProviderError(
      'Groq vision request failed',
      'groq',
      response.status,
      detail
    )
  }

  const json = JSON.parse(detail) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content?.trim()) {
    throw new VisionJsonProviderError(
      'Groq returned an empty vision response',
      'groq',
      502,
      detail
    )
  }

  return content
}

/**
 * Gemini-first JSON extraction from an image. Falls back to Groq when Gemini is
 * unavailable, out of quota, or overloaded.
 */
export async function generateJsonFromVision(input: {
  systemPrompt: string
  userPrompt: string
  dataUrl: string
  mimeType: string
}): Promise<{ content: string; provider: VisionJsonProvider }> {
  const geminiKey = resolveGeminiApiKey()
  const groqKey = resolveGroqApiKey()

  if (!geminiKey && !groqKey) {
    throw new VisionJsonUnavailableError('No Gemini or Groq API key is configured')
  }

  if (geminiKey) {
    try {
      const content = await callGeminiJsonVision(input)
      return { content, provider: 'gemini' }
    } catch (err) {
      const shouldFallback =
        err instanceof VisionJsonProviderError &&
        isProviderLimitError(err.status, err.detail)

      if (!shouldFallback || !groqKey) {
        throw err
      }

      console.warn(
        '[ai] Gemini limit reached — falling back to Groq',
        err.status,
        err.detail.slice(0, 240)
      )
    }
  }

  const content = await callGroqJsonVision(input)
  return { content, provider: 'groq' }
}
