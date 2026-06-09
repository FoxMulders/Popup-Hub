'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NOTIFICATIONS_CHANGED } from '@/lib/notifications/sync'
import { notificationTypesForPortal } from '@/lib/notifications/portal-filter'
import type { ActivePortal } from '@/lib/portals/active-portal'

export function useNotificationCount(
  userId: string,
  activePortal: ActivePortal = 'patron'
): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    // We isolate every supabase call in its own try/catch — if the env vars
    // are missing or the websocket negotiation fails, we still want the
    // header to render the (zero) badge instead of letting the segment
    // error boundary swallow the whole notifications page.
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch (err) {
      console.error('[notification-count] supabase client init failed', err)
      return
    }

    const portalTypes = notificationTypesForPortal(activePortal)

    async function fetchCount() {
      try {
        const { count: c, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false)
          .in('type', portalTypes)
        if (error) {
          console.error('[notification-count] fetch failed', error)
          return
        }
        setCount(c ?? 0)
      } catch (err) {
        console.error('[notification-count] fetch threw', err)
      }
    }

    void fetchCount()

    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => fetchCount()
        )
        .subscribe()
    } catch (err) {
      console.error('[notification-count] subscribe failed', err)
    }

    window.addEventListener(NOTIFICATIONS_CHANGED, fetchCount)

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED, fetchCount)
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {
        // Cleanup is best-effort.
      }
    }
  }, [userId, activePortal])

  return count
}
