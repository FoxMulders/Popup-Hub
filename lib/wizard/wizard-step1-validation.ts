import { effectiveScheduleTypeForListing, isQuarterAuctionListing } from '@/lib/events/listing-type'
import {
  resolveEventScheduleBounds,
  scheduleBoundsFailureMessage,
  type ScheduleBoundsFailureReason,
} from '@/lib/events/schedule-bounds'
import type { EventListingType } from '@/types/database'
import { WIZARD_FIELD_ERROR_CLASS } from '@/components/coordinator/wizard/wizard-ui'
import type { DayRow } from '@/components/coordinator/wizard/wizard-step-event-details'

export type WizardStep1FieldId =
  | 'wizard-event-name'
  | 'wizard-description'
  | 'wizard-start-date'
  | 'wizard-end-date'
  | 'wizard-day-date'
  | 'wizard-loc-name'
  | 'wizard-address'
  | 'wizard-venue-map'
  | 'edmonton-venue-template'

export type WizardStep1ValidationError = {
  message: string
  fieldId: WizardStep1FieldId
  /** For multi-day rows — index of the day row to focus. */
  dayRowIndex?: number
}

export type WizardStep1ValidationInput = {
  name: string
  description: string
  listingType: EventListingType
  scheduleType: 'single' | 'multi'
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  dayRows: DayRow[]
  locationName: string
  address: string
  pinDropped: boolean
  skipVenueLayout: boolean
  templateWidth: number
  templateLength: number
}

function scheduleFieldForReason(
  reason: ScheduleBoundsFailureReason,
  listingType: EventListingType,
  scheduleType: 'single' | 'multi',
  dayRows: DayRow[],
  startDate: string
): { fieldId: WizardStep1FieldId; dayRowIndex?: number } {
  const effectiveSchedule = effectiveScheduleTypeForListing(listingType, scheduleType)
  if (effectiveSchedule === 'multi') {
    const incompleteIndex = dayRows.findIndex((r) => !r.date || !r.start_time || !r.end_time)
    if (incompleteIndex >= 0) {
      return { fieldId: 'wizard-day-date', dayRowIndex: incompleteIndex }
    }
    return { fieldId: 'wizard-day-date', dayRowIndex: 0 }
  }
  if (reason === 'end_before_start') {
    return { fieldId: 'wizard-end-date' }
  }
  if (!startDate.trim()) {
    return { fieldId: 'wizard-start-date' }
  }
  return { fieldId: 'wizard-start-date' }
}

export function getWizardStep1ValidationError(
  input: WizardStep1ValidationInput
): WizardStep1ValidationError | null {
  if (!input.name.trim()) {
    return { message: 'Event name is required', fieldId: 'wizard-event-name' }
  }

  if (isQuarterAuctionListing(input.listingType) && input.scheduleType === 'multi') {
    return {
      message: 'Quarter auctions must be single-day events.',
      fieldId: 'wizard-start-date',
    }
  }

  const bounds = resolveEventScheduleBounds({
    listingType: input.listingType,
    scheduleType: input.scheduleType,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate: input.endDate,
    endTime: input.endTime,
    dayRows: input.dayRows,
  })

  if (!bounds.ok) {
    const { fieldId, dayRowIndex } = scheduleFieldForReason(
      bounds.reason,
      input.listingType,
      input.scheduleType,
      input.dayRows,
      input.startDate
    )
    return {
      message: scheduleBoundsFailureMessage(bounds.reason),
      fieldId,
      dayRowIndex,
    }
  }

  if (input.skipVenueLayout) {
    if (!input.locationName.trim()) {
      return { message: 'Venue name is required', fieldId: 'wizard-loc-name' }
    }
    if (!input.address.trim()) {
      return { message: 'Venue address is required', fieldId: 'wizard-address' }
    }
    if (!input.pinDropped) {
      return {
        message: 'Drop a map pin for the venue location',
        fieldId: 'wizard-venue-map',
      }
    }
    return null
  }

  if (input.templateWidth < 10 || input.templateLength < 10) {
    return {
      message: 'Select a venue template or set dimensions (min 10 ft)',
      fieldId: 'edmonton-venue-template',
    }
  }

  if (!input.pinDropped) {
    return {
      message: 'Drop a map pin for the venue location',
      fieldId: 'wizard-venue-map',
    }
  }

  return null
}

export function focusWizardField(
  fieldId: WizardStep1FieldId,
  options?: { dayRowIndex?: number }
): void {
  if (typeof document === 'undefined') return

  let el: HTMLElement | null = null

  if (fieldId === 'wizard-day-date') {
    const index = options?.dayRowIndex ?? 0
    el = document.getElementById(`wizard-day-${index}-date`)
  } else {
    el = document.getElementById(fieldId)
  }

  if (!el) return

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' })

  el.classList.remove(WIZARD_FIELD_ERROR_CLASS)
  // Force reflow so repeated validation re-triggers the shake animation.
  void el.offsetWidth

  const errorTargets = new Set<HTMLElement>([el])
  const floatingWrapper = el.closest<HTMLElement>('.wizard-floating-field')
  if (floatingWrapper) errorTargets.add(floatingWrapper)

  for (const target of errorTargets) {
    target.classList.add(WIZARD_FIELD_ERROR_CLASS)
    const removeErrorClass = () => {
      target.classList.remove(WIZARD_FIELD_ERROR_CLASS)
      target.removeEventListener('animationend', removeErrorClass)
    }
    target.addEventListener('animationend', removeErrorClass)
  }

  const focusTarget =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLButtonElement
      ? el
      : (el.querySelector<HTMLElement>(
          'input, textarea, select, button[role="combobox"], [role="combobox"]'
        ) ?? el)

  if (typeof focusTarget.focus === 'function') {
    focusTarget.focus({ preventScroll: true })
  }
}
