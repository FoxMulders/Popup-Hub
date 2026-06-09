/**
 * Verify OpenRouter task routing and limit-error helpers.
 * Run: npx tsx scripts/verify-ai-provider-fallback.ts
 */
import {
  isAiConfigured,
  isOpenRouterConfigured,
  resolveOpenRouterApiKey,
} from '../lib/ai/env'
import { isProviderLimitError } from '../lib/ai/provider-limit-error'
import {
  AI_TASKS,
  resolveFallbackModelForTask,
  resolveModelForTask,
  type AiTask,
} from '../lib/ai/tasks'

let passed = 0
let failed = 0

function assert(name: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`  OK   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}`)
  }
}

assert('429 is a limit error', isProviderLimitError(429, ''))
assert('503 is a limit error', isProviderLimitError(503, ''))
assert(
  'RESOURCE_EXHAUSTED body is a limit error',
  isProviderLimitError(400, '{"error":{"status":"RESOURCE_EXHAUSTED"}}')
)
assert('quota message is a limit error', isProviderLimitError(400, 'You exceeded your current quota'))
assert('401 auth failure is not a limit error', !isProviderLimitError(401, 'invalid api key'))

assert(
  'flyer_vision uses a vision-capable model',
  resolveModelForTask('flyer_vision').includes('gemini')
)
assert(
  'flyer_vision fallback differs from primary',
  resolveModelForTask('flyer_vision') !== resolveFallbackModelForTask('flyer_vision')
)
assert(
  'creative_layout uses claude sonnet family',
  resolveModelForTask('creative_layout').includes('claude')
)
assert(
  'chat_json uses gpt-4o-mini',
  resolveModelForTask('chat_json').includes('gpt-4o-mini')
)

assert(
  'auto_arrange_layout uses gemini 2.5 pro',
  resolveModelForTask('auto_arrange_layout').includes('gemini-2.5-pro')
)
assert(
  'auto_arrange_layout fallback differs from primary',
  resolveModelForTask('auto_arrange_layout') !==
    resolveFallbackModelForTask('auto_arrange_layout')
)
assert(
  'layout_recommend uses claude 3.5 sonnet',
  resolveModelForTask('layout_recommend').includes('claude-3.5-sonnet')
)
assert(
  'layout_recommend fallback differs from primary',
  resolveModelForTask('layout_recommend') !==
    resolveFallbackModelForTask('layout_recommend')
)

for (const task of Object.keys(AI_TASKS) as AiTask[]) {
  assert(`${task} has primary model`, resolveModelForTask(task).length > 0)
  assert(`${task} has fallback model`, Boolean(resolveFallbackModelForTask(task)))
}

assert(
  'OpenRouter key env resolves when set',
  resolveOpenRouterApiKey() === undefined || resolveOpenRouterApiKey()!.length > 0
)
assert(
  'isOpenRouterConfigured matches key presence',
  isOpenRouterConfigured() === Boolean(resolveOpenRouterApiKey())
)
assert(
  'isAiConfigured true when OpenRouter set',
  !resolveOpenRouterApiKey() || isAiConfigured()
)

console.log('')
if (failed === 0) {
  console.log(`==> ${passed}/${passed} checks passed`)
  process.exit(0)
}

console.log(`==> ${failed} check(s) failed`)
process.exit(1)
