'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck, MapPin } from 'lucide-react'
import { requestUserLocation } from '@/lib/markets/user-location'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

export function MarketingHeroActions() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function browseMarkets() {
    setLoading(true)
    await requestUserLocation()
    router.push('/discover')
    setLoading(false)
  }

  return (
    <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
      <Link
        href={TRUST_DIRECTORY_LINKS.check.href}
        className="marketing-pill marketing-pill--primary inline-flex min-h-12 w-full gap-2 sm:w-auto justify-center"
        title={TRUST_DIRECTORY_LINKS.check.tagline}
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        {TRUST_DIRECTORY_LINKS.check.ctaOpen}
      </Link>
      <button
        type="button"
        onClick={() => void browseMarkets()}
        disabled={loading}
        className="marketing-pill marketing-pill--secondary inline-flex min-h-12 w-full gap-2 disabled:opacity-70 sm:w-auto justify-center"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <MapPin className="h-4 w-4" aria-hidden />
        )}
        Browse markets
      </button>
    </div>
  )
}
