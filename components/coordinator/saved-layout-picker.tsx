'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Globe2, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  deleteCoordinatorSavedLayout,
  listCoordinatorSavedLayouts,
  saveCoordinatorLayout,
  touchCoordinatorSavedLayout,
  updateCoordinatorSavedLayoutVisibility,
} from '@/lib/coordinator/saved-layouts'
import { cloneLayoutRoomsForApply } from '@/lib/coordinator/saved-layout-snapshot'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { CoordinatorSavedLayout, LayoutRoom } from '@/types/database'

const SAVED_LAYOUT_VALUE_PREFIX = 'saved-layout::'

export interface SavedLayoutPickerProps {
  coordinatorId: string
  locationName: string
  address: string
  getLayoutSnapshot: () => { rooms: LayoutRoom[]; activeRoomId: string } | null
  onApplyLayout: (rooms: LayoutRoom[], activeRoomId: string) => void
  compact?: boolean
  disabled?: boolean
  className?: string
}

export function SavedLayoutPicker({
  coordinatorId,
  locationName,
  address,
  getLayoutSnapshot,
  onApplyLayout,
  compact = false,
  disabled = false,
  className,
}: SavedLayoutPickerProps) {
  const supabase = useMemo(() => createClient(), [])
  const [layouts, setLayouts] = useState<CoordinatorSavedLayout[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [savePublic, setSavePublic] = useState(false)

  const venueReady = locationName.trim().length > 0 && address.trim().length > 0

  const refreshLayouts = useCallback(async () => {
    if (!venueReady) {
      setLayouts([])
      return
    }
    setLoading(true)
    const { layouts: next, error } = await listCoordinatorSavedLayouts(supabase, coordinatorId, {
      locationName,
      address,
    })
    setLoading(false)
    if (error) {
      toast.error('Could not load saved layouts')
      return
    }
    setLayouts(next)
  }, [address, coordinatorId, locationName, supabase, venueReady])

  useEffect(() => {
    void refreshLayouts()
  }, [refreshLayouts])

  const ownLayouts = useMemo(
    () => layouts.filter((layout) => layout.coordinator_id === coordinatorId),
    [coordinatorId, layouts]
  )
  const publicLayouts = useMemo(
    () => layouts.filter((layout) => layout.is_public && layout.coordinator_id !== coordinatorId),
    [coordinatorId, layouts]
  )

  async function handleSelectLayout(raw: string) {
    if (!raw.startsWith(SAVED_LAYOUT_VALUE_PREFIX)) return
    const layoutId = raw.slice(SAVED_LAYOUT_VALUE_PREFIX.length)
    const layout = layouts.find((entry) => entry.id === layoutId)
    if (!layout) return

    const rooms = (layout.layout_rooms ?? []) as LayoutRoom[]
    if (rooms.length === 0) {
      toast.error('This saved layout has no rooms')
      return
    }

    if (
      !window.confirm(
        `Load "${layout.name}"? Current floor plan changes that are not saved to the event will be replaced.`
      )
    ) {
      return
    }

    const cloned = cloneLayoutRoomsForApply(rooms, layout.active_room_id)
    onApplyLayout(cloned.rooms, cloned.activeRoomId)
    await touchCoordinatorSavedLayout(supabase, layout.id)
    void refreshLayouts()
    toast.success(`Loaded layout "${layout.name}"`)
  }

  async function handleSaveLayout() {
    const snapshot = getLayoutSnapshot()
    if (!snapshot || snapshot.rooms.length === 0) {
      toast.error('Add rooms and fixtures to the floor plan before saving a layout')
      return
    }

    setSaving(true)
    const { layout, error } = await saveCoordinatorLayout(supabase, coordinatorId, {
      name: saveName,
      venue: { locationName, address },
      layoutRooms: snapshot.rooms,
      activeRoomId: snapshot.activeRoomId || null,
      isPublic: savePublic,
    })
    setSaving(false)

    if (error || !layout) {
      toast.error(error?.message ?? 'Could not save layout')
      return
    }

    setSaveOpen(false)
    setSaveName('')
    setSavePublic(false)
    await refreshLayouts()
    toast.success(
      savePublic
        ? `Layout "${layout.name}" saved and shared at this venue`
        : `Layout "${layout.name}" saved for future use`
    )
  }

  async function handleTogglePublic(layout: CoordinatorSavedLayout) {
    const nextPublic = !layout.is_public
    const { layout: updated, error } = await updateCoordinatorSavedLayoutVisibility(
      supabase,
      layout.id,
      nextPublic
    )
    if (error || !updated) {
      toast.error(error?.message ?? 'Could not update sharing')
      return
    }
    await refreshLayouts()
    toast.message(
      nextPublic
        ? `"${layout.name}" is now shared at this venue`
        : `"${layout.name}" is now private`
    )
  }

  async function handleDeleteLayout(id: string) {
    const layout = ownLayouts.find((entry) => entry.id === id)
    if (!layout) return
    if (!window.confirm(`Remove saved layout "${layout.name}"?`)) return

    const { error } = await deleteCoordinatorSavedLayout(supabase, id)
    if (error) {
      toast.error(error.message)
      return
    }
    await refreshLayouts()
    toast.message('Saved layout removed')
  }

  const selectDisabled = disabled || loading || !venueReady || layouts.length === 0

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <select
        aria-label="Load saved layout"
        disabled={selectDisabled}
        defaultValue=""
        onChange={(event) => {
          const value = event.target.value
          event.target.value = ''
          if (value) void handleSelectLayout(value)
        }}
        className={cn(
          'h-8 rounded-md border border-stone-200 bg-white px-2 text-xs font-medium text-foreground',
          compact ? 'max-w-[11rem]' : 'min-w-[10rem] max-w-[16rem]',
          selectDisabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <option value="" disabled>
          {loading ? 'Loading layouts…' : layouts.length === 0 ? 'No saved layouts' : 'Load saved layout'}
        </option>
        {ownLayouts.length > 0 ? (
          <optgroup label="Your layouts">
            {ownLayouts.map((layout) => (
              <option
                key={layout.id}
                value={`${SAVED_LAYOUT_VALUE_PREFIX}${layout.id}`}
              >
                {layout.is_public ? '★ ' : ''}
                {layout.name}
              </option>
            ))}
          </optgroup>
        ) : null}
        {publicLayouts.length > 0 ? (
          <optgroup label="Shared at this venue">
            {publicLayouts.map((layout) => (
              <option
                key={layout.id}
                value={`${SAVED_LAYOUT_VALUE_PREFIX}${layout.id}`}
              >
                {layout.name}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('h-8 shrink-0 gap-1.5', compact && 'px-2')}
        disabled={disabled || saving || loading || !venueReady}
        onClick={() => {
          const snapshot = getLayoutSnapshot()
          if (!snapshot || snapshot.rooms.length === 0) {
            toast.error('Add rooms and fixtures to the floor plan before saving a layout')
            return
          }
          setSaveName('')
          setSavePublic(false)
          setSaveOpen(true)
        }}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <BookmarkPlus className="h-3.5 w-3.5" />
        )}
        {compact ? 'Save layout' : 'Save layout for reuse'}
      </Button>

      {ownLayouts.some((layout) => layout.is_public) ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Globe2 className="h-3 w-3" aria-hidden />
          Public layouts visible to coordinators at this venue
        </span>
      ) : null}

      {ownLayouts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {ownLayouts.slice(0, 4).map((layout) => (
            <span
              key={layout.id}
              className="group inline-flex items-center gap-1 rounded-md border border-stone-200/80 bg-card px-2 py-1 text-[11px]"
            >
              <button
                type="button"
                className="truncate max-w-[18ch] hover:underline"
                title={layout.name}
                onClick={() =>
                  void handleSelectLayout(`${SAVED_LAYOUT_VALUE_PREFIX}${layout.id}`)
                }
              >
                {layout.is_public ? '★ ' : ''}
                {layout.name}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-forest opacity-60 group-hover:opacity-100"
                aria-label={layout.is_public ? `Make ${layout.name} private` : `Share ${layout.name} at venue`}
                title={layout.is_public ? 'Shared at venue — click to make private' : 'Make public at this venue'}
                onClick={() => void handleTogglePublic(layout)}
              >
                <Globe2 className={cn('h-3 w-3', layout.is_public && 'text-forest')} />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                aria-label={`Remove ${layout.name}`}
                onClick={() => void handleDeleteLayout(layout.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save floor plan layout</DialogTitle>
            <DialogDescription>
              Reuse this room structure at {locationName.trim() || 'this venue'}. Vendor
              assignments are not saved — only walls, fixtures, and booth positions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="saved-layout-name">Layout name</Label>
              <Input
                id="saved-layout-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="e.g. Main hall — 40 booths"
                autoFocus
              />
            </div>
            <label className="flex items-start gap-3 rounded-md border border-stone-200 p-3 text-sm">
              <Switch
                checked={savePublic}
                onCheckedChange={setSavePublic}
                className="mt-0.5"
                aria-label="Share layout at this venue"
              />
              <span>
                <span className="font-medium text-foreground">Share at this venue</span>
                <span className="mt-1 block text-muted-foreground text-xs leading-relaxed">
                  Other coordinators running markets at {locationName.trim() || 'this address'}{' '}
                  can load this layout. They cannot edit or delete your copy.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !saveName.trim()}
              onClick={() => void handleSaveLayout()}
            >
              {saving ? 'Saving…' : 'Save layout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
