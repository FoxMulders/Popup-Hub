'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FloorPlanV2 } from '@/components/coordinator/floor-plan-v2/floor-plan-v2'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import { LayoutPlannerHeader } from '@/components/coordinator/layout-planner/layout-planner-header'
import { LayoutPlannerShell } from '@/components/coordinator/layout-planner/layout-planner-shell'
import { LayoutPlannerStats } from '@/components/coordinator/layout-planner/layout-planner-stats'
import {
  createLayoutRoom,
  getActiveRoom,
  roomsFromBoothLayout,
  updateRoomInList,
} from '@/lib/booth-planner/layout-rooms'
import {
  LAYOUT_ROOM_PRESETS,
  presetToRoomPartial,
  type LayoutRoomPresetId,
} from '@/lib/booth-planner/layout-room-presets'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import {
  calculateMaxBoothCapacity,
  calculateNetUsableFloorSpace,
  boothUnitFootprint,
} from '@/lib/booth-planner/smart-populate-booth-caps'
import { resolveTemplateAnchoredDimensions } from '@/lib/booth-planner/venue-presets'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import { createClient } from '@/lib/supabase/client'
import type { BoothLayout, Event, LayoutRoom } from '@/types/database'

export interface LayoutPlannerPageProps {
  eventId: string
  event: Event
  existingLayout: BoothLayout | null
  applications?: ReadonlyArray<{
    id: string
    vendor_id?: string
    table_count?: number
    status?: string
  }>
}

export function LayoutPlannerPage({
  eventId,
  event,
  existingLayout,
  applications = [],
}: LayoutPlannerPageProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const initialRoomsState = useMemo(
    () => roomsFromBoothLayout(existingLayout),
    [existingLayout]
  )

  const [rooms, setRooms] = useState(initialRoomsState.rooms)
  const [activeRoomId, setActiveRoomId] = useState(initialRoomsState.activeRoomId)
  const [hasOverlap, setHasOverlap] = useState(false)
  const [placedCount, setPlacedCount] = useState(0)
  const [saving, setSaving] = useState(false)

  const saveLayoutRef = useRef<(() => Promise<boolean>) | null>(null)

  const activeRoom = useMemo(() => getActiveRoom(rooms, activeRoomId), [rooms, activeRoomId])

  const venuePresetId: VenuePresetId =
    (activeRoom.venue_preset_id as VenuePresetId | null | undefined) ?? 'blank'

  const templateAnchor = useMemo(
    () =>
      resolveTemplateAnchoredDimensions(
        venuePresetId,
        activeRoom.venue_width,
        activeRoom.venue_length
      ),
    [venuePresetId, activeRoom.venue_width, activeRoom.venue_length]
  )

  const baselineTableLengthFt: LayoutBaselineTableLengthFt = useMemo(() => {
    const ft = activeRoom.baseline_table_length_ft
    if (ft != null && isLayoutBaselineTableLengthFt(ft)) return ft
    return DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  }, [activeRoom.baseline_table_length_ft])

  const eventCategoryNames = useMemo(() => {
    const limits = (
      event as Event & {
        category_limits?: Array<{ category?: { name?: string } }>
      }
    ).category_limits
    return (limits ?? [])
      .map((cl) => cl.category?.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b))
  }, [event])

  const layoutCapacity = useMemo(() => {
    const floor = calculateNetUsableFloorSpace(templateAnchor.width, templateAnchor.length, {
      venueElements: activeRoom.venue_elements,
      entrance: activeRoom.entrance,
    })
    const footprint = boothUnitFootprint(baselineTableLengthFt)
    return calculateMaxBoothCapacity(floor.netUsableSqFt, footprint.sqFt)
  }, [templateAnchor, activeRoom.venue_elements, activeRoom.entrance, baselineTableLengthFt])

  const handleLayoutRoomsChange = useCallback((nextRooms: LayoutRoom[], nextActiveRoomId: string) => {
    setRooms(nextRooms)
    setActiveRoomId(nextActiveRoomId)
  }, [])

  function handleAddRoom(presetId?: LayoutRoomPresetId) {
    const preset =
      LAYOUT_ROOM_PRESETS.find((p) => p.id === presetId) ?? LAYOUT_ROOM_PRESETS[0]!
    const isFirstRoom = rooms.length === 0
    let name: string
    if (preset.id !== 'blank') {
      name = preset.name
    } else if (isFirstRoom) {
      name = 'Main Hall'
    } else {
      name = `Room ${rooms.length + 1}`
    }
    const partial = presetToRoomPartial(preset)
    let nextOriginX = 0
    const nextOriginY = 0
    if (!isFirstRoom) {
      let maxRight = 0
      for (const r of rooms) {
        const right = (r.canvas_origin_x ?? 0) + (r.venue_width || 50)
        if (right > maxRight) maxRight = right
      }
      nextOriginX = maxRight + 4
    }
    const room = createLayoutRoom(name, {
      ...partial,
      canvas_origin_x: nextOriginX,
      canvas_origin_y: nextOriginY,
    })
    setRooms((prev) => [...prev, room])
    setActiveRoomId(room.id)
    toast.success(`Added ${room.name}`)
  }

  function handleRenameRoom(roomId: string, name: string) {
    setRooms((prev) => updateRoomInList(prev, roomId, { name }))
  }

  function handleDeleteRoom(roomId: string) {
    if (rooms.length <= 1) {
      toast.error('At least one room is required')
      return
    }
    const room = rooms.find((r) => r.id === roomId)
    if (
      !window.confirm(
        `Delete "${room?.name ?? 'this room'}"? Its booths and fixtures will be removed.`
      )
    ) {
      return
    }
    const next = rooms.filter((r) => r.id !== roomId)
    setRooms(next)
    if (activeRoomId === roomId) setActiveRoomId(next[0]!.id)
    toast.message('Room deleted')
  }

  function handleSelectRoom(roomId: string) {
    handleLayoutRoomsChange(rooms, roomId)
  }

  function handleBaselineTableLengthChange(ft: LayoutBaselineTableLengthFt) {
    setRooms((prev) =>
      updateRoomInList(prev, activeRoomId, { baseline_table_length_ft: ft })
    )
  }

  const handleSaveAndDeploy = useCallback(async () => {
    if (hasOverlap) {
      toast.error('Resolve layout overlaps before deploying')
      return
    }
    setSaving(true)
    try {
      const saveFn = saveLayoutRef.current
      if (saveFn) {
        const saved = await saveFn()
        if (!saved) return
      }

      if (event.status === 'draft') {
        const { error } = await supabase
          .from('events')
          .update({ status: 'published' })
          .eq('id', eventId)
        if (error) {
          toast.error(`Deploy failed — ${error.message}`)
          return
        }
        await revalidateMarketsCacheClient()
        toast.success('Layout saved and market deployed!')
        router.push(`/coordinator/events/${eventId}`)
        return
      }

      toast.success('Layout saved')
    } finally {
      setSaving(false)
    }
  }, [event.status, eventId, hasOverlap, router, supabase])

  const eventName = event.name?.trim() ?? 'Untitled event'
  const isDraft = event.status === 'draft'

  const roomBar = (
    <LayoutRoomBar
      rooms={rooms}
      activeRoomId={activeRoomId}
      onSelectRoom={handleSelectRoom}
      onAddRoom={handleAddRoom}
      onRenameRoom={handleRenameRoom}
      onDeleteRoom={handleDeleteRoom}
      compact
    />
  )

  return (
    <LayoutPlannerShell
      mode="standalone"
      header={
        <LayoutPlannerHeader
          mode="standalone"
          eventId={eventId}
          eventName={eventName}
          title="Spatial layout"
          hasOverlap={hasOverlap}
          showDraftBadge={isDraft}
          onSave={handleSaveAndDeploy}
          saveDisabled={hasOverlap}
          saveLoading={saving}
          saveLabel={isDraft ? 'Save & deploy' : 'Save layout'}
        />
      }
      leftRail={roomBar}
      stats={
        <LayoutPlannerStats
          placedCount={placedCount}
          layoutCapacity={layoutCapacity}
          hasOverlap={hasOverlap}
        />
      }
    >
      <FloorPlanV2
        eventId={eventId}
        layoutRooms={rooms}
        layoutActiveRoomId={activeRoomId}
        onLayoutRoomsChange={handleLayoutRoomsChange}
        saveLayoutRef={saveLayoutRef}
        eventCategoryNames={eventCategoryNames}
        onAddRoom={handleAddRoom}
        onRenameRoom={handleRenameRoom}
        onDeleteRoom={handleDeleteRoom}
        baselineTableLengthFt={baselineTableLengthFt}
        onBaselineTableLengthChange={handleBaselineTableLengthChange}
        layoutCapacity={layoutCapacity}
        applications={applications}
        onOverlapChange={setHasOverlap}
        onPlacedCountChange={setPlacedCount}
        onSaveMarket={handleSaveAndDeploy}
        saveMarketDisabled={hasOverlap || saving}
        saveMarketLoading={saving}
        chrome="embedded"
        className="h-full min-h-0"
      />
    </LayoutPlannerShell>
  )
}
