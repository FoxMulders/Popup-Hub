import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'
import type { Notification } from '@/types/database'
import { NotificationList } from '@/components/notifications/notification-list'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 xl:px-16">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1.5">
          <Bell className="h-7 w-7 text-amber-500" />
          <h1 className="text-4xl font-bold text-gray-900">Notifications</h1>
        </div>
        <p className="text-lg text-gray-500">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'You\'re all caught up'}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
        {/* Main notification feed */}
        <NotificationList
          initialNotifications={(notifications as Notification[]) ?? []}
          userId={user.id}
        />

        {/* Sidebar: key */}
        <aside className="hidden xl:block">
          <div className="rounded-2xl border bg-white p-6 sticky top-24">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Notification Types
            </h2>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400 shrink-0" />
                Application approved
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" />
                Application rejected
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0" />
                Moved off waitlist
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                Auction won
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shrink-0" />
                Payment received
              </li>
            </ul>
            <p className="mt-6 text-xs text-gray-400 leading-relaxed">
              Clicking a notification marks it as read. You can also receive SMS alerts — add your
              phone number in Profile settings.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
