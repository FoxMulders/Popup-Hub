import { NextResponse } from 'next/server'
import { canActAsVendor } from '@/lib/auth/rbac'
import { parseOrganizerReviewPayload } from '@/lib/organizers/validate-review-payload'
import { createClient } from '@/lib/supabase/server'

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

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id, slug, display_name')
    .eq('slug', parsed.data.organizerSlug)
    .eq('listing_status', 'published')
    .maybeSingle()

  if (!organizer) {
    return NextResponse.json({ error: 'Organizer not found' }, { status: 404 })
  }

  const { data: review, error } = await supabase
    .from('organizer_reviews')
    .insert({
      organizer_id: organizer.id,
      vendor_id: user.id,
      event_name: parsed.data.eventName,
      event_month_year: parsed.data.eventMonthYear,
      event_as_advertised: parsed.data.eventAsAdvertised,
      would_return: parsed.data.wouldReturn,
      attendance_vs_expectations: parsed.data.attendanceVsExpectations,
      communication_rating: parsed.data.communicationRating,
      refund_experience: parsed.data.refundExperience,
      optional_notes: parsed.data.optionalNotes ?? null,
      verification_tier: 'unverified',
      published: true,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        {
          error: 'You already reviewed this organizer for that event and month.',
          code: 'duplicate',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    reviewId: review.id,
    organizerSlug: organizer.slug,
    organizerName: organizer.display_name,
  })
}
