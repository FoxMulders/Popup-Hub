import type { SupabaseClient } from '@supabase/supabase-js'
import type { Notification } from '@/types/database'

const APPLICATION_STATUS_NOTIFICATION_TYPES = [
  'application_approved',
  'application_rejected',
  'waitlist_triggered',
] as const

export async function fetchUnreadVendorApplicationStatusNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 5
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .in('type', [...APPLICATION_STATUS_NOTIFICATION_TYPES])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[fetchUnreadVendorApplicationStatusNotifications]', error.message)
    return []
  }

  return (data ?? []) as Notification[]
}

export { APPLICATION_STATUS_NOTIFICATION_TYPES }
