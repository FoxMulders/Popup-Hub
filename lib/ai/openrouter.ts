import { resolveOpenRouterApiKey } from '@/lib/ai/env'
import { getURL } from '@/lib/url/public-app-url'
import { isProviderLimitError } from '@/lib/ai/provider-limit-error'
import {
  resolveFallbackModelForTask,
  resolveModelForTask,
  type AiTask,
} from '@/lib/ai/tasks'
import type { OpenRouterMaxPrice } from '@/lib/ai/spatial/max-price'

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_APP_NAME = 'Popup Hub'

function openRouterRefererUrl(): string {
  return getURL()
}

export type OpenRouterMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: OpenRouterMessageContent
}

export interface OpenRouterProviderConfig {
  sort?: 'price' | 'throughput' | 'latency'
  max_price?: OpenRouterMaxPrice
}

export interface OpenRouterChatOptions {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  jsonMode?: boolean
  stream?: boolean
  provider?: OpenRouterProviderConfig
}

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenRouterConfigError'
  }
}

export class OpenRouterRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string,
    readonly model: string
  ) {
    super(message)
    this.name = 'OpenRouterRequestError'
  }
}

function openRouterHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': openRouterRefererUrl(),
    'X-Title': OPENROUTER_APP_NAME,
  }
}

/** Centralized payload builder — all OpenRouter requests flow through here. */
export function buildOpenRouterPayload(input: OpenRouterChatOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.1,
    stream: input.stream ?? false,
  }

  if (input.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  if (input.provider) {
    body.provider = input.provider
  }

  return body
}

async function callOpenRouterChat(input: OpenRouterChatOptions): Promise<string> {
  const apiKey = resolveOpenRouterApiKey()
  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[openrouter] OPENROUTER_API_KEY is not set — add it to .env.local to enable AI features'
      )
    }
    throw new OpenRouterConfigError('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(buildOpenRouterPayload(input)),
  })

  const detail = await response.text()
  if (!response.ok) {
    throw new OpenRouterRequestError(
      'OpenRouter chat request failed',
      response.status,
      detail,
      input.model
    )
  }

  const json = JSON.parse(detail) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content?.trim()) {
    throw new OpenRouterRequestError(
      'OpenRouter returned an empty response',
      502,
      detail,
      input.model
    )
  }

  return content
}

/** Streaming chat — returns raw OpenRouter SSE body for spatial layout generation. */
export async function openRouterChatStream(
  input: Omit<OpenRouterChatOptions, 'stream'>
): Promise<Response> {
  const apiKey = resolveOpenRouterApiKey()
  if (!apiKey) {
    throw new OpenRouterConfigError('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(buildOpenRouterPayload({ ...input, stream: true })),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new OpenRouterRequestError(
      'OpenRouter stream request failed',
      response.status,
      detail,
      input.model
    )
  }

  if (!response.body) {
    throw new OpenRouterRequestError('OpenRouter stream missing body', 502, '', input.model)
  }

  return response
}

export interface OpenRouterChatResult {
  content: string
  model: string
  task: AiTask
  usedFallback: boolean
}

/**
 * Route a chat completion through OpenRouter using the task-appropriate model.
 * Falls back to the task's secondary model on quota / rate-limit errors.
 */
export async function openRouterChatForTask(input: {
  task: AiTask
  messages: OpenRouterMessage[]
  temperature?: number
  jsonMode?: boolean
  provider?: OpenRouterProviderConfig
}): Promise<OpenRouterChatResult> {
  const primaryModel = resolveModelForTask(input.task)
  const fallbackModel = resolveFallbackModelForTask(input.task)

  const chatOpts: OpenRouterChatOptions = {
    model: primaryModel,
    messages: input.messages,
    temperature: input.temperature,
    jsonMode: input.jsonMode,
    provider: input.provider,
  }

  try {
    const content = await callOpenRouterChat(chatOpts)
    return { content, model: primaryModel, task: input.task, usedFallback: false }
  } catch (err) {
    const shouldFallback =
      err instanceof OpenRouterRequestError &&
      fallbackModel &&
      fallbackModel !== primaryModel &&
      isProviderLimitError(err.status, err.detail)

    if (!shouldFallback) throw err

    console.warn(
      `[ai] OpenRouter ${input.task} limit on ${primaryModel} — falling back to ${fallbackModel}`,
      err.status,
      err.detail.slice(0, 240)
    )

    const content = await callOpenRouterChat({ ...chatOpts, model: fallbackModel })
    return { content, model: fallbackModel, task: input.task, usedFallback: true }
  }
}
