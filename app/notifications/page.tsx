import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Notification, Profile } from '@/types/database'
import { NotificationList } from '@/components/notifications/notification-list'
import { NotificationPageHeader } from '@/components/notifications/notification-page-header'
import { NotificationDeliverySettings } from '@/components/notifications/notification-delivery-settings'
import {
  ACTIVE_PORTAL_COOKIE,
  resolveActivePortal,
} from '@/lib/portals/active-portal'

/**
 * Coerce an unknown row from supabase into a `Notification` we can safely
 * render, or `null` if it's missing fields the UI assumes are present.
 *
 * The page handler runs against a shared schema so a single malformed row
 * (e.g. a backfill that didn't populate `created_at`) used to topple the
 * whole client tree via `new Date(undefined)` → "Invalid time value" inside
 * date-fns `format()`. Filtering at the boundary keeps the failure mode
 * graceful: bad rows are dropped, good rows still render.
 */
function sanitizeNotification(row: unknown): Notification | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  if (typeof r.user_id !== 'string') return null
  if (typeof r.type !== 'string') return null
  if (typeof r.message !== 'string') return null
  if (typeof r.is_read !== 'boolean') return null
  if (typeof r.created_at !== 'string') return null
  // Validate the timestamp parses — anything date-fns will choke on we drop.
  if (Number.isNaN(new Date(r.created_at).getTime())) return null
  const metadata =
    r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, unknown>)
      : {}
  return {
    id: r.id,
    user_id: r.user_id,
    type: r.type as Notification['type'],
    message: r.message,
    is_read: r.is_read,
    metadata,
    created_at: r.created_at,
  }
}

export default async function NotificationsPage() {
  // Wrap supabase client creation defensively. If env vars are missing in a
  // particular environment, the client throws synchronously; we'd rather
  // bounce the user to /login than blow up the whole segment with an
  // unhandled exception.
  let userId: string | null = null
  let initialNotifications: Notification[] = []
  let activePortal = resolveActivePortal(undefined, null)
  let profilePhone: string | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    userId = user.id

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, phone')
      .eq('id', user.id)
      .single()

    profilePhone = (profile as { phone?: string | null } | null)?.phone ?? null

    const cookieStore = await cookies()
    const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
    activePortal = resolveActivePortal(
      portalCookie,
      profile as unknown as Profile | null
    )

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        // Don't throw — we'd rather show an empty feed than the error
        // page. The realtime subscription in the client will repopulate
        // whenever new notifications land.
        console.error('[notifications] fetch failed', error)
      } else if (Array.isArray(data)) {
        initialNotifications = data
          .map(sanitizeNotification)
          .filter((n): n is Notification => n !== null)
      }
    } catch (err) {
      console.error('[notifications] fetch threw', err)
    }
  } catch (err) {
    // `redirect()` throws a NEXT_REDIRECT error that *must* propagate for
    // the redirect to work. Re-throw it; everything else (auth init
    // failures, transient cookie weirdness during portal switch, etc.)
    // falls through to a graceful empty-state render.
    if (err && typeof err === 'object' && 'digest' in err) {
      const digest = (err as { digest?: unknown }).digest
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
        throw err
      }
    }
    console.error('[notifications] page setup failed', err)
  }

  if (!userId) {
    // Auth couldn't be established (and we didn't redirect for some
    // reason — e.g. a transient supabase client failure). Render a calm
    // empty shell instead of tripping the segment error boundary.
    redirect('/login')
  }

  const hasPhone = Boolean(profilePhone?.trim())

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] overflow-x-hidden px-4 py-8 sm:px-6 xl:px-16">
      <NotificationPageHeader userId={userId} activePortal={activePortal} />

      <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6 xl:order-1">
          <div className="xl:hidden">
            <NotificationDeliverySettings userId={userId} hasPhone={hasPhone} />
          </div>
          <NotificationList
            initialNotifications={initialNotifications}
            userId={userId}
            activePortal={activePortal}
          />
        </div>

        <aside className="min-w-0 space-y-6 xl:order-2">
          <div className="hidden xl:sticky xl:top-24 xl:block">
            <NotificationDeliverySettings userId={userId} hasPhone={hasPhone} />
          </div>

          <div className="rounded-2xl border bg-white p-6 hidden xl:block">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
              Notification Types
            </h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
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
                <span className="h-2.5 w-2.5 rounded-full bg-harvest-400 shrink-0" />
                Auction won
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shrink-0" />
                Payment received
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-400 shrink-0" />
                Market feedback
              </li>
            </ul>
            <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
              Clicking a notification marks it as read.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
