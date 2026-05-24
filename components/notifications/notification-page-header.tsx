'use client'

import { Bell } from 'lucide-react'
import { useNotificationCount } from '@/hooks/use-notification-count'

export function NotificationPageHeader({ userId }: { userId: string }) {
  const unreadCount = useNotificationCount(userId)

  return (
    <div className="mb-10">
      <div className="mb-1.5 flex items-center gap-3">
        <Bell className="h-7 w-7 text-harvest-500" />
        <h1 className="text-4xl font-bold text-foreground">Notifications</h1>
      </div>
      <p className="text-lg text-muted-foreground">
        {unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
          : "You're all caught up"}
      </p>
    </div>
  )
}
