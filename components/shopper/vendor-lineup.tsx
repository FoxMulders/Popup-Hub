'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  buildVendorLineup,
  filterVendorsByCategory,
  filterVendorsBySearch,
  getCategoryChips,
  type VendorLineupEntry,
} from '@/lib/shopper/vendors'
import { VendorLineupCard } from '@/components/shopper/vendor-lineup-card'
import type { BoothApplication } from '@/types/database'

interface VendorLineupProps {
  applications: BoothApplication[]
  eventId: string
  onSelectVendor: (vendor: VendorLineupEntry) => void
  onViewBoothOnMap?: (boothNumber: number) => void
}

export function VendorLineup({
  applications,
  eventId,
  onSelectVendor,
  onViewBoothOnMap,
}: VendorLineupProps) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const lineup = useMemo(() => buildVendorLineup(applications), [applications])
  const chips = useMemo(() => getCategoryChips(lineup), [lineup])
  const filtered = useMemo(() => {
    let list = filterVendorsByCategory(lineup, categoryId)
    list = filterVendorsBySearch(list, search)
    return list
  }, [lineup, categoryId, search])

  if (lineup.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Vendor lineup posting soon — check back as organizers confirm booths.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vendors…"
          className="min-h-11 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" className="shrink-0" onClick={() => setCategoryId(null)}>
          <Badge variant={categoryId === null ? 'default' : 'outline'} className="cursor-pointer capitalize">
            All ({lineup.length})
          </Badge>
        </button>
        {chips.map((c) => (
          <button key={c.id} type="button" className="shrink-0" onClick={() => setCategoryId(c.id)}>
            <Badge
              className="cursor-pointer capitalize"
              variant={categoryId === c.id ? 'default' : 'outline'}
            >
              {c.name} ({c.count})
            </Badge>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((vendor) => (
          <VendorLineupCard
            key={vendor.id}
            vendor={vendor}
            eventId={eventId}
            onClick={() => onSelectVendor(vendor)}
            onViewBoothOnMap={onViewBoothOnMap}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No vendors match your search.</p>
      )}
    </div>
  )
}
