import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'

export type WizardStep2FieldId =
  | 'market-booth-price'
  | 'wizard-zone-capacity-categories'
  | 'wizard-zone-capacity-floor'

export type WizardStep2ValidationError = {
  message: string
  fieldId: WizardStep2FieldId
}

export type WizardStep2ValidationInput = {
  categoryLimits: CategoryLimit[]
  skipVenueLayout: boolean
  requireBoothPrice: boolean
  boothPriceCents: number
  isQuarterAuction?: boolean
}

export function getWizardStep2ValidationError(
  input: WizardStep2ValidationInput
): WizardStep2ValidationError | null {
  const totalCaps = input.categoryLimits.reduce((sum, cl) => sum + (cl.maxSlots ?? 0), 0)

  if (input.categoryLimits.length === 0 || totalCaps <= 0) {
    return {
      message: input.isQuarterAuction
        ? 'Add at least one vendor type with spots available'
        : 'Set at least one vendor category with a booth cap greater than zero',
      fieldId: 'wizard-zone-capacity-categories',
    }
  }

  if (input.requireBoothPrice) {
    if (!Number.isFinite(input.boothPriceCents) || input.boothPriceCents < 0) {
      return {
        message: 'Enter a booth fee (use $0 for free booths)',
        fieldId: 'market-booth-price',
      }
    }
  }

  return null
}

export function focusWizardStep2Field(fieldId: WizardStep2FieldId): void {
  if (typeof document === 'undefined') return

  const zoneId =
    fieldId === 'market-booth-price'
      ? 'wizard-zone-capacity-pricing'
      : fieldId.startsWith('wizard-zone-')
        ? fieldId
        : null

  const el = document.getElementById(fieldId === 'market-booth-price' ? 'market-booth-price' : fieldId)

  const zoneEl = zoneId ? document.getElementById(zoneId) : null
  if (zoneEl) {
    zoneEl.classList.remove('wizard-zone--error')
    void zoneEl.offsetWidth
    zoneEl.classList.add('wizard-zone--error')
    const clearZone = () => {
      zoneEl.classList.remove('wizard-zone--error')
      zoneEl.removeEventListener('animationend', clearZone)
    }
    zoneEl.addEventListener('animationend', clearZone)
    zoneEl.scrollIntoView({
      behavior:
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      block: 'center',
    })
  }

  if (!el) return

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!zoneEl) {
    el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' })
  }

  if (typeof el.focus === 'function') {
    el.focus({ preventScroll: true })
  }
}
