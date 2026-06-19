import { NextResponse } from 'next/server'
import { resolveAdminDb } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'

type AdminVenueAction = 'approve' | 'reject'

export async function GET(request: Request) {
  const adminCtx = await resolveAdminDb(request)
  if (!adminCtx.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await adminCtx.db
    .from('platform_venue_submissions')
    .select('*, submitter:profiles!platform_venue_submissions_submitted_by_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data ?? [] })
}

export async function POST(request: Request) {
  const adminCtx = await resolveAdminDb(request)
  if (!adminCtx.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    submissionId?: string
    action?: AdminVenueAction
    adminNote?: string
  }

  const { submissionId, action, adminNote } = body
  if (!submissionId || !action) {
    return NextResponse.json({ error: 'submissionId and action are required' }, { status: 400 })
  }

  const status = action === 'approve' ? 'approved' : 'rejected'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await adminCtx.db
    .from('platform_venue_submissions')
    .update({
      status,
      admin_note: adminNote?.trim() || null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, submissionId, status })
}
