export interface CritiqueFinding {
  id: string
  persona: 'copy'
  severity: 'warning' | 'error'
  title: string
  message: string
}

/** Minimum trimmed length before the English Teacher Audit clears THIN DESCRIPTION. */
export const DESCRIPTION_MIN_LENGTH = 15

export function runCopyAudit(input: {
  eventName: string
  description: string
}): CritiqueFinding[] {
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
      severity: 'warning',
      title: 'No description',
      message: 'A short description helps vendors and shoppers understand your market vibe.',
    })
  } else if (desc.length < DESCRIPTION_MIN_LENGTH) {
    const remaining = DESCRIPTION_MIN_LENGTH - desc.length
    findings.push({
      id: 'copy-thin-description',
      persona: 'copy',
      severity: 'warning',
      title: 'THIN DESCRIPTION',
      message: `Add ${remaining} more character${remaining === 1 ? '' : 's'} (minimum ${DESCRIPTION_MIN_LENGTH}). Mention vendor mix, location highlights, or the shopper experience.`,
    })
  }

  return findings
}
