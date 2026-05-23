export interface CritiqueFinding {
  id: string
  persona: 'engine'
  severity: 'warning' | 'error' | 'info'
  title: string
  message: string
}

export function runEngineAudit(input: {
  iterationLimitHit: boolean
  qaRunning: boolean
  qaCancelled: boolean
  hasOverlap: boolean
  saveBlocked: boolean
}): CritiqueFinding[] {
  const findings: CritiqueFinding[] = []

  if (input.iterationLimitHit) {
    findings.push({
      id: 'engine-iter-limit',
      persona: 'engine',
      severity: 'warning',
      title: '5,000-step circuit breaker',
      message: 'Auto-planner hit the iteration guard — clear space or reduce booth caps.',
    })
  }

  if (input.qaRunning) {
    findings.push({
      id: 'engine-qa-running',
      persona: 'engine',
      severity: 'info',
      title: 'Regression QA running',
      message: '100-scenario suite in progress. Use Stop QA to halt immediately.',
    })
  }

  if (input.qaCancelled) {
    findings.push({
      id: 'engine-qa-stopped',
      persona: 'engine',
      severity: 'info',
      title: 'QA halted',
      message: 'Regression run was interrupted by the Stop QA control.',
    })
  }

  if (input.saveBlocked && input.hasOverlap) {
    findings.push({
      id: 'engine-save-blocked',
      persona: 'engine',
      severity: 'error',
      title: 'Save blocked',
      message: 'Wall/booth bitmask conflicts (0b01) prevent save until overlaps are cleared.',
    })
  }

  return findings
}
