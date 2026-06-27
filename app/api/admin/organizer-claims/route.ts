import { NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/auth/require-admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  if (!(await hasAdminAccess())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = await createServiceClient()
  const { data, error } = await admin
    .from('organizer_claim_requests')
    .select(
      `
      id,
      status,
      verification_note,
      created_at,
      organizer:organizers(slug, display_name, city),
      requester:profiles!organizer_claim_requests_requested_by_fkey(full_name, email)
    `
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: data ?? [] })
}
