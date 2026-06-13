export type SetupWizardStep = 1 | 2 | 3

/**
 * Maps the internal 3-step wizard index to the `?step=` query param.
 * Capacity uses step 2. Floor plan keeps step 4 so legacy capacity bookmarks
 * at step 3 keep resolving correctly.
 */
export function setupWizardStepToUrlParam(step: SetupWizardStep): string {
  switch (step) {
    case 1:
      return '1'
    case 2:
      return '2'
    case 3:
      return '4'
  }
}

export function setupWizardStepHref(eventId: string, step: SetupWizardStep): string {
  return `/coordinator/events/${eventId}/setup?step=${setupWizardStepToUrlParam(step)}`
}

/**
 * Resolves the initial wizard step from a URL `?step=` query param.
 * Supports the current flow (1 = event, 2 = capacity, 4 = floor plan) and
 * legacy capacity links that still use step 3.
 */
export function parseSetupWizardStepFromUrl(
  step: string | undefined,
  skipVenueLayout: boolean
): SetupWizardStep {
  const n = Number(step)
  if (!Number.isFinite(n) || n < 1) return 1

  let mapped: SetupWizardStep
  if (n === 1) mapped = 1
  else if (n === 2) mapped = 2
  else if (n === 3) mapped = 2 // legacy capacity
  else mapped = 3 // step 4+ = floor plan

  if (skipVenueLayout && mapped === 3) return 2
  return mapped
}
