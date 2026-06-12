import type { BoothContractClause } from '@/types/database'

export function buildBoothContractEnhancementPrefill(input: {
  eventName?: string
  enabledClauseCount: number
  customClauseCount: number
  hasPdf: boolean
}): {
  title: string
  problem: string
  dreamSolution: string
  targetComponent: 'booth_contracts'
  submitterRole: 'coordinator'
} {
  const eventLabel = input.eventName?.trim() ? ` for "${input.eventName.trim()}"` : ''
  return {
    title: 'Improve default booth contract templates',
    problem: [
      `I'm configuring digital booth contracts${eventLabel}.`,
      `Current setup: ${input.enabledClauseCount} enabled clause(s), ${input.customClauseCount} custom clause(s)${input.hasPdf ? ', plus a PDF attachment' : ''}.`,
      'The platform default clauses could better match how our markets operate.',
    ].join(' '),
    dreamSolution:
      'Add or refine standard booth contract sections (payment, insurance, attendance, teardown, conduct) so coordinators spend less time writing custom clauses.',
    targetComponent: 'booth_contracts',
    submitterRole: 'coordinator',
  }
}

export function summarizeContractClausesForFeedback(clauses: BoothContractClause[]): string {
  const enabled = clauses.filter((clause) => clause.enabled)
  if (enabled.length === 0) return 'No enabled clauses.'
  return enabled
    .slice(0, 6)
    .map((clause) => `${clause.title}: ${clause.body.slice(0, 120)}${clause.body.length > 120 ? '…' : ''}`)
    .join('\n')
}
