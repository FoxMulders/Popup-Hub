import assert from 'node:assert/strict'
import {
  buildDefaultEventContractClauses,
  normalizeEventContractClauses,
} from '../lib/legal/booth-contract-templates'
import {
  buildBoothContractSnapshot,
  contractContentHash,
  contractRequiresVendorAcknowledgment,
  resolveEventBoothContract,
} from '../lib/booth-contract/resolve-event-contract'
import { buildBoothContractEnhancementPrefill } from '../lib/feedback/booth-contract-enhancement-prefill'

const defaults = buildDefaultEventContractClauses({
  requireFullAttendance: true,
  marketInsuranceRequired: true,
  boothClearancePolicy: 'pack_furniture',
  eventName: 'Test Market',
})

assert(defaults.length >= 6, 'expected multiple default clauses')
assert(
  defaults.some((clause) => clause.id === 'insurance' && clause.enabled),
  'insurance clause should be included when required'
)
assert(
  defaults.some((clause) => clause.id === 'attendance_full'),
  'full attendance clause expected'
)
assert(
  !defaults.some((clause) => clause.id === 'attendance_partial'),
  'partial attendance clause should be excluded'
)

const event = {
  booth_contract_enabled: true,
  booth_contract_clauses: defaults,
  booth_contract_pdf_url: 'https://example.com/contract.pdf',
  booth_contract_updated_at: '2026-06-12T12:00:00.000Z',
  require_full_attendance: true,
  market_insurance_required: true,
  booth_clearance_policy: 'pack_furniture' as const,
  name: 'Test Market',
}

const resolved = resolveEventBoothContract(event)
assert(resolved.clauses.length > 0, 'resolved contract should have clauses')
assert(contractRequiresVendorAcknowledgment(event), 'contract should require acknowledgment')

const hash = contractContentHash(resolved.clauses, resolved.pdfUrl)
assert(hash.length === 16, 'content hash should be 16 chars')

const snapshot = buildBoothContractSnapshot({
  clauses: resolved.clauses,
  pdfUrl: resolved.pdfUrl,
  acknowledgedAt: '2026-06-12T12:00:00.000Z',
  signature: {
    method: 'digital',
    signedName: 'Jane Vendor',
    signatureImageUrl: 'https://example.com/sig.png',
    signedAt: '2026-06-12T12:01:00.000Z',
  },
})
assert(snapshot.content_hash === hash, 'snapshot hash should match')
assert(snapshot.signature_method === 'digital', 'snapshot should include signature method')
assert(snapshot.signed_name === 'Jane Vendor', 'snapshot should include signed name')

const uploadedSnapshot = buildBoothContractSnapshot({
  clauses: resolved.clauses,
  pdfUrl: resolved.pdfUrl,
  acknowledgedAt: '2026-06-12T12:00:00.000Z',
  signature: {
    method: 'uploaded',
    signedDocumentUrl: 'https://example.com/signed.pdf',
    signedAt: '2026-06-12T12:02:00.000Z',
  },
})
assert(uploadedSnapshot.signature_method === 'uploaded', 'uploaded signature method expected')
assert(uploadedSnapshot.signed_document_url === 'https://example.com/signed.pdf', 'signed doc url expected')

const disabled = {
  ...event,
  booth_contract_enabled: false,
}
assert(!contractRequiresVendorAcknowledgment(disabled), 'disabled contract should not require ack')

const merged = normalizeEventContractClauses([], {
  requireFullAttendance: false,
  marketInsuranceRequired: false,
  boothClearancePolicy: 'leave_furniture',
})
assert(
  merged.some((clause) => clause.id === 'attendance_partial'),
  'partial attendance clause expected when full attendance off'
)

const prefill = buildBoothContractEnhancementPrefill({
  eventName: 'Test Market',
  enabledClauseCount: 5,
  customClauseCount: 1,
  hasPdf: true,
})
assert(prefill.targetComponent === 'booth_contracts')
assert(prefill.title.length > 0)

console.log('verify-booth-contracts: PASS')
