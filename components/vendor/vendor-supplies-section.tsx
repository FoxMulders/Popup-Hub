'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Package, Search, ShoppingBag } from 'lucide-react'
import { AMAZON_ASSOCIATE_DISCLOSURE, buildAmazonCaAffiliateSearchUrl } from '@/lib/affiliate/amazon'
import {
  VENDOR_SUPPLY_CATEGORY_LABELS,
  VENDOR_SUPPLY_SUGGESTIONS,
  filterVendorSupplies,
  type VendorSupplyCategory,
} from '@/lib/vendor/supplies-catalog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const CATEGORY_ORDER: Array<VendorSupplyCategory | 'all'> = [
  'all',
  'booth',
  'display',
  'packaging',
  'signage',
  'tools',
]

export function VendorSuppliesSection() {
  const [searchInput, setSearchInput] = useState('')
  const [activeCategory, setActiveCategory] = useState<VendorSupplyCategory | 'all'>('all')
  const [localFilter, setLocalFilter] = useState('')

  const amazonSearchUrl = useMemo(() => {
    const term = searchInput.trim()
    return term ? buildAmazonCaAffiliateSearchUrl(term) : null
  }, [searchInput])

  const suggestions = useMemo(
    () =>
      filterVendorSupplies(VENDOR_SUPPLY_SUGGESTIONS, {
        category: activeCategory,
        query: localFilter,
      }),
    [activeCategory, localFilter]
  )

  function handleAmazonSearch(event: React.FormEvent) {
    event.preventDefault()
    const term = searchInput.trim()
    if (!term) return
    window.open(buildAmazonCaAffiliateSearchUrl(term), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-card p-5 shadow-[var(--shadow-market)]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-harvest-100 text-harvest-700">
            <Search className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Search Amazon.ca</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Find booth gear, displays, and packaging. Results open on Amazon.ca with our
              associate link.
            </p>
          </div>
        </div>

        <form onSubmit={handleAmazonSearch} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="e.g. portable clothing rack, market tent weights…"
            aria-label="Search vendor supplies on Amazon.ca"
            className="flex-1"
          />
          <Button type="submit" className="min-h-11 shrink-0 gap-2" disabled={!searchInput.trim()}>
            <Search className="h-4 w-4" aria-hidden />
            Search Amazon
          </Button>
        </form>

        {amazonSearchUrl ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Or{' '}
            <a
              href={amazonSearchUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="font-medium text-harvest-700 underline-offset-2 hover:underline"
            >
              open your search on Amazon.ca
              <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
            </a>
          </p>
        ) : null}
      </div>

      <section aria-labelledby="vendor-supplies-suggestions-heading">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-harvest-600" aria-hidden />
              <h2 id="vendor-supplies-suggestions-heading" className="text-xl font-semibold text-foreground">
                Suggested supplies
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Curated picks for market vendors — every link includes our Amazon Associate tag.
            </p>
          </div>
          <Input
            type="search"
            value={localFilter}
            onChange={(event) => setLocalFilter(event.target.value)}
            placeholder="Filter suggestions…"
            aria-label="Filter suggested supplies"
            className="sm:max-w-xs"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((category) => {
            const label = category === 'all' ? 'All' : VENDOR_SUPPLY_CATEGORY_LABELS[category]
            const active = activeCategory === category
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active
                    ? 'border-harvest-300 bg-harvest-50 text-harvest-800'
                    : 'border-stone-200 bg-card text-muted-foreground hover:border-stone-300 hover:text-foreground'
                )}
                aria-pressed={active}
              >
                {label}
              </button>
            )
          })}
        </div>

        {suggestions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 bg-canvas/60 px-4 py-8 text-center text-sm text-muted-foreground">
            No suggestions match your filter. Try another category or search Amazon directly above.
          </p>
        ) : (
          <ul className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {suggestions.map((item) => (
              <li key={item.id}>
                <Card className="overflow-hidden transition hover:border-harvest-200 hover:shadow-md">
                  <CardContent className="flex flex-col p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {VENDOR_SUPPLY_CATEGORY_LABELS[item.category]}
                      </Badge>
                    </div>
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <a
                      href={item.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-stone-200 bg-canvas px-3 text-sm font-medium text-harvest-800 shadow-[var(--shadow-market)] transition hover:border-harvest-200 hover:bg-harvest-50/50"
                    >
                      <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
                      Shop on Amazon.ca
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    </a>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] leading-snug text-muted-foreground">{AMAZON_ASSOCIATE_DISCLOSURE}</p>
    </div>
  )
}
