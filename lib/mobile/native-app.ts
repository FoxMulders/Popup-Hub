/** Capacitor / native shell detection (client-only). */

export type NativePlatform = 'ios' | 'android' | 'web'

const NATIVE_APP_COOKIE = 'native_app'
const NATIVE_APP_VALUE = 'popup-hub'

export function getNativePlatform(): NativePlatform {
  if (typeof window === 'undefined') return 'web'
  const cap = (
    window as Window & { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } }
  ).Capacitor
  if (!cap?.isNativePlatform?.()) return 'web'
  const platform = cap.getPlatform?.()
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'web'
}

export function isNativeApp(): boolean {
  return getNativePlatform() !== 'web'
}

export function markNativeAppCookie(): void {
  if (typeof document === 'undefined' || !isNativeApp()) return
  document.cookie = `${NATIVE_APP_COOKIE}=${NATIVE_APP_VALUE};path=/;max-age=31536000;SameSite=Lax`
}

export function readNativeAppCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((part) => part.trim() === `${NATIVE_APP_COOKIE}=${NATIVE_APP_VALUE}`)
}
