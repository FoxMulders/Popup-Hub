'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Notification } from '@/types/database'
import { format } from 'date-fns'
import { Bell, CheckCheck, Trophy, Store, Calendar, AlertCircle, Info } from 'lucide-react'

interface NotificationListProps {
  initialNotifications: Notification[]
  userId: string
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  waitlist_promoted: { icon: <Calendar className="h-4 w-4" />, color: 'text-blue-500 bg-blue-50' },
  application_approved: { icon: <Store className="h-4 w-4" />, color: 'text-green-500 bg-green-50' },
  application_rejected: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500 bg-red-50' },
  payment_failed: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500 bg-red-50' },
  auction_won: { icon: <Trophy className="h-4 w-4" />, color: 'text-amber-500 bg-amber-50' },
  default: { icon: <Info className="h-4 w-4" />, color: 'text-gray-500 bg-gray-100' },
}

export function NotificationList({ initialNotifications, userId }: NotificationListProps) {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    const channel = supabase
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
          setNotifications((prev) => [payload.new as Notification, ...prev])
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
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  async function markAllRead() {
    setMarkingAll(true)
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
    setMarkingAll(false)
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
          <Bell className="mx-auto mb-3 h-8 w-8 text-gray-200" />
          <p className="text-gray-400 text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.default
            return (
              <button
                key={notification.id}
                className={`w-full rounded-xl border bg-white p-4 text-left transition hover:shadow-sm ${
                  !notification.is_read ? 'ring-1 ring-amber-300' : ''
                }`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {notification.message}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-500 mt-1.5" />
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
