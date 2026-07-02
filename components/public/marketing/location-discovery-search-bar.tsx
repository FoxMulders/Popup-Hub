'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { goToDiscover } from '@/lib/marketing/browse-discover'
import { isIndexableMarketCitySlug } from '@/lib/seo/market-city-pages'
import { inferMarketCityId } from '@/lib/wizard/market-cities'

interface LocationDiscoverySearchBarProps {
  detectedCity: string
}

export function LocationDiscoverySearchBar({ detectedCity }: LocationDiscoverySearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()

    if (!trimmed) {
      goToDiscover(router)
      return
    }

    const cityId = inferMarketCityId(trimmed)
    if (isIndexableMarketCitySlug(cityId)) {
      router.push(`/markets/${cityId}/this-weekend`)
      return
    }

    goToDiscover(router)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch"
    >
      <label htmlFor="location-discovery-search" className="sr-only">
        Search by postal code or city
      </label>
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          id="location-discovery-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Postal code or city near ${detectedCity}`}
          autoComplete="postal-code"
          className="h-12 w-full rounded-full border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#FF6B35]/40 focus:ring-2 focus:ring-[#FF6B35]/20"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6B35] px-6 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#e85f2f] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]/40 focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <MapPin className="h-4 w-4" aria-hidden />
        Open Interactive Map
      </button>
    </form>
  )
}
