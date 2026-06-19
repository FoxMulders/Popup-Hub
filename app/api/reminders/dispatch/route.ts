import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/twilio'
import { authorizeCronRequest } from '@/lib/cron/authorize-cron'
import { dispatchNativePushToUsers } from '@/lib/mobile/push-dispatch'

/** Cron: dispatch due market reminders (in-app + optional SMS + native push). */
export async function POST(request: Request) {
  const denied = authorizeCronRequest(request)
  if (denied) return denied

  const supabase = await createServiceClient()
  const now = new Date().toISOString()

  const { data: due } = await supabase
    .from('event_reminders')
    .select('id, user_id, event_id, reminder_offset, events(name, start_at)')
    .is('sent_at', null)
    .lte('remind_at', now)
    .limit(100)

  let dispatched = 0

  for (const row of due ?? []) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events
    const eventName = event?.name ?? 'your saved market'
    const message = `Reminder: "${eventName}" is coming up soon!`

    await supabase.from('notifications').insert({
      user_id: row.user_id,
      type: 'market_reminder',
      message,
      metadata: { event_id: row.event_id, reminder_id: row.id },
    })

    void dispatchNativePushToUsers(supabase, {
      userIds: [row.user_id],
      title: 'Market reminder',
      body: message,
      deepLink: `/events/${row.event_id}`,
    }).catch((err) => {
      console.error('[reminders/dispatch] native push failed', err)
    })

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', row.user_id)
      .single()

    if (profile?.phone) {
      try {
        await sendSms(profile.phone, message)
        await supabase
          .from('event_reminders')
          .update({ sent_at: now, sms_sent: true })
          .eq('id', row.id)
      } catch {
        await supabase.from('event_reminders').update({ sent_at: now }).eq('id', row.id)
      }
    } else {
      await supabase.from('event_reminders').update({ sent_at: now }).eq('id', row.id)
    }

    dispatched++
  }

  return NextResponse.json({ dispatched })
}
