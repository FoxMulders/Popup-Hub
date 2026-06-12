import { createHash } from 'crypto'
import { normalizeEventContractClauses } from '@/lib/legal/booth-contract-templates'
import type {
  BoothClearancePolicy,
  BoothContractClause,
  BoothContractSnapshot,
  Event,
} from '@/types/database'

export interface ResolvedEventBoothContract {
  enabled: boolean
  clauses: BoothContractClause[]
  pdfUrl: string | null
  updatedAt: string | null
}

export function boothContractTemplateContextFromEvent(
  event: Pick<
    Event,
    'require_full_attendance' | 'market_insurance_required' | 'booth_clearance_policy' | 'name'
  >
) {
  return {
    requireFullAttendance: event.require_full_attendance ?? true,
    marketInsuranceRequired: Boolean(event.market_insurance_required),
    boothClearancePolicy: (event.booth_clearance_policy ?? 'leave_furniture') as BoothClearancePolicy,
    eventName: event.name,
  }
}

export function resolveEventBoothContract(
  event: Pick<
    Event,
    | 'booth_contract_enabled'
    | 'booth_contract_clauses'
    | 'booth_contract_pdf_url'
    | 'booth_contract_updated_at'
    | 'require_full_attendance'
    | 'market_insurance_required'
    | 'booth_clearance_policy'
    | 'name'
  >
): ResolvedEventBoothContract {
  const context = boothContractTemplateContextFromEvent(event)
  const clauses = normalizeEventContractClauses(event.booth_contract_clauses, context).filter(
    (clause) => clause.enabled && clause.body.trim().length > 0
  )

  return {
    enabled: event.booth_contract_enabled !== false,
    clauses,
    pdfUrl: event.booth_contract_pdf_url ?? null,
    updatedAt: event.booth_contract_updated_at ?? null,
  }
}

export function contractRequiresVendorAcknowledgment(
  event: Pick<
    Event,
    | 'booth_contract_enabled'
    | 'booth_contract_clauses'
    | 'booth_contract_pdf_url'
    | 'require_full_attendance'
    | 'market_insurance_required'
    | 'booth_clearance_policy'
    | 'name'
  >
): boolean {
  const resolved = resolveEventBoothContract(event)
  return resolved.enabled && (resolved.clauses.length > 0 || Boolean(resolved.pdfUrl))
}

export function contractContentHash(
  clauses: BoothContractClause[],
  pdfUrl: string | null
): string {
  const payload = JSON.stringify({
    clauses: clauses.map((clause) => ({
      id: clause.id,
      title: clause.title,
      body: clause.body,
      source: clause.source,
      enabled: clause.enabled,
      sort_order: clause.sort_order,
    })),
    pdfUrl: pdfUrl ?? null,
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

export function buildBoothContractSnapshot(input: {
  clauses: BoothContractClause[]
  pdfUrl: string | null
  acknowledgedAt: string
}): BoothContractSnapshot {
  return {
    content_hash: contractContentHash(input.clauses, input.pdfUrl),
    clauses: input.clauses,
    pdf_url: input.pdfUrl,
    acknowledged_at: input.acknowledgedAt,
  }
}

export function enabledContractClausesForStorage(clauses: BoothContractClause[]): BoothContractClause[] {
  return [...clauses]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((clause, index) => ({ ...clause, sort_order: index }))
}
