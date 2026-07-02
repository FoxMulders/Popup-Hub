import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

interface ResponsiveGuardCheck {
  file: string
  description: string
  mustInclude: string[]
}

const root = process.cwd()

const checks: ResponsiveGuardCheck[] = [
  {
    file: 'app/coordinator/studio/ledger/page.tsx',
    description: 'Standalone Blueprint booth matrix route is wrapped by the ledger viewport guard',
    mustInclude: ['DashboardLedgerViewportGuard', 'DashboardLedgerWindowClient'],
  },
  {
    file: 'components/coordinator/dashboard/dashboard-ledger-viewport-guard.tsx',
    description: 'Ledger viewport guard renders the designated regression warning',
    mustInclude: [
      'FloorPlanViewportLayoutProvider',
      'useFloorPlanViewportLayout',
      'FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING',
      'The floor plan matrix is not optimized for small screens. Recommended layout: desktop size.',
      'data-testid="floor-plan-matrix-small-screen-warning"',
    ],
  },
  {
    file: 'components/coordinator/spatial-layout/spatial-layout-editor.tsx',
    description: 'Spatial layout editor blocks pocket-sized viewports before mounting FloorPlanV2',
    mustInclude: [
      'FloorPlanViewportLayoutProvider',
      'DesktopScreenRequiredOverlay',
      'useFloorPlanViewportLayout',
      'showDesktopRequired ?',
      '<FloorPlanV2',
    ],
  },
  {
    file: 'src/qa_review/components/coordinator/spatial-layout/spatial-layout-editor_qa.tsx',
    description: 'Included QA spatial layout mirror preserves the viewport guard',
    mustInclude: [
      'FloorPlanViewportLayoutProvider',
      'DesktopScreenRequiredOverlay',
      'useFloorPlanViewportLayout',
      'showDesktopRequired ?',
      '<FloorPlanV2WizardQa',
    ],
  },
  {
    file: 'src/qa_review/components/coordinator/dashboard/Dashboard_qa.tsx',
    description: 'Blueprint Studio dashboard bootstrap keeps the existing desktop-required guard',
    mustInclude: [
      'FloorPlanViewportLayoutProvider',
      'DesktopScreenRequiredOverlay',
      'useFloorPlanViewportLayout',
      '!showDesktopRequired',
    ],
  },
  {
    file: 'components/coordinator/wizard/wizard-step-floor-plan.tsx',
    description: 'Setup wizard floor-plan step keeps the existing desktop-required guard',
    mustInclude: [
      'FloorPlanViewportLayoutProvider',
      'DesktopScreenRequiredOverlay',
      'useFloorPlanViewportLayout',
      'showDesktopRequired ?',
    ],
  },
  {
    file: 'qa_review/coordinator-site-recovery/components/coordinator/spatial-layout/spatial-layout-editor_qa.tsx',
    description: 'Recovery QA spatial layout copy preserves the viewport guard',
    mustInclude: [
      'FloorPlanViewportLayoutProvider',
      'DesktopScreenRequiredOverlay',
      'useFloorPlanViewportLayout',
      'showDesktopRequired ?',
      '<FloorPlanV2',
    ],
  },
]

const failures: string[] = []

for (const check of checks) {
  const absolutePath = resolve(root, check.file)
  const source = readFileSync(absolutePath, 'utf8')
  const missing = check.mustInclude.filter((needle) => !source.includes(needle))

  if (missing.length > 0) {
    failures.push(
      `${relative(root, absolutePath)}: ${check.description}; missing ${missing
        .map((needle) => JSON.stringify(needle))
        .join(', ')}`
    )
    continue
  }

  console.log(`OK ${relative(root, absolutePath)} - ${check.description}`)
}

if (failures.length > 0) {
  console.error('\nBlueprint responsive guard verification failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`\nBlueprint responsive guard verification passed (${checks.length} files).`)
