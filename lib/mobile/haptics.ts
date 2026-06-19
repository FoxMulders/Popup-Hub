import { isNativeApp } from '@/lib/mobile/native-app'

/** Light haptic on native shell only; no-op on web/PWA. */
export async function triggerSuccessHaptic(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Plugin optional — ignore when unavailable
  }
}
