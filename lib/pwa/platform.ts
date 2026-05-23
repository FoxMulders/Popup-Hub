export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent
  const isClassicIos = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1

  return isClassicIos || isIpadOs
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false

  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches

  return iosStandalone || displayModeStandalone
}

export function canShowIosInstallCoach(): boolean {
  return isIosDevice() && !isStandaloneDisplayMode()
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof (event as BeforeInstallPromptEvent).prompt === 'function'
}
