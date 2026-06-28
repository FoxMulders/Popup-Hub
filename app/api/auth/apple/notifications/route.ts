import { NextResponse } from 'next/server'
import {
  handleAppleS2SNotification,
  verifyAppleNotificationPayload,
} from '@/lib/auth/apple-s2s-notifications'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload =
    body &&
    typeof body === 'object' &&
    'payload' in body &&
    typeof (body as { payload?: unknown }).payload === 'string'
      ? (body as { payload: string }).payload
      : null

  if (!payload) {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 })
  }

  let event

  try {
    event = await verifyAppleNotificationPayload(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid notification payload'
    console.warn('[apple-s2s] verification failed:', message)
    return NextResponse.json({ error: 'Invalid notification signature' }, { status: 401 })
  }

  const admin = createAdminClient()
  const result = await handleAppleS2SNotification(admin, event)

  if (!result.ok) {
    console.error('[apple-s2s] handler failed:', result.error, { type: event.type, sub: event.sub })
    return NextResponse.json({ error: 'Failed to process notification' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: result.action })
}
