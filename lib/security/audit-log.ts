import {
  SECURITY_AUDIT_ACTION,
  writeSecurityAuditLog,
  type SecurityAuditActionType,
} from '@/lib/audit/security-audit-log'

export type SecurityAuditEventType =
  | 'vendor_dispute_suspension'
  | 'vendor_booth_eviction'
  | 'vendor_verification_override'
  | 'passport_qr_blocked'

const EVENT_TO_ACTION: Record<SecurityAuditEventType, SecurityAuditActionType> = {
  vendor_dispute_suspension: SECURITY_AUDIT_ACTION.VENDOR_DISPUTE_SUSPENSION,
  vendor_booth_eviction: SECURITY_AUDIT_ACTION.VENDOR_BOOTH_EVICTION,
  vendor_verification_override: SECURITY_AUDIT_ACTION.APPLICATION_STATUS_CHANGE,
  passport_qr_blocked: SECURITY_AUDIT_ACTION.PASSPORT_QR_BLOCKED,
}

export async function logSecurityEvent(input: {
  eventType: SecurityAuditEventType
  actorId?: string | null
  vendorId?: string | null
  eventId?: string | null
  applicationId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  const actorId = input.actorId ?? input.vendorId
  if (!actorId) {
    console.error('[audit_security_logs] missing actorId', input)
    return
  }

  const actionType = EVENT_TO_ACTION[input.eventType]
  const result = await writeSecurityAuditLog({
    actorId,
    targetVendorId: input.vendorId ?? null,
    applicationId: input.applicationId ?? null,
    actionType,
    previousState: { eventType: input.eventType, ...(input.metadata ?? {}) },
    newState: {
      eventId: input.eventId ?? null,
      recordedAt: new Date().toISOString(),
    },
    ipAddress: null,
  })

  if (!result.ok) {
    console.error('[audit_security_logs] insert failed:', result.error, input)
  }
}
