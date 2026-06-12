/**
 * Reset scroll when a wizard changes steps so users land at the top of the
 * new step instead of mid-scroll from the previous one.
 *
 * Market setup pages scroll inside `.setup-wizard-body` (not the window), so
 * every plausible scroll host is reset.
 */
function scrollHostsToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0

  const siteMain = document.getElementById('site-main')
  if (siteMain instanceof HTMLElement) siteMain.scrollTop = 0

  document.querySelectorAll('.setup-wizard-body').forEach((node) => {
    if (node instanceof HTMLElement) node.scrollTop = 0
  })
}

export function resetWizardScrollAnchor(_step?: number): void {
  if (typeof window === 'undefined') return

  scrollHostsToTop()
  // Step content and overflow rules may change after React commits; run again
  // on the next frame so the reset sticks after layout settles.
  window.requestAnimationFrame(() => {
    scrollHostsToTop()
  })
}
