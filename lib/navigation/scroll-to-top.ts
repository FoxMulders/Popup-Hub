import { isCoordinatorStudioPath } from '@/lib/coordinator/coordinator-routes'

/** Minimum scroll offset before the floating back-to-top control appears. */
export const SCROLL_TO_TOP_THRESHOLD_PX = 400

const SCROLL_HOST_SELECTORS = [
  '#site-main',
  '.setup-wizard-body',
  '.ecosystem-panel > div',
] as const

function forEachScrollHost(run: (el: HTMLElement) => void): void {
  if (typeof document === 'undefined') return

  for (const selector of SCROLL_HOST_SELECTORS) {
    document.querySelectorAll(selector).forEach((node) => {
      if (node instanceof HTMLElement) run(node)
    })
  }
}

function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'instant'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
}

/**
 * Reset every scroll host so route and portal switches land at the top.
 * Market setup pages scroll inside `.setup-wizard-body` (not the window).
 */
export function scrollAllHostsToTop(): void {
  if (typeof window === 'undefined') return

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0

  forEachScrollHost((el) => {
    el.scrollTop = 0
  })
}

/** Smooth scroll for the floating back-to-top control. */
export function smoothScrollAllHostsToTop(): void {
  if (typeof window === 'undefined') return

  const behavior = scrollBehavior()

  window.scrollTo({ top: 0, left: 0, behavior })
  document.documentElement.scrollTo({ top: 0, left: 0, behavior })
  document.body.scrollTo({ top: 0, left: 0, behavior })

  forEachScrollHost((el) => {
    el.scrollTo({ top: 0, left: 0, behavior })
  })
}

/** Largest scroll offset across window and known nested scroll hosts. */
export function getMaxScrollOffset(): number {
  if (typeof window === 'undefined') return 0

  let max = Math.max(
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop
  )

  forEachScrollHost((el) => {
    max = Math.max(max, el.scrollTop)
  })

  return max
}

/** Immersive canvas / scanner routes where a page-level back-to-top control is distracting. */
export function routeSuppressesScrollToTopButton(pathname: string): boolean {
  if (/\/print(\/|$)/.test(pathname) || /\/checkin(\/|$)/.test(pathname)) return true
  if (isCoordinatorStudioPath(pathname)) return true
  if (/\/coordinator\/events\/[^/]+\/layout\/?$/.test(pathname)) return true
  if (
    pathname === '/coordinator/experience-designer' ||
    pathname.startsWith('/coordinator/experience-designer/')
  ) {
    return true
  }
  return false
}

/** Fullscreen / canvas modes that temporarily hide the floating control. */
export function isScrollToTopDomSuppressed(): boolean {
  if (typeof document === 'undefined') return false

  const html = document.documentElement
  const body = document.body

  return (
    html.classList.contains('command-center-canvas-fullscreen') ||
    html.classList.contains('hub-grid-focus-mode') ||
    html.hasAttribute('data-layout-canvas') ||
    body.hasAttribute('data-layout-canvas')
  )
}

/** Run immediately and again after layout settles (overflow rules may change post-commit). */
export function resetScrollToTop(): void {
  scrollAllHostsToTop()
  window.requestAnimationFrame(() => {
    scrollAllHostsToTop()
  })
}
