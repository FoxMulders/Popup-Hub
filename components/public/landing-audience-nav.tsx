'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, MapPin } from 'lucide-react'
import { requestUserLocation } from '@/lib/markets/user-location'

export function LandingHeroActions() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function goWithLocation() {
    setLoading(true)
    await requestUserLocation()
    router.push('/discover')
    setLoading(false)
  }

  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => void goWithLocation()}
        disabled={loading}
        className="btn-tactile inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-forest px-8 py-3 text-base font-semibold text-white shadow-[var(--shadow-market-lift)] hover:bg-forest-deep disabled:opacity-70 touch-manipulation sm:w-auto"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        Browse markets
      </button>
      <span className="text-sm font-medium text-muted-foreground">or</span>
      <Link
        href="/login"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-stone-200 bg-white px-8 py-3 text-base font-semibold text-foreground hover:bg-canvas touch-manipulation sm:w-auto"
      >
        Sign in
      </Link>
    </div>
  )
}
