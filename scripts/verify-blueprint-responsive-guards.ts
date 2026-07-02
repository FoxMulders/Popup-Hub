/**
 * Blueprint Studio responsive guard regression scan.
 *
 * Run: npx tsx scripts/verify-blueprint-responsive-guards.ts
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MATRIX_WARNING =
  'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.'

let pass = 0
let fail = 0

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

function assertContains(source: string, needle: string, msg: string): void {
  assert(source.includes(needle), msg)
}

function assertMatches(source: string, pattern: RegExp, msg: string): void {
  assert(pattern.test(source), msg)
}

const dashboardBootstrap = read('components/coordinator/dashboard/dashboard-bootstrap.tsx')
const qaDashboardBootstrap = read('src/qa_review/components/coordinator/dashboard/Dashboard_qa.tsx')
const wizardFloorPlan = read('components/coordinator/wizard/wizard-step-floor-plan.tsx')
const spatialEditor = read('components/coordinator/spatial-layout/spatial-layout-editor.tsx')
const ledgerPage = read('app/coordinator/studio/ledger/page.tsx')
const ledgerGuard = read('components/coordinator/dashboard/dashboard-ledger-viewport-guard.tsx')

for (const [label, source] of [
  ['HubGrid dashboard', dashboardBootstrap],
  ['QA HubGrid dashboard', qaDashboardBootstrap],
  ['setup wizard floor plan', wizardFloorPlan],
  ['legacy spatial layout editor', spatialEditor],
] as const) {
  assertContains(source, 'FloorPlanViewportLayoutProvider', `${label} wraps with viewport provider`)
  assertContains(source, 'DesktopScreenRequiredOverlay', `${label} renders desktop-required overlay`)
  assertContains(source, 'useFloorPlanViewportLayout', `${label} reads viewport layout state`)
  assertMatches(
    source,
    /showDesktopRequired[\s\S]{0,240}(\?|&&|!showDesktopRequired)/,
    `${label} branches canvas UI on desktop-size breaker`
  )
}

assertContains(
  ledgerPage,
  'DashboardLedgerViewportGuard',
  'standalone booth matrix route is wrapped in viewport guard'
)
assertContains(
  ledgerGuard,
  'useIsPocketSizedViewport',
  'standalone booth matrix guard checks live viewport dimensions'
)
assertContains(
  ledgerGuard,
  MATRIX_WARNING,
  'standalone booth matrix guard renders the designated regression warning'
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
