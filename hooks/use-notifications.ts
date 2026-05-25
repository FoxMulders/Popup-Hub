'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getVapidPublicKey, urlBase64ToUint8Array } from '@/lib/push/vapid'

export type PushPermissionState = NotificationPermission | 'unsupported'

export interface PushSubscriptionPayload {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

function serializeSubscription(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON()
  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    expirationTime: json.expirationTime ?? subscription.expirationTime,
    keys: {
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
  }
}

export function useNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>('default')
  const [subscription, setSubscription] = useState<PushSubscriptionPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSupported = useMemo(() => {
    if (typeof window === 'undefined') return false
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    )
  }, [])

  const syncPermission = useCallback(() => {
    if (!isSupported) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
  }, [isSupported])

  useEffect(() => {
    syncPermission()
  }, [syncPermission])

  const requestPermission = useCallback(async (): Promise<PushSubscriptionPayload | null> => {
    setError(null)

    if (!isSupported) {
      setError('Push notifications are not supported in this browser.')
      return null
    }

    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') {
        setError('Notification permission was not granted.')
        return null
      }

      const registration = await navigator.serviceWorker.ready
      const vapidKey = getVapidPublicKey()

      let pushSubscription = await registration.pushManager.getSubscription()

      if (!pushSubscription && vapidKey) {
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
      } else if (!pushSubscription && !vapidKey) {
        console.info(
          '[push] Permission granted; set NEXT_PUBLIC_VAPID_PUBLIC_KEY to enable PushManager.subscribe().'
        )
        return null
      }

      if (pushSubscription) {
        const payload = serializeSubscription(pushSubscription)
        setSubscription(payload)
        console.info('[push] subscription ready for backend wiring', payload)
        return payload
      }

      return null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not enable notifications'
      setError(message)
      console.error('[push]', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  return {
    permission,
    subscription,
    loading,
    error,
    isSupported,
    requestPermission,
    syncPermission,
  }
}
