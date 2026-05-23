export interface CritiqueFinding {
  id: string
  persona: 'ui'
  severity: 'warning' | 'error'
  title: string
  message: string
}

export function runUiAudit(input: {
  currentStep: number
  hasOverlap: boolean
  undismissedAlertCount: number
  venueWidth: number
  venueLength: number
  templateWidth?: number
  templateLength?: number
  gridCols: number
  gridRows: number
  pinDropped: boolean
}): CritiqueFinding[] {
  const findings: CritiqueFinding[] = []

  if (input.hasOverlap) {
    findings.push({
      id: 'ui-overlap',
      persona: 'ui',
      severity: 'error',
      title: 'Overlapping placements',
      message: 'Resolve red overlap cells on the canvas before deploying the market.',
    })
  }

  if (input.undismissedAlertCount > 2) {
    findings.push({
      id: 'ui-alert-clutter',
      persona: 'ui',
      severity: 'warning',
      title: 'Alert clutter',
      message: `${input.undismissedAlertCount} active warnings — dismiss resolved items to reduce noise.`,
    })
  }

  if (
    input.templateWidth != null &&
    input.templateLength != null &&
    (input.venueWidth !== input.templateWidth || input.venueLength !== input.templateLength)
  ) {
    findings.push({
      id: 'ui-dimension-drift',
      persona: 'ui',
      severity: 'warning',
      title: 'Venue dimension drift',
      message: `Template expects ${input.templateWidth}×${input.templateLength} ft but room state differs.`,
    })
  }

  if (input.gridCols > input.venueWidth || input.gridRows > input.venueLength) {
    findings.push({
      id: 'ui-grid-overflow',
      persona: 'ui',
      severity: 'error',
      title: 'Grid exceeds venue bounds',
      message: 'Grid indices extend past the physical hall footprint — re-select the venue template.',
    })
  }

  if (input.currentStep === 2 && !input.pinDropped) {
    findings.push({
      id: 'ui-no-map-pin',
      persona: 'ui',
      severity: 'warning',
      title: 'MAP PIN MISSING',
      message: 'Drop a map pin on Step 2 so shoppers can find the venue.',
    })
  }

  return findings
}
