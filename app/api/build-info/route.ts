import { NextResponse } from 'next/server'
import { getBuildInfo } from '@/lib/build-info'

export async function GET() {
  const build = getBuildInfo()
  return NextResponse.json(build, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
