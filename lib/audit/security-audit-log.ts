import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import type {
  ApplicationPaymentStatus,
  ApplicationStatus,
  BoothApplication,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'

export const SECURITY_AUDIT_ACTION = {
  MANUAL_PAYMENT_CLEARANCE: 'MANUAL_PAYMENT_CLEARANCE',
  STATE_OVERRIDE_APPROVAL: 'STATE_OVERRIDE_APPROVAL',
  APPLICATION_STATUS_CHANGE: 'APPLICATION_STATUS_CHANGE',
  VENDOR_DISPUTE_SUSPENSION: 'VENDOR_DISPUTE_SUSPENSION',
  VENDOR_BOOTH_EVICTION: 'VENDOR_BOOTH_EVICTION',
  PASSPORT_QR_BLOCKED: 'PASSPORT_QR_BLOCKED',
  COORDINATOR_COMMUNITY_VERIFIED: 'COORDINATOR_COMMUNITY_VERIFIED',
  COORDINATOR_ESCROW_RELEASE: 'COORDINATOR_ESCROW_RELEASE',
  COORDINATOR_VENDOR_VOUCH: 'COORDINATOR_VENDOR_VOUCH',
} as const

export type SecurityAuditActionType =
  (typeof SECURITY_AUDIT_ACTION)[keyof typeof SECURITY_AUDIT_ACTION]

export interface ApplicationAuditState {
  status: ApplicationStatus
  payment_method: PaymentMethod | null
  application_payment_status: ApplicationPaymentStatus | null
  payment_status: PaymentStatus
}

export interface WriteSecurityAuditLogParams {
  actorId: string
  targetVendorId: string | null
  applicationId: string | null
  actionType: SecurityAuditActionType
  previousState: ApplicationAuditState | Record<string, unknown>
  newState: ApplicationAuditState | Record<string, unknown>
  ipAddress: string | null
}

export interface MutateApplicationWithSecurityAuditParams {
  applicationId: string
  actorId: string
  targetVendorId: string
  actionType: SecurityAuditActionType
  previousState: ApplicationAuditState
  newState: ApplicationAuditState
  updates: Partial<BoothApplication>
  ipAddress: string | null
}

export function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    return first || null
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp || null
}

export function snapshotApplicationAuditState(
  application: Pick<
    BoothApplication,
    'status' | 'payment_method' | 'application_payment_status' | 'payment_status'
  >
): ApplicationAuditState {
  return {
    status: application.status,
    payment_method: application.payment_method,
    application_payment_status: application.application_payment_status,
    payment_status: application.payment_status,
  }
}

export function buildAuditStateFromUpdates(
  previous: ApplicationAuditState,
  updates: Partial<BoothApplication>
): ApplicationAuditState {
  return {
    status: updates.status ?? previous.status,
    payment_method:
      updates.payment_method !== undefined
        ? updates.payment_method
        : previous.payment_method,
    application_payment_status:
      updates.application_payment_status !== undefined
        ? updates.application_payment_status
        : previous.application_payment_status,
    payment_status: updates.payment_status ?? previous.payment_status,
  }
}

export function resolveApprovalAuditAction(
  resolvedStatus: ApplicationStatus
): SecurityAuditActionType {
  return resolvedStatus === 'approved' || resolvedStatus === 'pending_insurance'
    ? SECURITY_AUDIT_ACTION.STATE_OVERRIDE_APPROVAL
    : SECURITY_AUDIT_ACTION.APPLICATION_STATUS_CHANGE
}

/**
 * Append-only audit insert. Prefer mutateApplicationWithSecurityAudit for
 * coordinator state changes so the log row commits atomically with the mutation.
 */
export async function writeSecurityAuditLog(
  params: WriteSecurityAuditLogParams
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('audit_security_logs')
    .insert({
      actor_id: params.actorId,
      target_vendor_id: params.targetVendorId,
      application_id: params.applicationId,
      action_type: params.actionType,
      previous_state: params.previousState,
      new_state: params.newState,
      ip_address: params.ipAddress,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to write security audit log' }
  }

  return { ok: true, id: data.id }
}

/**
 * Atomically apply booth application updates and append an audit row via RPC.
 * If the audit insert fails, the application update is rolled back.
 */
export async function mutateApplicationWithSecurityAudit(
  supabase: SupabaseClient,
  params: MutateApplicationWithSecurityAuditParams
): Promise<
  | { ok: true; application: BoothApplication }
  | { ok: false; error: string; code?: string }
> {
  const { data, error } = await supabase.rpc('mutate_booth_application_with_security_audit', {
    p_application_id: params.applicationId,
    p_actor_id: params.actorId,
    p_target_vendor_id: params.targetVendorId,
    p_action_type: params.actionType,
    p_previous_state: params.previousState,
    p_new_state: params.newState,
    p_updates: params.updates,
    p_ip_address: params.ipAddress,
  })

  if (error) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
    }
  }

  const payload = data as { application?: BoothApplication } | null
  if (!payload?.application) {
    return { ok: false, error: 'Mutation RPC returned no application row' }
  }

  return { ok: true, application: payload.application }
}
