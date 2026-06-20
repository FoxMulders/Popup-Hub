import { NextResponse } from 'next/server'
import { notifyVendorOfReviewResponse } from '@/lib/organizers/notify-hubguard-review'
import {
  assertOrganizerReviewResponder,
  upsertOrganizerReviewResponse,
} from '@/lib/organizers/respond-to-organizer-review'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ reviewId: string }> }

export async function POST(request: Request, { params }: Params) {
  const { reviewId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to respond' }, { status: 401 })
  }

  const body = (await request.json()) as { responseBody?: string }
  const responseBody = body.responseBody?.trim() ?? ''
  if (!responseBody) {
    return NextResponse.json({ error: 'responseBody is required' }, { status: 400 })
  }

  const access = await assertOrganizerReviewResponder(reviewId, user.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const service = await createServiceClient()
  const result = await upsertOrganizerReviewResponse(service, {
    reviewId,
    responderId: user.id,
    responseBody,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  if (result.created) {
    try {
      await notifyVendorOfReviewResponse(service, {
        reviewId,
        vendorId: access.review.vendor_id,
        organizerName: access.organizer.display_name,
        eventName: access.review.event_name,
        organizerSlug: access.organizer.slug,
      })
    } catch (err) {
      console.error('[hubguard] vendor response notification failed', err)
    }
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    organizerSlug: access.organizer.slug,
  })
}
