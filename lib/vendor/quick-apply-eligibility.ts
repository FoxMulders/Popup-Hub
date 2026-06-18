import { contractRequiresVendorAcknowledgment } from '@/lib/booth-contract/resolve-event-contract'
import { evaluatePassportCategoryMatch, type CategorySlotInfo } from '@/lib/vendor/application-category-match'
import { isPassportReadyForApplication } from '@/lib/vendor/passport-application'
import type { Event } from '@/types/database'

export type QuickApplyEligibility =
  | { eligible: true; reason: 'instant' | 'juried' }
  | { eligible: false; reason: 'passport' | 'contract' | 'documentation' | 'category' | 'closed' }

export function evaluateQuickApplyEligibility(input: {
  event: Event
  applicationsOpen: boolean
  passport: Pick<
    import('@/types/database').VendorPassport,
    'business_name' | 'primary_category_id' | 'category_ids'
  > | null
  slots: CategorySlotInfo[]
}): QuickApplyEligibility {
  if (!input.applicationsOpen) {
    return { eligible: false, reason: 'closed' }
  }

  if (!isPassportReadyForApplication(input.passport)) {
    return { eligible: false, reason: 'passport' }
  }

  if (contractRequiresVendorAcknowledgment(input.event)) {
    return { eligible: false, reason: 'contract' }
  }

  const match = evaluatePassportCategoryMatch(
    {
      category_ids: input.passport?.category_ids,
      primary_category_id: input.passport?.primary_category_id,
    },
    input.slots
  )

  if (!match.resolvedSlot && !match.allCategoriesFull) {
    return { eligible: false, reason: 'category' }
  }

  const slot = match.resolvedSlot ?? match.passportSlots[0]
  if (slot?.requiresDocumentation) {
    return { eligible: false, reason: 'documentation' }
  }

  if (input.event.booking_mode === 'instant') {
    return { eligible: true, reason: 'instant' }
  }

  return { eligible: true, reason: 'juried' }
}
