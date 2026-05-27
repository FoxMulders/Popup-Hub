'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NOTIFICATIONS_CHANGED } from '@/lib/notifications/sync'

export function useNotificationCount(userId: string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function fetchCount() {
      try {
        const { count: c, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false)
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

    const channel = supabase
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

    window.addEventListener(NOTIFICATIONS_CHANGED, fetchCount)

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED, fetchCount)
      supabase.removeChannel(channel)
    }
  }, [userId])

  return count
}
