'use client'

import { useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { goToDiscover } from '@/lib/marketing/browse-discover'
import { storeUserLocation } from '@/lib/markets/user-location'
import {
  INDEXABLE_MARKET_CITY_SLUGS,
  getMarketCityShortName,
  isIndexableMarketCitySlug,
} from '@/lib/seo/market-city-pages'
import { inferMarketCityId } from '@/lib/wizard/market-cities'

export type LocationSearchBarProps = {
  defaultQuery?: string
  detectedCitySlug?: string
}

type GeocodeResponse = {
  lat: number
  lng: number
  label: string
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

function resolveHubSlugFromQuery(query: string): string | null {
  const normalized = normalizeQuery(query)
  if (!normalized) return null

  for (const slug of INDEXABLE_MARKET_CITY_SLUGS) {
    const shortName = getMarketCityShortName(slug).toLowerCase()
    const slugNormalized = slug.replace(/-/g, ' ')
    if (
      normalized === shortName ||
      normalized === slug ||
      normalized === slugNormalized ||
      normalized.includes(shortName)
    ) {
      return slug
    }
  }

  const inferred = inferMarketCityId(query)
  if (isIndexableMarketCitySlug(inferred)) {
    return inferred
  }

  return null
}

export function LocationSearchBar({
  defaultQuery = '',
  detectedCitySlug,
}: LocationSearchBarProps) {
  const router = useRouter()
  const datalistId = useId()
  const [query, setQuery] = useState(defaultQuery)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const trimmed = query.trim()
    const hubSlug = resolveHubSlugFromQuery(trimmed)

    if (hubSlug) {
      router.push(`/markets/${hubSlug}`)
      return
    }

    if (trimmed.length < 3) {
      goToDiscover(router)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })

      if (response.ok) {
        const result = (await response.json()) as GeocodeResponse
        storeUserLocation({
          lat: result.lat,
          lng: result.lng,
          label: result.label,
        })
      }
    } catch {
      /* geocode optional — still open discover */
    } finally {
      setSubmitting(false)
      goToDiscover(router)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch"
      aria-label="Search markets by city or postal code"
    >
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          list={datalistId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter postal code or city"
          aria-label="Postal code or city"
          autoComplete="postal-code"
          disabled={submitting}
          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#FF6B35]/50 focus:ring-2 focus:ring-[#FF6B35]/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <datalist id={datalistId}>
          {INDEXABLE_MARKET_CITY_SLUGS.map((slug) => (
            <option key={slug} value={getMarketCityShortName(slug)} />
          ))}
        </datalist>
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-label="Open interactive map"
        className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-[#FF6B35] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#e85f2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? 'Opening map…' : 'Open Interactive Map'}
      </button>
      {detectedCitySlug ? (
        <input type="hidden" name="detectedCitySlug" value={detectedCitySlug} readOnly />
      ) : null}
    </form>
  )
}
