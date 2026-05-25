'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/hooks/use-notifications'

export function PushNotificationSettings() {
  const { permission, loading, error, isSupported, requestPermission, subscription } =
    useNotifications()

  if (!isSupported) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <h3 className="font-semibold text-foreground mb-2">Push notifications</h3>
        <p className="text-sm text-muted-foreground">
          Install Popup Hub on a supported device (Chrome, Edge, Safari 16.4+) to receive push
          alerts.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-harvest-600 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-foreground">Push notifications</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get alerts for application updates, payments, and market reminders — even when the app
            is closed.
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            Status: {permission === 'unsupported' ? 'Unavailable' : permission}
          </p>
          {subscription ? (
            <p className="text-xs text-sage-700">Device registered — ready to sync with backend.</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
      {permission !== 'granted' ? (
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={loading}
          onClick={() => void requestPermission()}
        >
          {loading ? 'Enabling…' : 'Enable notifications'}
        </Button>
      ) : null}
    </div>
  )
}
