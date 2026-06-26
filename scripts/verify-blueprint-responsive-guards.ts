/**
 * Static QA check for Blueprint Studio / ledger responsive guards.
 *
 * Run: npx tsx scripts/verify-blueprint-responsive-guards.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
let fail = 0

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function hasAll(path: string, tokens: string[]): void {
  const contents = source(path)
  for (const token of tokens) {
    assert(contents.includes(token), `${path} contains ${token}`)
  }
}

hasAll('components/coordinator/dashboard/dashboard-ledger-viewport-guard.tsx', [
  'FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING',
  'The floor plan matrix is not optimized for small screens',
  'isPocketSizedViewport',
  'floor-plan-matrix-small-screen-warning',
])

hasAll('components/coordinator/dashboard/dashboard-allocation-ledger.tsx', [
  'DashboardLedgerViewportGuard',
  '<BoothMatrixPanel variant="ledger" defaultOpen />',
])

hasAll('components/coordinator/dashboard/dashboard-ledger-window-client.tsx', [
  'DashboardLedgerViewportGuard',
  'DashboardLedgerWindowClientInner',
  'subscribeFloorplanSync',
])

for (const path of [
  'components/coordinator/dashboard/dashboard-bootstrap.tsx',
  'src/qa_review/components/coordinator/dashboard/Dashboard_qa.tsx',
]) {
  hasAll(path, [
    'FloorPlanViewportLayoutProvider',
    'DesktopScreenRequiredOverlay',
    'showDesktopRequired',
    '!showDesktopRequired',
  ])
}

for (const path of [
  'components/coordinator/spatial-layout/spatial-layout-editor.tsx',
  'src/qa_review/components/coordinator/spatial-layout/spatial-layout-editor_qa.tsx',
  'src/qa_review/components/coordinator/wizard/wizard-step-floor-plan_qa.tsx',
  'qa_review/coordinator-site-recovery/components/coordinator/spatial-layout/spatial-layout-editor_qa.tsx',
]) {
  hasAll(path, [
    'FloorPlanViewportLayoutProvider',
    'DesktopScreenRequiredOverlay',
    'useFloorPlanViewportLayout',
    'showDesktopRequired',
  ])
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
