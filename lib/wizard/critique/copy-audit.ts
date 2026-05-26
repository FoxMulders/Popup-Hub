export interface CritiqueFinding {
  id: string
  persona: 'copy'
  severity: 'warning' | 'error' | 'info'
  title: string
  message: string
  actionStep?: number
}

/** Minimum trimmed length before the English Teacher Audit clears THIN DESCRIPTION. */
export const DESCRIPTION_MIN_LENGTH = 15

export function runCopyAudit(input: {
  eventName: string
  description: string
  currentStep?: number
}): CritiqueFinding[] {
  const onLayoutStep = (input.currentStep ?? 1) >= 3
  const findings: CritiqueFinding[] = []
  const name = input.eventName.trim()
  const desc = input.description.trim()

  if (!name) {
    findings.push({
      id: 'copy-empty-name',
      persona: 'copy',
      severity: 'error',
      title: 'Missing event name',
      message: 'Add a clear event name so vendors know which market they are applying to.',
    })
  } else if (name === name.toUpperCase() && name.length > 4) {
    findings.push({
      id: 'copy-all-caps-name',
      persona: 'copy',
      severity: 'warning',
      title: 'All-caps event title',
      message: 'Title case reads more professionally than ALL CAPS for market listings.',
    })
  }

  if (name && name.length < 4) {
    findings.push({
      id: 'copy-short-name',
      persona: 'copy',
      severity: 'warning',
      title: 'Very short event name',
      message: 'Consider a more descriptive name (neighborhood, season, or theme).',
    })
  }

  if (!desc) {
    findings.push({
      id: 'copy-empty-description',
      persona: 'copy',
      severity: onLayoutStep ? 'info' : 'warning',
      title: 'No description',
      message: onLayoutStep
        ? 'Add a short market description on Step 1 (Event Details) before publishing.'
        : 'A short description helps vendors and shoppers understand your market vibe.',
      actionStep: onLayoutStep ? 1 : undefined,
    })
  } else if (desc.length < DESCRIPTION_MIN_LENGTH) {
    const remaining = DESCRIPTION_MIN_LENGTH - desc.length
    findings.push({
      id: 'copy-thin-description',
      persona: 'copy',
      severity: onLayoutStep ? 'info' : 'warning',
      title: 'THIN DESCRIPTION',
      message: onLayoutStep
        ? `Step 1 needs ${remaining} more character${remaining === 1 ? '' : 's'} (minimum ${DESCRIPTION_MIN_LENGTH}). Mention vendor mix, location, or the shopper experience.`
        : `Add ${remaining} more character${remaining === 1 ? '' : 's'} (minimum ${DESCRIPTION_MIN_LENGTH}). Mention vendor mix, location highlights, or the shopper experience.`,
      actionStep: onLayoutStep ? 1 : undefined,
    })
  }

  return findings
}
