const BANNER_DISMISSED_KEY = 'popuphub.layout-editor-help.banner-dismissed'
const AUTO_TOUR_DISMISSED_KEY = 'popuphub.layout-editor-help.auto-tour-dismissed'
const ENGAGED_KEY = 'popuphub.layout-editor-help.engaged'

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}

export function isLayoutHelpBannerDismissed(): boolean {
  return readFlag(BANNER_DISMISSED_KEY)
}

export function dismissLayoutHelpBanner() {
  writeFlag(BANNER_DISMISSED_KEY, true)
}

export function isLayoutHelpAutoTourDismissed(): boolean {
  return readFlag(AUTO_TOUR_DISMISSED_KEY)
}

/** Opt out of the first-visit guided tour that starts automatically. Manual tours still work. */
export function dismissLayoutHelpAutoTour() {
  writeFlag(AUTO_TOUR_DISMISSED_KEY, true)
  markLayoutHelpEngaged()
}

export function hasEngagedWithLayoutHelp(): boolean {
  return readFlag(ENGAGED_KEY)
}

export function markLayoutHelpEngaged() {
  writeFlag(ENGAGED_KEY, true)
}
