import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

export const SCROLL_RESTORE_STORAGE_KEY = 'popup-hub:scroll-restore'

export type ScrollSnapshot = {
  windowY: number
  siteMain?: number
  wizardBodies: number[]
}

function isScrollableElement(node: unknown): node is { scrollTop: number } {
  return (
    typeof node === 'object' &&
    node !== null &&
    'scrollTop' in node &&
    typeof (node as { scrollTop: unknown }).scrollTop === 'number'
  )
}

function readSiteMainScrollTop(): number | undefined {
  const siteMain = document.getElementById('site-main')
  if (isScrollableElement(siteMain)) return siteMain.scrollTop
  return undefined
}

function readWizardBodyScrollTops(): number[] {
  return Array.from(document.querySelectorAll('.setup-wizard-body')).map((node) =>
    isScrollableElement(node) ? node.scrollTop : 0,
  )
}

/** Snapshot every scroll host used by the app shell. */
export function captureScrollPositions(): ScrollSnapshot {
  if (typeof window === 'undefined') {
    return { windowY: 0, wizardBodies: [] }
  }

  return {
    windowY: window.scrollY,
    siteMain: readSiteMainScrollTop(),
    wizardBodies: readWizardBodyScrollTops(),
  }
}

function applyScrollSnapshot(snapshot: ScrollSnapshot): void {
  if (typeof window === 'undefined') return

  window.scrollTo({ top: snapshot.windowY, left: 0, behavior: 'instant' })
  document.documentElement.scrollTop = snapshot.windowY
  document.body.scrollTop = snapshot.windowY

  if (snapshot.siteMain != null) {
    const siteMain = document.getElementById('site-main')
    if (isScrollableElement(siteMain)) siteMain.scrollTop = snapshot.siteMain
  }

  const wizardBodies = document.querySelectorAll('.setup-wizard-body')
  wizardBodies.forEach((node, index) => {
    if (isScrollableElement(node) && index < snapshot.wizardBodies.length) {
      node.scrollTop = snapshot.wizardBodies[index] ?? 0
    }
  })
}

/** Restore scroll immediately and again after layout settles. */
export function restoreScrollPositions(snapshot: ScrollSnapshot): void {
  applyScrollSnapshot(snapshot)
  if (typeof window === 'undefined') return
  window.requestAnimationFrame(() => {
    applyScrollSnapshot(snapshot)
  })
}

export function readStoredScrollSnapshot(): ScrollSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SCROLL_RESTORE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ScrollSnapshot
    if (typeof parsed.windowY !== 'number' || !Array.isArray(parsed.wizardBodies)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearStoredScrollSnapshot(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SCROLL_RESTORE_STORAGE_KEY)
  } catch {
    // sessionStorage can be unavailable in private mode.
  }
}

/** Full page reload that restores scroll on the next paint. */
export function reloadPreservingScroll(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      SCROLL_RESTORE_STORAGE_KEY,
      JSON.stringify(captureScrollPositions()),
    )
  } catch {
    // Fall back to a normal reload when storage is unavailable.
  }
  window.location.reload()
}

/** Soft RSC refresh while keeping every scroll host in place. */
export function refreshPreservingScroll(router: AppRouterInstance): void {
  const snapshot = captureScrollPositions()
  router.refresh()
  restoreScrollPositions(snapshot)
}

/** Segment error-boundary retry on the same URL. */
export function retryPreservingScroll(retry: () => void): void {
  const snapshot = captureScrollPositions()
  retry()
  restoreScrollPositions(snapshot)
}
