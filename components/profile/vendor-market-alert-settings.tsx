'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { HomeAddressPicker } from '@/components/location/home-address-picker'
import { MapPin, Loader2, Navigation } from 'lucide-react'

const RADIUS_OPTIONS = [25, 50, 100, 200] as const

interface VendorMarketAlertSettingsProps {
  userId: string
}

type AlertPrefs = {
  home_lat: number | null
  home_lng: number | null
  radius_km: number
  notify_push: boolean
  notify_in_app: boolean
}

const DEFAULT_PREFS: AlertPrefs = {
  home_lat: null,
  home_lng: null,
  radius_km: 50,
  notify_push: true,
  notify_in_app: true,
}

function geolocationErrorMessage(code: number): string {
  if (code === 1) {
    return 'Location permission denied. Allow location in your browser settings or enter your home address.'
  }
  if (code === 2) {
    return 'Could not determine your position. Try entering your home address instead.'
  }
  if (code === 3) {
    return 'Location request timed out. Try again or enter your home address.'
  }
  return 'Could not read your location. Try entering your home address instead.'
}

export function VendorMarketAlertSettings({ userId }: VendorMarketAlertSettingsProps) {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS)
  const [homeLabel, setHomeLabel] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [locating, setLocating] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void fetch('/api/vendor/market-alert-prefs')
      .then((res) => (res.ok ? res.json() : { prefs: null }))
      .then((data: { prefs: { home_lat: number; home_lng: number; radius_km: number; notify_push: boolean; notify_in_app: boolean } | null }) => {
        if (data.prefs) {
          setPrefs({
            home_lat: data.prefs.home_lat,
            home_lng: data.prefs.home_lng,
            radius_km: data.prefs.radius_km,
            notify_push: data.prefs.notify_push,
            notify_in_app: data.prefs.notify_in_app,
          })
          setHomeLabel('Saved home base')
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [userId])

  const save = useCallback(
    (next: AlertPrefs, label?: string) => {
      if (next.home_lat == null || next.home_lng == null) {
        setPrefs(next)
        if (label) setHomeLabel(label)
        return
      }

      setPrefs(next)
      if (label) setHomeLabel(label)

      startTransition(async () => {
        const res = await fetch('/api/vendor/market-alert-prefs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            home_lat: next.home_lat,
            home_lng: next.home_lng,
            radius_km: next.radius_km,
            notify_push: next.notify_push,
            notify_in_app: next.notify_in_app,
          }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          toast.error(data.error ?? 'Could not save alert settings')
          return
        }
        toast.success('Market alert settings saved')
      })
    },
    []
  )

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('Location is not available on this device. Enter your home address instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        save(
          {
            ...prefs,
            home_lat: pos.coords.latitude,
            home_lng: pos.coords.longitude,
          },
          'Current device location'
        )
      },
      (err) => {
        setLocating(false)
        toast.error(geolocationErrorMessage(err.code))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  if (!loaded) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">
        Loading market alert settings…
      </div>
    )
  }

  const hasHomeBase = prefs.home_lat != null && prefs.home_lng != null

  return (
    <div className="rounded-2xl border bg-white p-6 space-y-5">
      <div className="flex items-start gap-3">
        <MapPin className="h-5 w-5 text-violet-700 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-foreground">New markets nearby</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get notified when organizers publish markets within your travel radius. Set a home base
            address or use your current location — not background GPS tracking.
          </p>
        </div>
      </div>

      <HomeAddressPicker
        id="vendor-alert-home-address"
        label="Home base address"
        onSelect={({ lat, lng, label }) => {
          save({ ...prefs, home_lat: lat, home_lng: lng }, label)
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 gap-1.5"
        disabled={locating || pending}
        onClick={useCurrentLocation}
      >
        {locating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Navigation className="h-4 w-4" />
        )}
        Use current location as home base
      </Button>

      {hasHomeBase ? (
        <p className="text-sm text-muted-foreground">
          Home base: <span className="font-medium text-foreground">{homeLabel ?? 'Set'}</span>
        </p>
      ) : (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Set a home address or location above to enable nearby market alerts.
        </p>
      )}

      <div className="space-y-2">
        <Label className="text-sm">Alert radius</Label>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((km) => (
            <Button
              key={km}
              type="button"
              size="sm"
              variant={prefs.radius_km === km ? 'default' : 'outline'}
              className="min-h-10"
              disabled={pending || !hasHomeBase}
              onClick={() => save({ ...prefs, radius_km: km })}
            >
              {km} km
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">In-app notifications</p>
          <p className="text-xs text-muted-foreground">Show alerts in your notification feed</p>
        </div>
        <Switch
          checked={prefs.notify_in_app}
          disabled={pending || !hasHomeBase}
          onCheckedChange={(checked) => save({ ...prefs, notify_in_app: checked })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Push notifications</p>
          <p className="text-xs text-muted-foreground">Mobile app alerts (when installed)</p>
        </div>
        <Switch
          checked={prefs.notify_push}
          disabled={pending || !hasHomeBase}
          onCheckedChange={(checked) => save({ ...prefs, notify_push: checked })}
        />
      </div>
    </div>
  )
}
