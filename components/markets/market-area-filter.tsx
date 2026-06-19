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
}

export function MarketAreaFilter({
  radiusKm,
  onRadiusChange,
  locationLabel,
  locating,
  onUseMyLocation,
  onAddressSelect,
}: MarketAreaFilterProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Distance
      </p>
      <DistanceRadiusPicker value={radiusKm} onChange={onRadiusChange} />
      <HomeAddressPicker
        id="market-area-home-address"
        label="Home address"
        placeholder="Enter your home address or postal code…"
        onSelect={({ lat, lng, label }) => onAddressSelect(lat, lng, label)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 gap-1.5"
          onClick={onUseMyLocation}
          disabled={locating}
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          Use my location
        </Button>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {locationLabel}
        </span>
      </div>
    </div>
  )
}
