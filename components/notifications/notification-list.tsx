'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Notification } from '@/types/database'
import { format } from 'date-fns'
import { Bell, CheckCheck, Trophy, Store, Calendar, AlertCircle, Info, MessageSquare, Lightbulb } from 'lucide-react'
import { dispatchNotificationsChanged } from '@/lib/notifications/sync'
import { filterNotificationsForPortal } from '@/lib/notifications/portal-filter'
import type { ActivePortal } from '@/lib/portals/active-portal'

interface NotificationListProps {
  initialNotifications: Notification[]
  userId: string
  activePortal?: ActivePortal
}

/**
 * Realtime payloads from supabase aren't typed against our `Notification`
 * shape — the wire format can drift if the table schema changes or an
 * upstream service writes a partial row. We narrow defensively here so a
 * malformed insert/update can't wedge the list with `Invalid time value`
 * crashes from date-fns.
 */
function isRenderableNotification(row: unknown): row is Notification {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.user_id === 'string' &&
    typeof r.type === 'string' &&
    typeof r.message === 'string' &&
    typeof r.is_read === 'boolean' &&
    typeof r.created_at === 'string' &&
    !Number.isNaN(new Date(r.created_at).getTime())
  )
}

/**
 * Format `created_at` for display, returning a stable fallback if the
 * timestamp is missing or not parseable. We never let a single bad row
 * throw out of render and tear down the whole feed.
 */
function formatNotificationDate(createdAt: string | null | undefined): string {
  if (typeof createdAt !== 'string') return '—'
  const ts = new Date(createdAt)
  if (Number.isNaN(ts.getTime())) return '—'
  try {
    return format(ts, 'MMM d, yyyy h:mm a')
  } catch {
    return '—'
  }
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  waitlist_triggered: { icon: <Calendar className="h-4 w-4" />, color: 'text-blue-500 bg-blue-50' },
  waitlist_promoted: { icon: <Calendar className="h-4 w-4" />, color: 'text-blue-500 bg-blue-50' },
  market_reminder: { icon: <Bell className="h-4 w-4" />, color: 'text-forest bg-sage-50' },
  vendor_flash_sale: { icon: <Store className="h-4 w-4" />, color: 'text-harvest-600 bg-harvest-50' },
  priority_booth_invite: { icon: <Store className="h-4 w-4" />, color: 'text-amber-700 bg-amber-50' },
  vendor_sold_out: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-terracotta-600 bg-terracotta-50' },
  vendor_access_approved: { icon: <Store className="h-4 w-4" />, color: 'text-green-600 bg-sage-50' },
  vendor_access_rejected: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-600 bg-red-50' },
  market_feedback: { icon: <MessageSquare className="h-4 w-4" />, color: 'text-violet-600 bg-violet-50' },
  feature_request_submitted: { icon: <Lightbulb className="h-4 w-4" />, color: 'text-amber-700 bg-amber-50' },
  feedback_addressed: { icon: <CheckCheck className="h-4 w-4" />, color: 'text-green-600 bg-sage-50' },
  application_approved: { icon: <Store className="h-4 w-4" />, color: 'text-green-500 bg-sage-50' },
  application_rejected: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500 bg-red-50' },
  application_follow_up: { icon: <MessageSquare className="h-4 w-4" />, color: 'text-harvest-700 bg-harvest-50' },
  payment_failed: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500 bg-red-50' },
  auction_won: { icon: <Trophy className="h-4 w-4" />, color: 'text-harvest-500 bg-harvest-50' },
  auction_starting: { icon: <Trophy className="h-4 w-4" />, color: 'text-harvest-600 bg-harvest-50' },
  default: { icon: <Info className="h-4 w-4" />, color: 'text-muted-foreground bg-stone-100' },
}

export function NotificationList({
  initialNotifications,
  userId,
  activePortal = 'patron',
}: NotificationListProps) {
  const router = useRouter()
  // Guard against an upstream caller passing `null`/`undefined`. Even though
  // the typed prop says it's an array, when this component is rendered mid
  // navigation transition (portal switch, etc.) React can briefly hold a
  // stale prop reference; refusing to ever map over a non-array prevents
  // `.filter is not a function` style throws from tripping the segment
  // error boundary.
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    filterNotificationsForPortal(
      Array.isArray(initialNotifications) ? initialNotifications : [],
      activePortal
    )
  )
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    setNotifications(
      filterNotificationsForPortal(
        Array.isArray(initialNotifications) ? initialNotifications : [],
        activePortal
      )
    )
  }, [initialNotifications, activePortal])

  useEffect(() => {
    if (!userId) return
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel(`notifications-list:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!isRenderableNotification(payload.new)) return
            const next = payload.new as Notification
            setNotifications((prev) => {
              if (!filterNotificationsForPortal([next], activePortal).length) {
                return prev
              }
              return [next, ...prev]
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!isRenderableNotification(payload.new)) return
            const next = payload.new as Notification
            setNotifications((prev) => {
              const visible = filterNotificationsForPortal([next], activePortal).length > 0
              if (!visible) {
                return prev.filter((n) => n.id !== next.id)
              }
              const idx = prev.findIndex((n) => n.id === next.id)
              if (idx === -1) return [next, ...prev]
              return prev.map((n) => (n.id === next.id ? next : n))
            })
          }
        )
        .subscribe()
    } catch (err) {
      // Realtime channel setup is best-effort. If supabase env is missing
      // or the websocket negotiation throws, we still render the static
      // initialNotifications instead of letting an effect-time throw bubble
      // up and unmount the feed.
      console.error('[notifications] realtime subscribe failed', err)
    }

    return () => {
      try {
        if (channel) {
          const supabase = createClient()
          supabase.removeChannel(channel)
        }
      } catch {
        // Cleanup is best-effort.
      }
    }
  }, [userId, activePortal])

  async function markAsRead(id: string) {
    const supabase = createClient()
    const wasUnread = notifications.some((n) => n.id === id && !n.is_read)
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    if (wasUnread) dispatchNotificationsChanged()
  }

  async function markAllRead() {
    const supabase = createClient()
    setMarkingAll(true)
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      dispatchNotificationsChanged()
    }
    setMarkingAll(false)
  }

  async function handleNotificationClick(notification: Notification) {
    try {
      if (!notification.is_read) {
        await markAsRead(notification.id)
      }

      const metadata =
        notification.metadata && typeof notification.metadata === 'object'
          ? (notification.metadata as { event_id?: unknown })
          : null
      const eventId =
        metadata && typeof metadata.event_id === 'string'
          ? metadata.event_id
          : null
      if (notification.type === 'feature_request_submitted') {
        router.push('/admin/feedback')
        return
      }

      if (notification.type === 'application_follow_up' && eventId) {
        router.push(
          activePortal === 'coordinator'
            ? `/coordinator/events/${eventId}/applications`
            : `/vendor/applications`
        )
        return
      }

      if (
        (notification.type === 'application_approved' ||
          notification.type === 'application_rejected' ||
          notification.type === 'payment_failed') &&
        activePortal === 'vendor'
      ) {
        router.push('/vendor/applications?filter=approved')
        return
      }

      if (
        (notification.type === 'vendor_access_approved' ||
          notification.type === 'vendor_access_rejected') &&
        activePortal === 'vendor'
      ) {
        router.push('/vendor/dashboard')
      }
    } catch (err) {
      // Click-handler errors don't bubble to error boundaries, so we
      // catch and log instead of letting a bad metadata shape (or a
      // failed update) leave the user staring at a dead button.
      console.error('[notifications] click handler failed', err)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <Badge className="bg-red-100 text-red-600">
            {unreadCount} unread
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            disabled={markingAll}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-2xl border bg-white py-16 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-stone-200" />
          <p className="text-muted-foreground text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(notifications ?? []).map((notification) => {
            // Defensive: even though `notifications` is typed as
            // `Notification[]`, a malformed realtime payload could in
            // theory slip past the renderable check above. Skip anything
            // that doesn't have an `id` we can use as a key.
            if (!notification || typeof notification.id !== 'string') return null
            const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.default
            return (
              <button
                key={notification.id}
                className={`w-full rounded-xl border bg-white p-4 text-left transition hover:shadow-sm ${
                  !notification.is_read ? 'ring-1 ring-harvest-400' : ''
                }`}
                onClick={() => void handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                      {notification.message}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatNotificationDate(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-harvest-500 mt-1.5" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
