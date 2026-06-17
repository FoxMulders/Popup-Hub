/**
 * Maps each AI workload to the OpenRouter model best suited for it.
 * Override per task via OPENROUTER_MODEL_<TASK> env vars (see resolveModelForTask).
 */

export const AI_TASKS = {
  /** Flyer poster OCR — fast vision model with strong printed-text reading. */
  flyer_vision: {
    model: 'google/gemini-2.5-flash',
    fallbackModel: 'meta-llama/llama-3.2-90b-vision-instruct',
  },
  /** Generic image → strict JSON extraction. */
  vision_json: {
    model: 'google/gemini-2.5-flash',
    fallbackModel: 'qwen/qwen3.7-plus',
  },
  /** Text-only structured JSON (no image). */
  chat_json: {
    model: 'openai/gpt-4o-mini',
    fallbackModel: 'google/gemini-2.5-flash',
  },
  /** Spatial layout strings — format fidelity + geometric reasoning. */
  creative_layout: {
    model: 'anthropic/claude-3.5-sonnet',
    fallbackModel: 'openai/gpt-4o',
  },
  /** Floor-plan auto-arrange — coordinate math via floor-tier geometry worker. */
  auto_arrange_layout: {
    model: 'mistralai/mistral-7b-instruct:floor',
    fallbackModel: 'nex-agi/nex-n2-pro:free',
  },
  /** Layout safety + traffic-flow recommendations (draft / evaluation tier). */
  layout_recommend: {
    model: 'nex-agi/nex-n2-pro:free',
    fallbackModel: 'anthropic/claude-3.5-sonnet',
  },
  /** Blueprint / image floor plan parsing — multimodal vision (1M context). */
  spatial_vision: {
    model: 'qwen/qwen3.7-plus',
    fallbackModel: 'google/gemini-2.5-flash',
  },
  /** Draft / evaluation phase — free tier when available. */
  spatial_draft: {
    model: 'nex-agi/nex-n2-pro:free',
    fallbackModel: 'openai/gpt-4o-mini',
  },
  /** Layout geometry, bounding boxes, grid positions — lowest-cost provider. */
  spatial_geometry: {
    model: 'mistralai/mistral-7b-instruct:floor',
    fallbackModel: 'mistralai/mistral-7b-instruct',
  },
  /** Advisor — stronger reasoning for spatial collision / logic corrections only. */
  spatial_advisor: {
    model: 'anthropic/claude-3.5-sonnet',
    fallbackModel: 'openai/gpt-4o',
  },
  /** Long-form creative generation (themes, puzzles, council copy). */
  creative_generation: {
    model: 'anthropic/claude-sonnet-4',
    fallbackModel: 'google/gemini-2.5-pro',
  },
} as const

export type AiTask = keyof typeof AI_TASKS

function taskEnvKey(task: AiTask, kind: 'model' | 'fallback'): string {
  const suffix = kind === 'fallback' ? '_FALLBACK' : ''
  return `OPENROUTER_MODEL_${task.toUpperCase()}${suffix}`
}

/** Primary OpenRouter model id for a task (env override supported). */
export function resolveModelForTask(task: AiTask): string {
  const override = process.env[taskEnvKey(task, 'model')]?.trim()
  if (override) return override
  return AI_TASKS[task].model
}

/** Secondary model when the primary hits quota / rate limits. */
export function resolveFallbackModelForTask(task: AiTask): string | undefined {
  const override = process.env[taskEnvKey(task, 'fallback')]?.trim()
  if (override) return override
  return AI_TASKS[task].fallbackModel
}
