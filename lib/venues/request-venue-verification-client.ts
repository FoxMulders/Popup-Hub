export interface VenueVerificationClientResult {
  verified: boolean
  status: string
  reason: string | null
}

export async function requestVenueVerificationClient(input: {
  eventId?: string
  latitude: number
  longitude: number
  address?: string
  locationName?: string
  pinDropped?: boolean
  persist?: boolean
}): Promise<VenueVerificationClientResult> {
  const res = await fetch('/api/coordinator/venues/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as VenueVerificationClientResult & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? 'Venue verification failed')
  }
  return data
}
