import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { isOpenRouterConfigured } from '@/lib/ai/env'
import { parseLayoutImageWithVision } from '@/lib/floor-plan/parse-layout-image-vision'
import { importLayoutFromImage } from '@/lib/floor-plan/import-layout-from-image'

const MAX_BYTES = 8 * 1024 * 1024
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
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: 'AI is not configured', code: 'AI_UNAVAILABLE' },
      { status: 503 }
    )
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
    return NextResponse.json({ error: 'Upload JPG, PNG, or WebP' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 8 MB or smaller' }, { status: 400 })
  }

  const roomWidthFt = Number.parseFloat(String(formData.get('roomWidthFt') ?? ''))
  const roomLengthFt = Number.parseFloat(String(formData.get('roomLengthFt') ?? ''))
  const defaultTableLengthFt = Number.parseFloat(String(formData.get('tableLengthFt') ?? '8'))

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const parsed = await parseLayoutImageWithVision({
      buffer,
      mimeType: file.type,
      roomWidthFt: Number.isFinite(roomWidthFt) ? roomWidthFt : undefined,
      roomLengthFt: Number.isFinite(roomLengthFt) ? roomLengthFt : undefined,
    })

    const widthHint = Number.isFinite(roomWidthFt) && roomWidthFt > 0 ? roomWidthFt : 60
    const lengthHint = Number.isFinite(roomLengthFt) && roomLengthFt > 0 ? roomLengthFt : 40

    const imported = importLayoutFromImage({
      parsed,
      roomWidthFt: widthHint,
      roomLengthFt: lengthHint,
      defaultTableLengthFt: Number.isFinite(defaultTableLengthFt) ? defaultTableLengthFt : 8,
    })

    return NextResponse.json({
      ...imported,
      notes: parsed.notes,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Layout import failed'
    console.error('[layout/import-image]', message, err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
