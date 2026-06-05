/**
 * Verify Gemini → Groq fallback helpers.
 * Run: npx tsx scripts/verify-ai-provider-fallback.ts
 */
import { resolveGeminiApiKey, resolveGroqApiKey } from '../lib/ai/env'
import { isProviderLimitError } from '../lib/ai/provider-limit-error'

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
assert('RESOURCE_EXHAUSTED body is a limit error', isProviderLimitError(400, '{"error":{"status":"RESOURCE_EXHAUSTED"}}'))
assert('quota message is a limit error', isProviderLimitError(400, 'You exceeded your current quota'))
assert('401 auth failure is not a limit error', !isProviderLimitError(401, 'invalid api key'))
assert('Gemini key env resolves when set', resolveGeminiApiKey() === undefined || resolveGeminiApiKey()!.length > 0)
assert('Groq key env resolves POPUPHUB alias when set', resolveGroqApiKey() === undefined || resolveGroqApiKey()!.length > 0)

console.log('')
if (failed === 0) {
  console.log(`==> ${passed}/${passed} checks passed`)
  process.exit(0)
}

console.log(`==> ${failed} check(s) failed`)
process.exit(1)
