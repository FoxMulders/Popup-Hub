import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApplicationPaymentStatus, ApplicationStatus, PaymentMethod, PaymentStatus } from '@/types/database'
import {
  isApplicationAwaitingBoothPayment,
  isOfflinePaymentMethod,
} from '@/lib/applications/payment-fields'
import {
  notifyCoordinatorPaymentReleased,
  notifyVendorPaymentChase,
} from '@/lib/applications/notify-vendor-payment-chase'
import {
  buildAuditStateFromUpdates,
  SECURITY_AUDIT_ACTION,
  snapshotApplicationAuditState,
  writeSecurityAuditLog,
} from '@/lib/audit/security-audit-log'
import { resolveVendorDisplayName } from '@/lib/email/application-received'
import type { BoothCell, BoothLayout, LayoutRoom } from '@/types/database'

export type UnpaidApplicationRow = {
  id: string
  vendor_id: string
  event_id: string
  category_id: string
  status: ApplicationStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  application_payment_status: ApplicationPaymentStatus | null
  booth_number: number | null
  vendor?: { full_name: string | null; email: string | null; phone?: string | null } | null
  event?: {
    id: string
    name: string | null
    coordinator_id: string
  } | null
  passport?: { business_name: string | null } | null
}

function clearVendorFromLayoutCells(
  cells: BoothCell[] | undefined,
  vendorId: string,
  applicationId: string
): BoothCell[] {
  if (!cells?.length) return []
  return cells.map((cell) => {
    if (cell.id === vendorId || cell.id === applicationId) {
      return { ...cell, id: `open-${cell.id}`, vendorName: '' }
    }
    return cell
  })
}

function clearVendorFromLayoutRooms(
  rooms: LayoutRoom[] | undefined,
  vendorId: string,
  applicationId: string
): LayoutRoom[] {
  if (!rooms?.length) return []
  return rooms.map((room) => ({
    ...room,
    cells: clearVendorFromLayoutCells(room.cells, vendorId, applicationId),
  }))
}

async function clearFloorPlanVendorAssignment(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string,
  applicationId: string
): Promise<void> {
  const { data: layout } = await supabase
    .from('booth_layouts')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (!layout) return

  const row = layout as BoothLayout
  const nextCells = clearVendorFromLayoutCells(row.cells, vendorId, applicationId)
  const nextRooms = clearVendorFromLayoutRooms(row.layout_rooms, vendorId, applicationId)

  const cellsChanged = JSON.stringify(nextCells) !== JSON.stringify(row.cells ?? [])
  const roomsChanged = JSON.stringify(nextRooms) !== JSON.stringify(row.layout_rooms ?? [])
  if (!cellsChanged && !roomsChanged) return

  await supabase
    .from('booth_layouts')
    .update({
      cells: nextCells,
      ...(nextRooms.length ? { layout_rooms: nextRooms } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
}

/** Cancel an unpaid application, release its booth slot, and notify vendor + coordinator. */
export async function releaseUnpaidApplication(
  supabase: SupabaseClient,
  app: UnpaidApplicationRow,
  now: Date = new Date()
): Promise<{ released: boolean }> {
  const nowIso = now.toISOString()
  const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor
  const event = Array.isArray(app.event) ? app.event[0] : app.event
  const passport = Array.isArray(app.passport) ? app.passport[0] : app.passport

  const updates: Record<string, unknown> = {
    status: 'cancelled',
    booth_number: null,
    payment_due_at: null,
    last_payment_reminder_at: null,
    payment_reminder_stage: 0,
    updated_at: nowIso,
  }

  if (isOfflinePaymentMethod(app.payment_method)) {
    updates.application_payment_status = 'EXPIRED'
  }

  // Atomic guard: only cancel if payment is still outstanding. Prevents a cron
  // race where a vendor completes checkout after the chase query snapshot.
  if (!isApplicationAwaitingBoothPayment(app)) {
    return { released: false }
  }

  const { data: updated, error: updateError } = await supabase
    .from('booth_applications')
    .update(updates)
    .eq('id', app.id)
    .neq('status', 'cancelled')
    .or(
      'payment_status.eq.payment_required,and(application_payment_status.eq.PENDING_REVIEW,payment_method.in.(ETRANSFER,CASH))'
    )
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('[release-unpaid-application] update failed:', updateError)
    return { released: false }
  }

  if (!updated) {
    return { released: false }
  }

  if (event?.coordinator_id) {
    const previousState = snapshotApplicationAuditState(app)
    const newState = buildAuditStateFromUpdates(previousState, {
      status: 'cancelled',
      application_payment_status: isOfflinePaymentMethod(app.payment_method)
        ? 'EXPIRED'
        : app.application_payment_status,
      payment_status: app.payment_status,
      payment_method: app.payment_method,
    })
    await writeSecurityAuditLog({
      actorId: event.coordinator_id,
      targetVendorId: app.vendor_id,
      applicationId: app.id,
      actionType: SECURITY_AUDIT_ACTION.PAYMENT_DEADLINE_EXPIRY,
      previousState,
      newState,
      ipAddress: null,
    })
  }

  await supabase
    .from('event_booth_slots')
    .update({ claimed_by_application_id: null, updated_at: nowIso })
    .eq('claimed_by_application_id', app.id)

  await clearFloorPlanVendorAssignment(supabase, app.event_id, app.vendor_id, app.id)

  const vendorName = resolveVendorDisplayName(passport ?? null, vendor ?? null)
  const eventName = event?.name ?? 'the market'

  await notifyVendorPaymentChase({
    supabase,
    vendorId: app.vendor_id,
    vendorEmail: vendor?.email,
    vendorName,
    vendorPhone: vendor?.phone,
    applicationId: app.id,
    eventId: app.event_id,
    eventName,
    kind: 'expired',
  })

  if (event?.coordinator_id) {
    await notifyCoordinatorPaymentReleased({
      supabase,
      coordinatorId: event.coordinator_id,
      vendorName,
      eventName,
      applicationId: app.id,
      eventId: app.event_id,
    })
  }

  return { released: true }
}
