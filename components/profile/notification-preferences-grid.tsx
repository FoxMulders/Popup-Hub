'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNotifications } from '@/hooks/use-notifications'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  useNotificationPreferences,
  type NotificationChannel,
  type NotificationEvent,
} from '@/hooks/use-notification-preferences'

interface NotificationPreferencesGridProps {
  userId: string
  hasPhone: boolean
}

export function NotificationPreferencesGrid({
  userId,
  hasPhone,
}: NotificationPreferencesGridProps) {
  const { preferences, hydrated, setChannel } = useNotificationPreferences(userId)
  const { permission, loading, error, isSupported, requestPermission } = useNotifications()

  function handleToggle(
    event: NotificationEvent,
    channel: NotificationChannel,
    checked: boolean
  ) {
    if (channel === 'sms' && !hasPhone && checked) return
    setChannel(event, channel, checked)
  }

  return (
    <div className="rounded-2xl border bg-white p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-harvest-600 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-foreground">Notification preferences</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Choose how you want to be notified for key account and market events.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[320px] text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3 text-left font-medium text-muted-foreground w-[40%]">
                Event
              </th>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <th
                  key={channel.id}
                  className="py-2 px-2 text-center font-medium text-muted-foreground"
                >
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((event) => (
              <tr key={event.id} className="border-b last:border-b-0">
                <td className="py-3 pr-3 align-top">
                  <p className="font-medium text-foreground">{event.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {event.description}
                  </p>
                </td>
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const disabled =
                    !hydrated ||
                    (channel.id === 'sms' && !hasPhone) ||
                    (channel.id === 'push' && !isSupported)
                  const checked = preferences[event.id][channel.id]
                  const switchId = `${event.id}-${channel.id}`

                  return (
                    <td key={channel.id} className="py-3 px-2 text-center align-middle">
                      <Switch
                        id={switchId}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          handleToggle(event.id, channel.id, value)
                        }
                        aria-label={`${event.label} — ${channel.label}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!hasPhone ? (
        <p className="text-xs text-muted-foreground">
          Add a phone number in your profile to enable SMS alerts.
        </p>
      ) : null}

      {isSupported ? (
        <div className="rounded-xl border bg-canvas/40 px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground capitalize">
            Push device status: {permission === 'unsupported' ? 'Unavailable' : permission}
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {permission !== 'granted' ? (
            <Button
              type="button"
              size="sm"
              className="min-h-9"
              disabled={loading}
              onClick={() => void requestPermission()}
            >
              {loading ? 'Enabling…' : 'Enable push on this device'}
            </Button>
          ) : (
            <p className="text-xs text-sage-700">This device can receive push alerts.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Install Popup Hub on a supported browser to receive push notifications.
        </p>
      )}
    </div>
  )
}
