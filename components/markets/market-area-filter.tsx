'use client'

import { Loader2, MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DistanceRadiusPicker } from '@/components/markets/distance-radius-picker'
import { HomeAddressPicker } from '@/components/location/home-address-picker'
import type { DistanceRadiusKm } from '@/lib/markets/distance-radius'

interface MarketAreaFilterProps {
  radiusKm: number | null
  onRadiusChange: (km: DistanceRadiusKm) => void
  locationLabel: string
  locating: boolean
  onUseMyLocation: () => void
  onAddressSelect: (lat: number, lng: number, label: string) => void
  /** Vendor apply: distance filter is optional — collapsed by default. */
  variant?: 'default' | 'vendor'
}

export function MarketAreaFilter({
  radiusKm,
  onRadiusChange,
  locationLabel,
  locating,
  onUseMyLocation,
  onAddressSelect,
  variant = 'default',
}: MarketAreaFilterProps) {
  const distanceSection = (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {variant === 'vendor' ? 'Optional: filter by distance' : 'Distance'}
      </p>
      <DistanceRadiusPicker value={radiusKm} onChange={onRadiusChange} />
    </div>
  )

  return (
    <div className="space-y-4">
      {variant === 'vendor' ? (
        <details className="rounded-xl border border-stone-200/80 bg-white/60 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Narrow by distance (optional)
          </summary>
          <div className="mt-3 space-y-4">{distanceSection}</div>
        </details>
      ) : (
        distanceSection
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Near
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-1.5"
            onClick={onUseMyLocation}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Navigation className="h-4 w-4" aria-hidden />
            )}
            Use my location
          </Button>
        </div>
        <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {locationLabel}
        </p>
      </div>

      <HomeAddressPicker
        id="market-area-home-address"
        label="Or enter an address or postal code"
        placeholder="Address or postal code…"
        onSelect={({ lat, lng, label }) => onAddressSelect(lat, lng, label)}
      />
    </div>
  )
}
