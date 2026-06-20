/**
 * Reset every scroll host so route and portal switches land at the top.
 * Market setup pages scroll inside `.setup-wizard-body` (not the window).
 */
export function scrollAllHostsToTop(): void {
  if (typeof window === 'undefined') return

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0

  const siteMain = document.getElementById('site-main')
  if (siteMain instanceof HTMLElement) siteMain.scrollTop = 0

  document.querySelectorAll('.setup-wizard-body').forEach((node) => {
    if (node instanceof HTMLElement) node.scrollTop = 0
  })
}

/** Run immediately and again after layout settles (overflow rules may change post-commit). */
export function resetScrollToTop(): void {
  scrollAllHostsToTop()
  window.requestAnimationFrame(() => {
    scrollAllHostsToTop()
  })
}
