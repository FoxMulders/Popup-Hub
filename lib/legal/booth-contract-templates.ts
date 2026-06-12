import { getClearanceInstructions } from '@/lib/booth-clearance-policy'
import type { BoothClearancePolicy, BoothContractClause } from '@/types/database'

export const BOOTH_CONTRACT_TEMPLATE_VERSION = '2026-06-12'

export type BoothContractTemplateId =
  | 'payment_terms'
  | 'refund_policy'
  | 'setup_teardown'
  | 'conduct'
  | 'insurance'
  | 'attendance_full'
  | 'attendance_partial'
  | 'marketing_consent'

interface BoothContractTemplateDefinition {
  id: BoothContractTemplateId
  title: string
  category: string
  defaultEnabled: boolean
  buildBody: (context: BoothContractTemplateContext) => string
  isApplicable?: (context: BoothContractTemplateContext) => boolean
}

export interface BoothContractTemplateContext {
  requireFullAttendance: boolean
  marketInsuranceRequired: boolean
  boothClearancePolicy: BoothClearancePolicy
  eventName?: string
}

const PLATFORM_TEMPLATES: BoothContractTemplateDefinition[] = [
  {
    id: 'payment_terms',
    title: 'Booth fees and payment',
    category: 'payment',
    defaultEnabled: true,
    buildBody: () =>
      'Booth fees displayed at checkout are set by the market coordinator. Payment is due according to the method you select at application (card, Interac e-Transfer, or cash where offered). Unpaid or expired applications may be released to the waitlist.',
  },
  {
    id: 'refund_policy',
    title: 'Cancellations and refunds',
    category: 'payment',
    defaultEnabled: true,
    buildBody: () =>
      'Refund eligibility follows the coordinator\'s published market policy and applicable payment-network rules. Popup Hub processes payments on behalf of coordinators but does not guarantee refunds beyond those policies.',
  },
  {
    id: 'setup_teardown',
    title: 'Setup, teardown, and clearance',
    category: 'operations',
    defaultEnabled: true,
    buildBody: (ctx) => {
      const clearance = getClearanceInstructions(ctx.boothClearancePolicy)
      return `${clearance.body} Arrive on time for your assigned load-in window and do not block aisles during setup or teardown.`
    },
  },
  {
    id: 'conduct',
    title: 'Vendor conduct and compliance',
    category: 'conduct',
    defaultEnabled: true,
    buildBody: () =>
      'You are responsible for your own licenses, permits, insurance, tax obligations, and compliance with local health and safety rules. Misrepresentation, unsafe setups, or harassment may result in removal without refund.',
  },
  {
    id: 'insurance',
    title: 'Market insurance',
    category: 'insurance',
    defaultEnabled: true,
    isApplicable: (ctx) => ctx.marketInsuranceRequired,
    buildBody: () =>
      'This market requires proof of market insurance after coordinator approval. Your booth is not finalized until insurance documentation is uploaded and accepted.',
  },
  {
    id: 'attendance_full',
    title: 'Full-weekend attendance',
    category: 'attendance',
    defaultEnabled: true,
    isApplicable: (ctx) => ctx.requireFullAttendance,
    buildBody: () =>
      'You agree to attend all scheduled days of this market and remain present during published operating hours. Arriving late or packing up early violates organizer policy and may affect future approvals.',
  },
  {
    id: 'attendance_partial',
    title: 'Selected-day attendance',
    category: 'attendance',
    defaultEnabled: true,
    isApplicable: (ctx) => !ctx.requireFullAttendance,
    buildBody: () =>
      'You agree to attend only the market days you select at application and remain present during the operating hours of those specific dates.',
  },
  {
    id: 'marketing_consent',
    title: 'Photos and market promotion',
    category: 'marketing',
    defaultEnabled: false,
    buildBody: (ctx) =>
      `The coordinator may photograph or feature your booth${ctx.eventName ? ` at ${ctx.eventName}` : ''} for market promotion. Contact the organizer before market day if you need an opt-out.`,
  },
]

function templateToClause(
  template: BoothContractTemplateDefinition,
  context: BoothContractTemplateContext,
  sortOrder: number
): BoothContractClause {
  return {
    id: template.id,
    title: template.title,
    body: template.buildBody(context),
    source: 'platform',
    enabled: template.defaultEnabled,
    sort_order: sortOrder,
  }
}

export function buildDefaultEventContractClauses(
  context: BoothContractTemplateContext
): BoothContractClause[] {
  const applicable = PLATFORM_TEMPLATES.filter(
    (template) => template.isApplicable?.(context) ?? true
  )
  return applicable.map((template, index) => templateToClause(template, context, index))
}

export function mergePlatformClauseUpdates(
  existing: BoothContractClause[],
  context: BoothContractTemplateContext
): BoothContractClause[] {
  const defaults = buildDefaultEventContractClauses(context)
  const custom = existing
    .filter((clause) => clause.source === 'custom')
    .sort((a, b) => a.sort_order - b.sort_order)

  const platformById = new Map(
    existing.filter((clause) => clause.source === 'platform').map((clause) => [clause.id, clause])
  )

  const mergedPlatform = defaults.map((defaultClause, index) => {
    const saved = platformById.get(defaultClause.id)
    if (!saved) return { ...defaultClause, sort_order: index }
    return {
      ...defaultClause,
      enabled: saved.enabled,
      sort_order: saved.sort_order ?? index,
    }
  })

  const maxPlatformOrder = mergedPlatform.reduce(
    (max, clause) => Math.max(max, clause.sort_order),
    -1
  )

  const mergedCustom = custom.map((clause, index) => ({
    ...clause,
    sort_order: maxPlatformOrder + 1 + index,
  }))

  return [...mergedPlatform, ...mergedCustom].sort((a, b) => a.sort_order - b.sort_order)
}

export function normalizeEventContractClauses(
  raw: unknown,
  context: BoothContractTemplateContext
): BoothContractClause[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return buildDefaultEventContractClauses(context)
  }

  const parsed: BoothContractClause[] = raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item, index) => ({
      id: String(item.id ?? `custom-${index}`),
      title: String(item.title ?? 'Untitled clause'),
      body: String(item.body ?? ''),
      source: item.source === 'custom' ? 'custom' : 'platform',
      enabled: item.enabled !== false,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index,
    }))

  return mergePlatformClauseUpdates(parsed, context)
}

export function createCustomContractClause(sortOrder: number): BoothContractClause {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Custom clause',
    body: '',
    source: 'custom',
    enabled: true,
    sort_order: sortOrder,
  }
}
