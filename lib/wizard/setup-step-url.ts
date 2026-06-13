export type SetupWizardStep = 1 | 2 | 3

/**
 * Maps the internal 3-step wizard index to a legacy-compatible `?step=` value.
 * Old URLs used 1–2 for event/venue, 3 for capacity, and 4 for floor plan.
 */
export function setupWizardStepToUrlParam(step: SetupWizardStep): string {
  switch (step) {
    case 1:
      return '1'
    case 2:
      return '3'
    case 3:
      return '4'
  }
}

export function setupWizardStepHref(eventId: string, step: SetupWizardStep): string {
  return `/coordinator/events/${eventId}/setup?step=${setupWizardStepToUrlParam(step)}`
}

/**
 * Resolves the initial wizard step from a URL `?step=` query param.
 * Supports legacy 4-step numbering and the current 3-step flow.
 */
export function parseSetupWizardStepFromUrl(
  step: string | undefined,
  skipVenueLayout: boolean
): SetupWizardStep {
  const n = Number(step)
  if (Number.isFinite(n) && n >= 1) {
    let mapped: SetupWizardStep
    if (n <= 2) mapped = 1
    else if (n === 3) mapped = 2
    else mapped = 3
    if (skipVenueLayout && mapped === 3) return 2
    return mapped
  }
  return 1
}
