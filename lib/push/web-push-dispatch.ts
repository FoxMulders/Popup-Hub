import type { SupabaseClient } from '@supabase/supabase-js'

export type WebPushMessage = {
  userIds: string[]
  title: string
  body: string
  url?: string
  tag?: string
}

function getWebPushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@popuphub.ca'
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

/** Send web push to stored browser subscriptions. No-op when VAPID keys are unset. */
export async function dispatchWebPushToUsers(
  supabase: SupabaseClient,
  message: WebPushMessage
): Promise<{ sent: number; failed: number }> {
  const config = getWebPushConfig()
  if (!config) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[web-push] VAPID keys unset — skipped web push', {
        recipients: message.userIds.length,
        title: message.title,
      })
    }
    return { sent: 0, failed: 0 }
  }

  const uniqueIds = [...new Set(message.userIds)].filter(Boolean)
  if (uniqueIds.length === 0) return { sent: 0, failed: 0 }

  const { data: rows } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', uniqueIds)

  if (!rows?.length) return { sent: 0, failed: 0 }

  const webpush = await import('web-push')
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? '/notifications',
    tag: message.tag ?? 'popup-hub',
  })

  let sent = 0
  let failed = 0

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload
      )
      sent++
    } catch (err) {
      failed++
      console.error('[web-push] send failed', err)
    }
  }

  return { sent, failed }
}
