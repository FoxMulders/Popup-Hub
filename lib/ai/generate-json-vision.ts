import { resolveOpenRouterApiKey } from '@/lib/ai/env'
import {
  OpenRouterConfigError,
  OpenRouterRequestError,
  openRouterChatForTask,
} from '@/lib/ai/openrouter'
import type { AiTask } from '@/lib/ai/tasks'

export type VisionJsonProvider = 'openrouter'

export class VisionJsonProviderError extends Error {
  constructor(
    message: string,
    readonly provider: VisionJsonProvider,
    readonly status: number,
    readonly detail: string,
    readonly model?: string
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

/**
 * JSON extraction from an image via OpenRouter.
 * Model is chosen from the task registry (flyer_vision vs generic vision_json).
 */
export async function generateJsonFromVision(input: {
  systemPrompt: string
  userPrompt: string
  dataUrl: string
  mimeType: string
  /** Defaults to vision_json; flyer parse should pass flyer_vision. */
  task?: AiTask
}): Promise<{ content: string; provider: VisionJsonProvider; model: string }> {
  if (!resolveOpenRouterApiKey()) {
    throw new VisionJsonUnavailableError('OPENROUTER_API_KEY is not configured')
  }

  const task = input.task ?? 'vision_json'

  try {
    const result = await openRouterChatForTask({
      task,
      jsonMode: true,
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
    })

    return { content: result.content, provider: 'openrouter', model: result.model }
  } catch (err) {
    if (err instanceof OpenRouterConfigError) {
      throw new VisionJsonUnavailableError(err.message)
    }
    if (err instanceof OpenRouterRequestError) {
      throw new VisionJsonProviderError(
        err.message,
        'openrouter',
        err.status,
        err.detail,
        err.model
      )
    }
    throw err
  }
}
