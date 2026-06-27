import { NextResponse } from 'next/server'
import { submitOrganizerClaimRequest } from '@/lib/organizers/claim-organizer'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ slug: string }> }

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to claim this profile' }, { status: 401 })
  }

  let verificationNote: string | null = null
  try {
    const body = (await request.json()) as { verificationNote?: string | null }
    verificationNote = body.verificationNote ?? null
  } catch {
    verificationNote = null
  }

  const result = await submitOrganizerClaimRequest(slug, user.id, verificationNote)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    status: 'pending',
  })
}
