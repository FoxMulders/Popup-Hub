'use client'

import { useState } from 'react'
import { BookmarkPlus, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { saveCoordinatorVenue } from '@/lib/coordinator/saved-venues'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'

interface SaveVenuePromptProps {
  coordinatorId: string
  locationName: string
  address: string
  latitude: number
  longitude: number
  marketCity: string
  skipVenueLayout: boolean
  venuePresetId?: VenuePresetId
  initiallySaved?: boolean
}

export function SaveVenuePrompt({
  coordinatorId,
  locationName,
  address,
  latitude,
  longitude,
  marketCity,
  skipVenueLayout,
  venuePresetId = 'blank',
  initiallySaved = false,
}: SaveVenuePromptProps) {
  const [saved, setSaved] = useState(initiallySaved)
  const [loading, setLoading] = useState(false)

  if (saved || !locationName.trim() || !address.trim()) return null

  async function handleSave() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await saveCoordinatorVenue(supabase, coordinatorId, {
        locationName,
        address,
        latitude,
        longitude,
        marketCity,
        skipVenueLayout,
        venuePresetId,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      setSaved(true)
      toast.success('Venue saved — reuse it when you create your next market.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Reuse this venue next time?</p>
      <p className="mt-1 text-muted-foreground">
        Save <span className="font-medium text-foreground">{locationName.trim()}</span> to your
        venue shortcuts for faster recurring market setup.
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-3 gap-1.5"
        disabled={loading}
        onClick={() => void handleSave()}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <BookmarkPlus className="h-4 w-4" aria-hidden />
        )}
        Save venue for future markets
      </Button>
    </div>
  )
}
