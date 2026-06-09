import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  venueVerificationFieldsFromResult,
  verifyVenueCoordinates,
} from '@/lib/venues/verify-venue-coordinates'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    eventId,
    latitude,
    longitude,
    address,
    locationName,
    pinDropped,
    persist = true,
  } = body as {
    eventId?: string
    latitude?: number
    longitude?: number
    address?: string
    locationName?: string
    pinDropped?: boolean
    persist?: boolean
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 })
  }

  const result = await verifyVenueCoordinates({
    latitude: latitude!,
    longitude: longitude!,
    address,
    pinDropped,
  })

  const fields = venueVerificationFieldsFromResult(result)

  if (persist && eventId) {
    const { data: event } = await supabase
      .from('events')
      .select('id, coordinator_id')
      .eq('id', eventId)
      .single()

    if (!event || event.coordinator_id !== user.id) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const updatePayload: Record<string, unknown> = { ...fields }
    if (address?.trim()) updatePayload.address = address.trim()
    if (locationName?.trim()) updatePayload.location_name = locationName.trim()
    updatePayload.latitude = latitude
    updatePayload.longitude = longitude

    const { error } = await supabase.from('events').update(updatePayload).eq('id', eventId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ...result,
    fields,
  })
}
