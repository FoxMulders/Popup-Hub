'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { MapPin, Loader2 } from 'lucide-react'

const RADIUS_OPTIONS = [25, 50, 100, 200] as const

interface VendorMarketAlertSettingsProps {
  userId: string
}

type AlertPrefs = {
  home_lat: number
  home_lng: number
  radius_km: number
  notify_push: boolean
  notify_in_app: boolean
}

const DEFAULT_PREFS: AlertPrefs = {
  home_lat: 53.5461,
  home_lng: -113.4938,
  radius_km: 50,
  notify_push: true,
  notify_in_app: true,
}

export function VendorMarketAlertSettings({ userId }: VendorMarketAlertSettingsProps) {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)
  const [locating, setLocating] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void fetch('/api/vendor/market-alert-prefs')
      .then((res) => (res.ok ? res.json() : { prefs: null }))
      .then((data: { prefs: AlertPrefs | null }) => {
        if (data.prefs) setPrefs(data.prefs)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [userId])

  const save = useCallback((next: AlertPrefs) => {
    setPrefs(next)
    startTransition(async () => {
      const res = await fetch('/api/vendor/market-alert-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error ?? 'Could not save alert settings')
        return
      }
      toast.success('Market alert settings saved')
    })
  }, [])

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('Location is not available on this device')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        save({
          ...prefs,
          home_lat: pos.coords.latitude,
          home_lng: pos.coords.longitude,
        })
      },
      () => {
        setLocating(false)
        toast.error('Could not read your location')
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

  return (
    <div className="rounded-2xl border bg-white p-6 space-y-5">
      <div className="flex items-start gap-3">
        <MapPin className="h-5 w-5 text-violet-700 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-foreground">New markets nearby</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get notified when organizers publish markets within your travel radius. Uses a home base
            location — not background GPS tracking.
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10"
        disabled={locating || pending}
        onClick={useCurrentLocation}
      >
        {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Use current location as home base
      </Button>

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
              disabled={pending}
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
          disabled={pending}
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
          disabled={pending}
          onCheckedChange={(checked) => save({ ...prefs, notify_push: checked })}
        />
      </div>
    </div>
  )
}
