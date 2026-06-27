import { NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/auth/require-admin'
import { scoreOrganizerClaimMatch } from '@/lib/organizers/claim-verification'
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
      organizer:organizers(slug, display_name, city, website_url),
      requester:profiles!organizer_claim_requests_requested_by_fkey(
        full_name,
        email,
        coordinator_organization_name
      )
    `
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const requests = (data ?? []).map((row) => {
    const organizerRaw = row.organizer
    const organizer = (Array.isArray(organizerRaw) ? organizerRaw[0] : organizerRaw) as {
      slug: string
      display_name: string
      city: string
      website_url: string | null
    } | null
    const requesterRaw = row.requester
    const requester = (Array.isArray(requesterRaw) ? requesterRaw[0] : requesterRaw) as {
      full_name: string | null
      email: string | null
      coordinator_organization_name: string | null
    } | null

    const matchSignals = scoreOrganizerClaimMatch({
      organizerDisplayName: organizer?.display_name ?? '',
      organizerWebsiteUrl: organizer?.website_url,
      coordinatorOrgName: requester?.coordinator_organization_name,
      coordinatorFullName: requester?.full_name,
      coordinatorEmail: requester?.email,
    })

    return {
      ...row,
      matchSignals,
      matchScore: matchSignals.filter((s) => s.matched).length,
    }
  })

  return NextResponse.json({ requests })
}
