/**
 * Supabase Edge Function: send-sms-notification
 *
 * Triggered by a Supabase Database Webhook on INSERT to the notifications table.
 * Sends an SMS via Twilio when the notification is high-priority and the
 * user has a phone number on their profile.
 *
 * Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (e.g. "+15005550006")
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const HIGH_PRIORITY_TYPES = new Set([
  'auction_won',
  'waitlist_triggered',
  'application_approved',
  'application_rejected',
])

interface NotificationPayload {
  type: 'INSERT'
  table: string
  record: {
    id: string
    user_id: string
    type: string
    message: string
    is_read: boolean
    created_at: string
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const payload: NotificationPayload = await req.json()
  const notification = payload.record

  // Only send SMS for high-priority notification types
  if (!HIGH_PRIORITY_TYPES.has(notification.type)) {
    return new Response(JSON.stringify({ skipped: true, reason: 'low priority' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch the user's phone number
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, full_name')
    .eq('id', notification.user_id)
    .single()

  if (!profile?.phone) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no phone' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio credentials not configured; skipping SMS')
    return new Response(JSON.stringify({ skipped: true, reason: 'twilio not configured' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const body = new URLSearchParams({
    To: profile.phone,
    From: fromNumber,
    Body: `Popup Hub: ${notification.message}`,
  })

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('Twilio error:', result)
    return new Response(JSON.stringify({ error: result }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ sent: true, sid: result.sid }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
