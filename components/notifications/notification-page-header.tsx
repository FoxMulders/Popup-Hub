'use client'

import { Bell } from 'lucide-react'
import { useNotificationCount } from '@/hooks/use-notification-count'
import type { ActivePortal } from '@/lib/portals/active-portal'

export function NotificationPageHeader({
  userId,
  activePortal = 'patron',
}: {
  userId: string
  activePortal?: ActivePortal
}) {
  const unreadCount = useNotificationCount(userId, activePortal)

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
