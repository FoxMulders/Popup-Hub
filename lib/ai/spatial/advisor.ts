/**
 * OpenRouter Advisor pattern — geometry worker escalates to a stronger model
 * only when spatial collision or logic errors are detected mid-generation.
 */

import type { OpenRouterMessage } from '@/lib/ai/openrouter'
import { openRouterSpatialChat } from '@/lib/ai/spatial/client'

export interface SpatialCollisionIssue {
  code: 'overlap' | 'out_of_bounds' | 'aisle_blocked' | 'category_proximity' | 'logic'
  message: string
  objectIds?: string[]
}

export interface SpatialAdvisorInput {
  /** Compressed layout JSON from the geometry worker attempt. */
  layoutJson: string
  /** Partial or invalid model output to correct. */
  draftOutput: string
  issues: SpatialCollisionIssue[]
  /** Original user/system prompt context (truncated). */
  taskContext: string
}

export interface SpatialAdvisorResult {
  correction: string
  model: string
  usedFallback: boolean
  escalated: true
}

function buildAdvisorPrompt(input: SpatialAdvisorInput): OpenRouterMessage[] {
  const issueLines = input.issues
    .map((i) => `- [${i.code}] ${i.message}${i.objectIds?.length ? ` (${i.objectIds.join(', ')})` : ''}`)
    .join('\n')

  return [
    {
      role: 'system',
      content:
        'You are a spatial layout advisor. Fix collision and logic errors in floor-plan coordinate JSON. Output strict JSON only — same schema as the draft. All units in feet, top-left origin. Make minimal coordinate adjustments.',
    },
    {
      role: 'user',
      content: `TASK CONTEXT:
${input.taskContext}

COMPRESSED LAYOUT:
${input.layoutJson}

DRAFT OUTPUT (contains errors):
${input.draftOutput}

ISSUES:
${issueLines}

Return corrected JSON only.`,
    },
  ]
}

/**
 * Consult the advisor tier when the geometry worker hits spatial errors.
 * Streams are handled by the caller — this returns the full correction.
 */
export async function consultSpatialAdvisor(
  input: SpatialAdvisorInput
): Promise<SpatialAdvisorResult> {
  const result = await openRouterSpatialChat({
    tier: 'advisor',
    messages: buildAdvisorPrompt(input),
    jsonMode: true,
    temperature: 0.1,
  })

  return {
    correction: result.content,
    model: result.model,
    usedFallback: result.usedFallback,
    escalated: true,
  }
}

/** Detect whether draft output warrants advisor escalation. */
export function shouldEscalateToAdvisor(issues: SpatialCollisionIssue[]): boolean {
  return issues.length > 0
}
