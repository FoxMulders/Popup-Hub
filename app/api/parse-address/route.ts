import { NextResponse } from 'next/server'
import { parseAddressWithAi } from '@/lib/addresses/parse-address-ai'
import { OpenRouterConfigError } from '@/lib/ai/openrouter'

export async function POST(request: Request) {
  let body: { address?: string }
  try {
    body = (await request.json()) as { address?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const address = body.address?.trim()
  if (!address || address.length < 5) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  try {
    const result = await parseAddressWithAi(address)
    if (!result) {
      return NextResponse.json(
        { error: 'Could not parse address — enter a more complete location' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      components: result.components,
      formatted: result.formatted,
      model: result.model,
    })
  } catch (err) {
    if (err instanceof OpenRouterConfigError) {
      return NextResponse.json(
        { error: 'Address parsing is unavailable — enter a structured address manually' },
        { status: 503 }
      )
    }
    console.error('[parse-address]', err)
    return NextResponse.json({ error: 'Address parsing failed' }, { status: 500 })
  }
}
