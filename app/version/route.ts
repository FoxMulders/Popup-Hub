import { NextResponse } from 'next/server'
import { getSiteVersionPayload } from '@/lib/build-info'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getSiteVersionPayload(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
