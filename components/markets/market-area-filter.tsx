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

const QUICK_CITY_CENTERS = [
  { label: 'Edmonton area', lat: 53.5461, lng: -113.4938 },
  { label: 'Calgary area', lat: 51.0447, lng: -114.0719 },
] as const

export function MarketAreaFilter({
  radiusKm,
  onRadiusChange,
  locationLabel,
  locating,
  onUseMyLocation,
  onAddressSelect,
}: MarketAreaFilterProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Distance
        </p>
        <DistanceRadiusPicker value={radiusKm} onChange={onRadiusChange} />
      </div>

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
          {QUICK_CITY_CENTERS.map((city) => (
            <Button
              key={city.label}
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={() => onAddressSelect(city.lat, city.lng, city.label)}
            >
              {city.label}
            </Button>
          ))}
        </div>
        <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {locationLabel}
        </p>
      </div>

      <HomeAddressPicker
        id="market-area-home-address"
        label="Or enter an address"
        placeholder="Address or postal code…"
        onSelect={({ lat, lng, label }) => onAddressSelect(lat, lng, label)}
      />
    </div>
  )
}
