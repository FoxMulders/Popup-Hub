export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent
  const mobileUa = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const ipadOs =
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1

  if (mobileUa || ipadOs) return true

  return window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent
  const isClassicIos = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs =
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1

  return isClassicIos || isIpadOs
}

/** True for mobile Safari where Add to Home Screen is supported. */
export function isIosSafari(): boolean {
  if (!isIosDevice()) return false

  const ua = navigator.userAgent
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua)
}

export function isIosNonSafariBrowser(): boolean {
  return isIosDevice() && !isIosSafari()
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false

  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches

  return iosStandalone || displayModeStandalone
}

export function canShowIosInstallCoach(): boolean {
  return isIosSafari() && !isStandaloneDisplayMode()
}

export function canShowIosOpenInSafariCoach(): boolean {
  return isIosNonSafariBrowser() && !isStandaloneDisplayMode()
}

export function canShowAndroidInstallPrompt(): boolean {
  return isAndroidDevice() && !isStandaloneDisplayMode()
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof (event as BeforeInstallPromptEvent).prompt === 'function'
}
