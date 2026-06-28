import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateWidgetRequest } from '@/lib/widget/auth'
import { executeWidgetAction, type WidgetActionBody } from '@/lib/widget/actions'

export async function POST(request: Request) {
  const service = await createServiceClient()
  const auth = await authenticateWidgetRequest(request, service)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as WidgetActionBody
  if (!body.action) {
    return NextResponse.json({ error: 'action required' }, { status: 400 })
  }

  const result = await executeWidgetAction(service, auth.context, body)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
