import { NextResponse } from 'next/server'
import { claimOrganizerProfile } from '@/lib/organizers/claim-organizer'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ slug: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to claim this profile' }, { status: 401 })
  }

  const result = await claimOrganizerProfile(slug, user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    nextPath: `/coordinator/events/new?organizer=${encodeURIComponent(slug)}&claimed=1`,
  })
}
