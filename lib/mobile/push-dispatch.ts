import type { SupabaseClient } from '@supabase/supabase-js'

export type NativePushPayload = {
  userIds: string[]
  title: string
  body: string
  deepLink?: string
}

/**
 * Dispatches native push via registered device tokens.
 * Requires FCM_SERVER_KEY (Android) / APNS config in a later phase — logs when unset.
 */
export async function dispatchNativePushToUsers(
  supabase: SupabaseClient,
  payload: NativePushPayload
): Promise<{ sent: number }> {
  const uniqueIds = [...new Set(payload.userIds)].filter(Boolean)
  if (uniqueIds.length === 0) return { sent: 0 }

  const { data: tokens } = await supabase
    .from('device_push_tokens')
    .select('token, platform, user_id')
    .in('user_id', uniqueIds)

  if (!tokens?.length) return { sent: 0 }

  const fcmKey = process.env.FCM_SERVER_KEY?.trim()
  if (!fcmKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[push-dispatch] FCM_SERVER_KEY unset — skipped native push', {
        recipients: tokens.length,
        title: payload.title,
      })
    }
    return { sent: 0 }
  }

  let sent = 0
  for (const row of tokens) {
    if (row.platform !== 'android') continue
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${fcmKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: row.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            deep_link: payload.deepLink ?? '',
          },
        }),
      })
      if (res.ok) sent++
    } catch (err) {
      console.error('[push-dispatch] FCM send failed', err)
    }
  }

  return { sent }
}
