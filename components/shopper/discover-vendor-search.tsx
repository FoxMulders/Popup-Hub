'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DiscoverVendorResultCard } from '@/components/shopper/discover-vendor-result-card'
import { DiscoverEventCards } from '@/components/shopper/discover-event-cards'
import { DiscoverVendorEmptyState } from '@/components/shopper/discover-vendor-empty-state'
import type { DateFilterPreset } from '@/lib/shopper/discover-date'
import type {
  DiscoverCategoryChip,
  DiscoverVendorHit,
} from '@/lib/shopper/discover-vendor-search'
import type { EventWithMeta } from '@/lib/shopper/events'
import { formatDateParam } from '@/lib/shopper/events'
import type { LatLng } from '@/lib/shopper/geo'
import { cn } from '@/lib/utils'

type CategoryMarketSummary = {
  event: EventWithMeta
  matchingVendorCount: number
  matchingVendorNames: string[]
}

interface DiscoverVendorSearchProps {
  datePreset: DateFilterPreset
  filterDate: Date
  origin: LatLng
  radiusKm: number | null
  liveAuctionsOnly: boolean
  favoriteIds: string[]
  followVendorIds: string[]
  activeAuctionByEventId?: Record<string, string>
  onReplaceParams: (updates: Record<string, string | null>) => void
  onWidenRadius: () => void
  onShowEverywhere: () => void
  onTryPreset: (preset: DateFilterPreset) => void
}

export function DiscoverVendorSearch({
  datePreset,
  filterDate,
  origin,
  radiusKm,
  liveAuctionsOnly,
  favoriteIds,
  followVendorIds,
  activeAuctionByEventId = {},
  onReplaceParams,
  onWidenRadius,
  onShowEverywhere,
  onTryPreset,
}: DiscoverVendorSearchProps) {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(
    () => searchParams.get('category') ?? null
  )
  const [vendors, setVendors] = useState<DiscoverVendorHit[]>([])
  const [markets, setMarkets] = useState<CategoryMarketSummary[]>([])
  const [categoryChips, setCategoryChips] = useState<DiscoverCategoryChip[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const fetchSeq = useRef(0)

  const hasActiveFilter = useMemo(
    () => search.trim().length > 0 || categoryId != null,
    [search, categoryId]
  )

  const syncUrl = useCallback(
    (nextSearch: string, nextCategoryId: string | null) => {
      onReplaceParams({
        q: nextSearch.trim() || null,
        category: nextCategoryId,
      })
    },
    [onReplaceParams]
  )

  useEffect(() => {
    const seq = ++fetchSeq.current
    const params = new URLSearchParams()
    params.set('when', datePreset)
    params.set('date', formatDateParam(filterDate))
    if (liveAuctionsOnly) params.set('live', 'auctions')
    if (radiusKm != null) params.set('radiusKm', String(radiusKm))
    if (origin.lat != null && origin.lng != null) {
      params.set('lat', String(origin.lat))
      params.set('lng', String(origin.lng))
    }
    params.set('chipsOnly', '1')

    void fetch(`/api/discover/vendors?${params.toString()}`)
      .then((res) => res.json())
      .then((json: { categoryChips?: DiscoverCategoryChip[] }) => {
        if (seq !== fetchSeq.current) return
        if (json.categoryChips?.length) setCategoryChips(json.categoryChips)
      })
      .catch(() => {})
  }, [datePreset, filterDate, origin, radiusKm, liveAuctionsOnly])

  useEffect(() => {
    const trimmed = search.trim()
    if (!trimmed && !categoryId) {
      setVendors([])
      setMarkets([])
      setSearchError(null)
      setLoading(false)
      return
    }

    const seq = ++fetchSeq.current
    const timer = setTimeout(async () => {
      setLoading(true)
      setSearchError(null)
      try {
        const params = new URLSearchParams()
        if (trimmed) params.set('q', trimmed)
        if (categoryId) params.set('category', categoryId)
        params.set('when', datePreset)
        params.set('date', formatDateParam(filterDate))
        if (liveAuctionsOnly) params.set('live', 'auctions')
        if (radiusKm != null) params.set('radiusKm', String(radiusKm))
        if (origin.lat != null && origin.lng != null) {
          params.set('lat', String(origin.lat))
          params.set('lng', String(origin.lng))
        }

        const res = await fetch(`/api/discover/vendors?${params.toString()}`)
        const json = (await res.json()) as {
          vendors?: DiscoverVendorHit[]
          markets?: CategoryMarketSummary[]
          categoryChips?: DiscoverCategoryChip[]
          error?: string
        }

        if (seq !== fetchSeq.current) return

        if (!res.ok) {
          setVendors([])
          setMarkets([])
          setSearchError(json.error ?? 'Search failed')
          return
        }

        setVendors(json.vendors ?? [])
        setMarkets(json.markets ?? [])
        setCategoryChips(json.categoryChips ?? [])
      } catch {
        if (seq !== fetchSeq.current) return
        setVendors([])
        setMarkets([])
        setSearchError('Network error — try again')
      } finally {
        if (seq === fetchSeq.current) setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, categoryId, datePreset, filterDate, origin, radiusKm, liveAuctionsOnly])

  function handleSearchChange(value: string) {
    setSearch(value)
    syncUrl(value, categoryId)
  }

  function handleCategorySelect(id: string | null) {
    setCategoryId(id)
    syncUrl(search, id)
  }

  const showMarketResults = categoryId != null && search.trim().length === 0
  const showVendorResults = search.trim().length > 0
  const hasResults = showMarketResults ? markets.length > 0 : vendors.length > 0

  return (
    <div className="mt-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vendors by name or product (e.g. Tipsy Fox, wine)…"
          className="min-h-11 pl-9"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search vendors"
        />
      </div>

      {categoryChips.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className="shrink-0" onClick={() => handleCategorySelect(null)}>
            <Badge
              variant={categoryId === null ? 'default' : 'outline'}
              className="cursor-pointer capitalize"
            >
              All categories
            </Badge>
          </button>
          {categoryChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="shrink-0"
              onClick={() => handleCategorySelect(chip.id)}
            >
              <Badge
                className="cursor-pointer capitalize"
                variant={categoryId === chip.id ? 'default' : 'outline'}
              >
                {chip.name} ({chip.count})
              </Badge>
            </button>
          ))}
        </div>
      ) : null}

      {!hasActiveFilter ? (
        <p className="rounded-2xl border border-dashed border-stone-200 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Search for a vendor by name or tap a category to see which markets they&apos;re at for
          your selected date and area.
        </p>
      ) : loading ? (
        <p className="text-center text-sm text-muted-foreground">Searching vendors…</p>
      ) : searchError ? (
        <p className="text-center text-sm text-destructive">{searchError}</p>
      ) : !hasResults ? (
        <DiscoverVendorEmptyState
          datePreset={datePreset}
          radiusKm={radiusKm}
          onWidenRadius={onWidenRadius}
          onShowEverywhere={onShowEverywhere}
          onTryPreset={onTryPreset}
        />
      ) : showMarketResults ? (
        <DiscoverEventCards
          events={markets.map((m) => ({
            ...m.event,
            vendor_count: m.matchingVendorCount,
          }))}
          selectedDate={filterDate}
          favoriteIds={favoriteIds}
          activeAuctionByEventId={activeAuctionByEventId}
          matchingVendorPreview={Object.fromEntries(
            markets.map((m) => [m.event.id, m.matchingVendorNames])
          )}
        />
      ) : (
        <div
          className={cn(
            'grid gap-4',
            showVendorResults && vendors.length > 0 ? 'sm:grid-cols-2' : undefined
          )}
        >
          {vendors.map((vendor) => (
            <DiscoverVendorResultCard
              key={vendor.vendorId}
              vendor={vendor}
              initialFollowing={followVendorIds.includes(vendor.vendorId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
