'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNotifications } from '@/hooks/use-notifications'
import { createClient } from '@/lib/supabase/client'
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

function ChannelToggle({
  event,
  channel,
  checked,
  disabled,
  onToggle,
}: {
  event: (typeof NOTIFICATION_EVENTS)[number]
  channel: (typeof NOTIFICATION_CHANNELS)[number]
  checked: boolean
  disabled: boolean
  onToggle: (checked: boolean) => void
}) {
  const switchId = `${event.id}-${channel.id}`

  return (
    <label
      htmlFor={switchId}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-stone-200/80 bg-canvas/30 px-3 py-2 touch-manipulation"
    >
      <span className="text-sm font-medium text-foreground">{channel.label}</span>
      <Switch
        id={switchId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={`${event.label} — ${channel.label}`}
        className="shrink-0"
      />
    </label>
  )
}

export function NotificationPreferencesGrid({
  userId,
  hasPhone: hasPhoneInitial,
}: NotificationPreferencesGridProps) {
  const { preferences, hydrated, setChannel } = useNotificationPreferences(userId)
  const { permission, loading, error, isSupported, requestPermission } = useNotifications()
  const [hasPhone, setHasPhone] = useState(hasPhoneInitial)

  useEffect(() => {
    setHasPhone(hasPhoneInitial)
  }, [hasPhoneInitial])

  useEffect(() => {
    let cancelled = false
    async function loadPhone() {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('phone').eq('id', userId).single()
      if (!cancelled) {
        setHasPhone(Boolean(data?.phone?.trim()))
      }
    }
    void loadPhone()
    return () => {
      cancelled = true
    }
  }, [userId])

  function handleToggle(
    event: NotificationEvent,
    channel: NotificationChannel,
    checked: boolean
  ) {
    if (channel === 'sms' && !hasPhone && checked) return
    setChannel(event, channel, checked)
  }

  function isChannelDisabled(channel: NotificationChannel): boolean {
    if (!hydrated) return true
    if (channel === 'sms' && !hasPhone) return true
    return false
  }

  return (
    <div className="min-w-0 rounded-2xl border bg-white p-4 space-y-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-harvest-600 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-foreground">Notification preferences</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Choose how you want to be notified for key account and market events.
          </p>
        </div>
      </div>

      {/* Mobile: stacked cards with full-width toggles */}
      <div className="space-y-4 md:hidden">
        {NOTIFICATION_EVENTS.map((event) => (
          <div key={event.id} className="rounded-xl border border-stone-200/80 p-4 space-y-3">
            <div>
              <p className="font-medium text-foreground">{event.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {event.description}
              </p>
            </div>
            <div className="space-y-2">
              {NOTIFICATION_CHANNELS.map((channel) => (
                <ChannelToggle
                  key={channel.id}
                  event={event}
                  channel={channel}
                  checked={preferences[event.id][channel.id]}
                  disabled={isChannelDisabled(channel.id)}
                  onToggle={(value) => handleToggle(event.id, channel.id, value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table grid */}
      <div className="hidden md:block overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[480px] text-sm border-collapse">
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
                  const disabled = isChannelDisabled(channel.id)
                  const checked = preferences[event.id][channel.id]
                  const switchId = `${event.id}-${channel.id}`

                  return (
                    <td key={channel.id} className="py-3 px-2 text-center align-middle">
                      <div className="inline-flex min-h-11 min-w-11 items-center justify-center">
                        <Switch
                          id={switchId}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(value) =>
                            handleToggle(event.id, channel.id, value)
                          }
                          aria-label={`${event.label} — ${channel.label}`}
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!hasPhone ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add a phone number in{' '}
          <Link href="/profile" className="font-medium text-harvest-700 underline">
            profile settings
          </Link>{' '}
          to enable SMS alerts.
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
              className="min-h-11 w-full sm:w-auto"
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
        <p className="text-xs text-muted-foreground leading-relaxed">
          Install Popup Hub on a supported browser (Chrome, Edge, Safari 16.4+) to receive push
          notifications on this device. You can still set push preferences above for when you install
          the app.
        </p>
      )}
    </div>
  )
}
