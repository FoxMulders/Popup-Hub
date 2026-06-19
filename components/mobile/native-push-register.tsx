'use client'

import { useEffect } from 'react'
import { isNativeApp, getNativePlatform } from '@/lib/mobile/native-app'

/** Registers Capacitor push token with the API when running in native shell. */
export function NativePushRegister() {
  useEffect(() => {
    if (!isNativeApp()) return

    void import('@capacitor/push-notifications')
      .then(({ PushNotifications }) => {
        void PushNotifications.requestPermissions().then((result) => {
          if (result.receive !== 'granted') return
          void PushNotifications.register()
        })

        void PushNotifications.addListener('registration', (token) => {
          const platform = getNativePlatform()
          if (platform === 'web') return
          void fetch('/api/mobile/push/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.value, platform }),
          })
        })
      })
      .catch(() => {
        /* push plugin unavailable */
      })
  }, [])

  return null
}
