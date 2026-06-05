'use client'

import { useCallback, useEffect, useState } from 'react'

export type NotificationEvent =
  | 'application_approvals'
  | 'wallet_payouts'
  | 'waitlist_updates'

export type NotificationChannel = 'email' | 'sms' | 'push'

export type NotificationPreferences = Record<
  NotificationEvent,
  Record<NotificationChannel, boolean>
>

export const NOTIFICATION_EVENTS: {
  id: NotificationEvent
  label: string
  description: string
}[] = [
  {
    id: 'application_approvals',
    label: 'Application approvals',
    description: 'Vendor application decisions and coordinator review updates.',
  },
  {
    id: 'wallet_payouts',
    label: 'Wallet payouts',
    description: 'Payout confirmations, deposits, and wallet balance alerts.',
  },
  {
    id: 'waitlist_updates',
    label: 'Waitlist updates',
    description: 'Waitlist promotions and spot availability changes.',
  },
]

export const NOTIFICATION_CHANNELS: {
  id: NotificationChannel
  label: string
}[] = [
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'push', label: 'Push' },
]

const STORAGE_PREFIX = 'popup-hub:notification-preferences'

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  application_approvals: { email: true, sms: true, push: true },
  wallet_payouts: { email: true, sms: false, push: true },
  waitlist_updates: { email: true, sms: true, push: true },
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function parseStoredPreferences(raw: string | null): NotificationPreferences | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>
    const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES }
    for (const event of NOTIFICATION_EVENTS) {
      merged[event.id] = {
        ...DEFAULT_NOTIFICATION_PREFERENCES[event.id],
        ...(parsed[event.id] ?? {}),
      }
    }
    return merged
  } catch {
    return null
  }
}

export function useNotificationPreferences(userId: string) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = parseStoredPreferences(
      window.localStorage.getItem(storageKey(userId))
    )
    if (stored) setPreferences(stored)
    setHydrated(true)
  }, [userId])

  const persist = useCallback(
    (next: NotificationPreferences) => {
      setPreferences(next)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
      }
    },
    [userId]
  )

  const setChannel = useCallback(
    (event: NotificationEvent, channel: NotificationChannel, enabled: boolean) => {
      persist({
        ...preferences,
        [event]: {
          ...preferences[event],
          [channel]: enabled,
        },
      })
    },
    [persist, preferences]
  )

  return {
    preferences,
    hydrated,
    setChannel,
    setPreferences: persist,
  }
}
