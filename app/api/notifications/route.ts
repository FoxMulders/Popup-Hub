import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/twilio'

/**
 * POST /api/notifications
 * Body: { user_id, type, message, metadata?, send_sms? }
 * Creates an in-app notification and optionally sends SMS if the user has a phone on file.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    user_id: string
    type: string
    message: string
    metadata?: Record<string, unknown>
    send_sms?: boolean
  }

  const { user_id, type, message, metadata, send_sms } = body
  if (!user_id || !type || !message) {
    return NextResponse.json({ error: 'user_id, type, and message are required' }, { status: 400 })
  }

  const service = await createServiceClient()

  await service.from('notifications').insert({ user_id, type, message, metadata })

  if (send_sms) {
    const { data: profile } = await service
      .from('profiles')
      .select('phone')
      .eq('id', user_id)
      .single()

    if (profile?.phone) {
      await sendSms(profile.phone, message)
    }
  }

  return NextResponse.json({ ok: true })
}
