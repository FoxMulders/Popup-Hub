import { NextResponse } from 'next/server'
import { canActAsVendor } from '@/lib/auth/rbac'
import { submitOrganizerReview } from '@/lib/organizers/submit-organizer-review'
import { parseOrganizerReviewPayload } from '@/lib/organizers/validate-review-payload'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to leave a review' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsVendor(profile)) {
    return NextResponse.json(
      {
        error: 'Enable vendor access on your account to review organizers you vended with.',
        code: 'vendor_required',
      },
      { status: 403 }
    )
  }

  const parsed = parseOrganizerReviewPayload(await request.json())
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const service = await createServiceClient()
  const result = await submitOrganizerReview(service, user.id, parsed.data)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    )
  }

  if (result.status === 'pending_moderation') {
    return NextResponse.json({
      ok: true,
      status: 'pending_moderation',
      reviewId: result.reviewId,
      organizerSlug: result.organizerSlug,
      organizerName: result.organizerName,
    })
  }

  return NextResponse.json({
    ok: true,
    status: 'published',
    reviewId: result.reviewId,
    organizerSlug: result.organizerSlug,
    organizerName: result.organizerName,
  })
}
