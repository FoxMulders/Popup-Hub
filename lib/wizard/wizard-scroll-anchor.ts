import { resetScrollToTop } from '@/lib/navigation/scroll-to-top'

/** Reset scroll when a wizard changes steps so users land at the top of the new step. */
export function resetWizardScrollAnchor(_step?: number): void {
  resetScrollToTop()
}
