import { contractRequiresVendorAcknowledgment } from '@/lib/booth-contract/resolve-event-contract'
import { resolveEventScheduleDays } from '@/lib/events/event-schedule-days'
import type { Event } from '@/types/database'

export type ExpressApplyBody = {
  express?: boolean
  neighborPreference?: string | null
  joinWaitlist?: boolean
  categoryId?: string
  applicableDocumentationUrl?: string | null
  boothContractAcknowledged?: boolean
  tableCount?: number
  attendingEventDayIds?: string[]
  attendingDates?: string[]
}

/** Server guard when client sends `express: true` (one-tap quick apply). */
export function validateExpressVendorApply(
  event: Event,
  body: ExpressApplyBody
): { ok: true } | { ok: false; error: string } {
  if (!body.express) return { ok: true }

  if (body.joinWaitlist) {
    return { ok: false, error: 'Express apply cannot join the waitlist — use the full application form.' }
  }

  if (body.neighborPreference?.trim()) {
    return { ok: false, error: 'Express apply does not support neighbor preferences.' }
  }

  if (body.applicableDocumentationUrl?.trim()) {
    return { ok: false, error: 'Express apply is not available when documentation is required.' }
  }

  if (body.boothContractAcknowledged) {
    return { ok: false, error: 'Express apply cannot include booth contract signatures.' }
  }

  if (contractRequiresVendorAcknowledgment(event)) {
    return { ok: false, error: 'This market requires a signed booth contract — use the full application form.' }
  }

  if (body.tableCount != null && body.tableCount !== 1) {
    return { ok: false, error: 'Express apply supports one table only.' }
  }

  const scheduleDays = resolveEventScheduleDays(event)
  const requireFull = event.require_full_attendance ?? true
  if (!requireFull && scheduleDays.length > 1) {
    const dayIds = body.attendingEventDayIds ?? []
    const dates = body.attendingDates ?? []
    const hasSingleDay =
      dayIds.length === 1 || (dayIds.length === 0 && dates.length === 1)
    const hasAllDays =
      dayIds.length === scheduleDays.length ||
      dates.length === scheduleDays.length
    if (!hasSingleDay && !hasAllDays) {
      return {
        ok: false,
        error: 'Select which day(s) you will attend — use the full application form.',
      }
    }
  }

  return { ok: true }
}
