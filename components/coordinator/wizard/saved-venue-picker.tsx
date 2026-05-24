'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookmarkPlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import {
  deleteCoordinatorSavedVenue,
  listCoordinatorSavedVenues,
  saveCoordinatorVenue,
  touchCoordinatorSavedVenue,
} from '@/lib/coordinator/saved-venues'
import type { EdmontonQuadrantFilter } from '@/lib/booth-planner/edmonton-venue-registry'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'
import { WIZARD_FIELD_LABEL, WIZARD_SELECT_TRIGGER } from '@/lib/wizard/wizard-panel-styles'
import { cn } from '@/lib/utils'
import type { CoordinatorSavedVenue } from '@/types/database'

interface SavedVenuePickerProps {
  coordinatorId: string
  locationName: string
  address: string
  lat: number
  lng: number
  pinDropped: boolean
  venuePresetId: VenuePresetId
  skipVenueLayout: boolean
  cityQuadrant: EdmontonQuadrantFilter
  onApply: (venue: CoordinatorSavedVenue) => void
}

export function SavedVenuePicker({
  coordinatorId,
  locationName,
  address,
  lat,
  lng,
  pinDropped,
  venuePresetId,
  skipVenueLayout,
  cityQuadrant,
  onApply,
}: SavedVenuePickerProps) {
  const supabase = createClient()
  const [venues, setVenues] = useState<CoordinatorSavedVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const { venues: next, error } = await listCoordinatorSavedVenues(supabase, coordinatorId)
    if (error) {
      toast.error('Could not load saved venues')
    } else {
      setVenues(next)
    }
    setLoading(false)
  }, [coordinatorId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleSelect(id: string) {
    setSelectedId(id)
    if (!id) return
    const venue = venues.find((v) => v.id === id)
    if (!venue) return
    onApply(venue)
    await touchCoordinatorSavedVenue(supabase, venue.id)
    void refresh()
    toast.success(`Loaded ${venue.location_name}`)
  }

  async function handleSave() {
    if (!locationName.trim()) {
      toast.error('Enter a venue name before saving')
      return
    }
    if (!address.trim()) {
      toast.error('Enter an address before saving')
      return
    }
    if (!pinDropped) {
      toast.error('Drop a map pin before saving this venue')
      return
    }

    setSaving(true)
    const { venue, error } = await saveCoordinatorVenue(supabase, coordinatorId, {
      locationName,
      address,
      latitude: lat,
      longitude: lng,
      venuePresetId,
      skipVenueLayout,
      cityQuadrant,
    })
    setSaving(false)

    if (error || !venue) {
      toast.error(error?.message ?? 'Could not save venue')
      return
    }

    setSelectedId(venue.id)
    await refresh()
    toast.success('Venue saved for future events')
  }

  async function handleDelete(id: string) {
    const venue = venues.find((v) => v.id === id)
    if (!venue) return
    if (!window.confirm(`Remove "${venue.location_name}" from saved venues?`)) return

    const { error } = await deleteCoordinatorSavedVenue(supabase, id)
    if (error) {
      toast.error(error.message)
      return
    }
    if (selectedId === id) setSelectedId('')
    await refresh()
    toast.message('Saved venue removed')
  }

  return (
    <div className="rounded-lg border-2 border-stone-200 bg-canvas px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="wizard-saved-venue" className={WIZARD_FIELD_LABEL}>
            Saved venues
          </Label>
          <select
            id="wizard-saved-venue"
            value={selectedId}
            onChange={(e) => void handleSelect(e.target.value)}
            disabled={loading || venues.length === 0}
            className={cn(WIZARD_SELECT_TRIGGER, 'w-full disabled:opacity-60')}
          >
            <option value="">
              {loading
                ? 'Loading saved venues…'
                : venues.length === 0
                  ? 'No saved venues yet'
                  : 'Choose a saved venue…'}
            </option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id} className="whitespace-normal break-words">
                {venue.location_name} — {venue.address}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-1.5 shrink-0"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
          Save for future use
        </Button>
      </div>

      {venues.length > 0 ? (
        <ul className="space-y-1.5">
          {venues.slice(0, 4).map((venue) => (
            <li
              key={venue.id}
              className="flex items-start justify-between gap-2 rounded-md border border-stone-200/80 bg-card px-2.5 py-1.5 text-xs"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left hover:underline"
                onClick={() => void handleSelect(venue.id)}
              >
                <span className="font-medium text-foreground block truncate">{venue.location_name}</span>
                <span className="text-muted-foreground block truncate">{venue.address}</span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${venue.location_name}`}
                onClick={() => void handleDelete(venue.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Save the current name, address, and map pin to reuse them on your next market.
        </p>
      )}
    </div>
  )
}
