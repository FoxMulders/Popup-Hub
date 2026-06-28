import { NextResponse } from 'next/server'
import { geocodeAddressQuery } from '@/lib/maps/geocode-query'

export async function POST(request: Request) {
  let body: { query?: string }
  try {
    body = (await request.json()) as { query?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const query = body.query?.trim()
  if (!query || query.length < 3) {
    return NextResponse.json(
      { error: 'Enter at least 3 characters for your address or postal code.' },
      { status: 400 }
    )
  }

  const result = await geocodeAddressQuery(query)
  if (!result) {
    return NextResponse.json(
      { error: 'Could not find that address. Check spelling or try a postal code.' },
      { status: 404 }
    )
  }

  return NextResponse.json(result)
}
