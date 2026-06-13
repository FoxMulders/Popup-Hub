import {
  parseSetupWizardStepFromUrl,
  setupWizardStepHref,
  setupWizardStepToUrlParam,
} from '@/lib/wizard/setup-step-url'

let failed = 0

function expect(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    failed += 1
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`)
    return
  }
  console.log(`OK ${label}`)
}

expect('step 1 url param', setupWizardStepToUrlParam(1), '1')
expect('step 2 url param', setupWizardStepToUrlParam(2), '3')
expect('step 3 url param', setupWizardStepToUrlParam(3), '4')

expect('legacy step 1', parseSetupWizardStepFromUrl('1', false), 1)
expect('legacy step 2', parseSetupWizardStepFromUrl('2', false), 1)
expect('legacy capacity step 3', parseSetupWizardStepFromUrl('3', false), 2)
expect('legacy floor plan step 4', parseSetupWizardStepFromUrl('4', false), 3)
expect('floor plan refresh round-trip', parseSetupWizardStepFromUrl(setupWizardStepToUrlParam(3), false), 3)
expect('capacity refresh round-trip', parseSetupWizardStepFromUrl(setupWizardStepToUrlParam(2), false), 2)

expect('skip layout clamps floor plan', parseSetupWizardStepFromUrl('4', true), 2)
expect(
  'floor plan href',
  setupWizardStepHref('evt-1', 3),
  '/coordinator/events/evt-1/setup?step=4'
)

if (failed > 0) {
  console.error(`${failed} assertion(s) failed`)
  process.exit(1)
}

console.log('verify-setup-step-url: all checks passed')
