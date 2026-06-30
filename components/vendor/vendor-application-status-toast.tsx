'use client'

import { useEffect } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { dispatchNotificationsChanged } from '@/lib/notifications/sync'
import { APPLICATION_STATUS_NOTIFICATION_TYPES } from '@/lib/vendor/fetch-application-status-notifications'
import type { Notification, NotificationType } from '@/types/database'

const TOAST_TYPES = new Set<NotificationType>(APPLICATION_STATUS_NOTIFICATION_TYPES)

interface VendorApplicationStatusToastProps {
  userId: string
}

function isApplicationStatusNotification(row: unknown): row is Notification {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.type === 'string' &&
    TOAST_TYPES.has(r.type as NotificationType) &&
    typeof r.message === 'string'
  )
}

export function VendorApplicationStatusToast({ userId }: VendorApplicationStatusToastProps) {
  useEffect(() => {
    if (!userId) return

    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    try {
      const supabase = createClient()
      channel = supabase
        .channel(`vendor-application-status-toast:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!isApplicationStatusNotification(payload.new)) return
            const notification = payload.new

            if (notification.type === 'application_rejected') {
              toast.error(notification.message, { duration: 8000 })
            } else if (notification.type === 'waitlist_triggered') {
              toast.message(notification.message, { duration: 8000 })
            } else {
              toast.success(notification.message, { duration: 8000 })
            }

            dispatchNotificationsChanged()
          }
        )
        .subscribe()
    } catch (err) {
      console.error('[vendor-application-status-toast] subscribe failed', err)
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
  }, [userId])

  return null
}
