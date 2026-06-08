import { resolveOpenRouterApiKey } from '@/lib/ai/env'
import { isProviderLimitError } from '@/lib/ai/provider-limit-error'
import {
  resolveFallbackModelForTask,
  resolveModelForTask,
  type AiTask,
} from '@/lib/ai/tasks'

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_SITE_URL = 'https://popuphub.ca'
const OPENROUTER_APP_NAME = 'Popup Hub'

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
    'HTTP-Referer': OPENROUTER_SITE_URL,
    'X-Title': OPENROUTER_APP_NAME,
  }
}

async function callOpenRouterChat(input: {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  jsonMode?: boolean
}): Promise<string> {
  const apiKey = resolveOpenRouterApiKey()
  if (!apiKey) {
    throw new OpenRouterConfigError('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.1,
      ...(input.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
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
}): Promise<OpenRouterChatResult> {
  const primaryModel = resolveModelForTask(input.task)
  const fallbackModel = resolveFallbackModelForTask(input.task)

  try {
    const content = await callOpenRouterChat({
      model: primaryModel,
      messages: input.messages,
      temperature: input.temperature,
      jsonMode: input.jsonMode,
    })
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

    const content = await callOpenRouterChat({
      model: fallbackModel,
      messages: input.messages,
      temperature: input.temperature,
      jsonMode: input.jsonMode,
    })
    return { content, model: fallbackModel, task: input.task, usedFallback: true }
  }
}
