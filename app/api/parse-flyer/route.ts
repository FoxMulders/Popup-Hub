import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFlyerWithVision } from '@/lib/flyer/parse-flyer-vision'
import { parsedFlyerSchema } from '@/lib/flyer/types'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Upload a JPG, PNG, or WebP flyer image' },
      { status: 400 }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const { data, source } = await parseFlyerWithVision({
      buffer,
      mimeType: file.type,
      fileName: file.name,
    })

    const hasSignal = Boolean(
      data.eventName ||
        data.date ||
        data.startTime ||
        data.endTime ||
        data.location ||
        data.description ||
        data.ticketPrice
    )

    if (!hasSignal) {
      return NextResponse.json(
        { error: 'Could not read event details from this flyer' },
        { status: 422 }
      )
    }

    const payload = parsedFlyerSchema.parse({
      eventName: data.eventName ?? null,
      date: data.date ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      location: data.location ?? null,
      description: data.description ?? null,
      ticketPrice: data.ticketPrice ?? null,
    })

    return NextResponse.json({
      ...payload,
      meta: { source },
    })
  } catch (err) {
    console.error('[parse-flyer]', err)
    return NextResponse.json(
      { error: 'Could not parse flyer image' },
      { status: 500 }
    )
  }
}
