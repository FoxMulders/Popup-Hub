'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FloorPlanV2 } from '@/components/coordinator/floor-plan-v2/floor-plan-v2'
import { createClient } from '@/lib/supabase/client'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import { checkCoordinatorPublishGate } from '@/lib/coordinator/publish-gate-client'
import { clearMultiRoomDraft } from '@/components/coordinator/floor-plan-v2/state/local-draft'
import type { BoothLayout, Event } from '@/types/database'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import { SpatialLayoutShell } from './spatial-layout-shell'
import { SpatialLayoutToolbar } from './spatial-layout-toolbar'
import { useSpatialLayoutState } from './use-spatial-layout-state'

export interface SpatialLayoutEditorProps {
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

export function SpatialLayoutEditor({
  eventId,
  event,
  existingLayout,
  applications = [],
}: SpatialLayoutEditorProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const saveLayoutRef = useRef<(() => Promise<boolean>) | null>(null)

  const [hasOverlap, setHasOverlap] = useState(false)
  const [placedCount, setPlacedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [layoutGeneration, setLayoutGeneration] = useState(0)

  const {
    rooms,
    activeRoomId,
    baselineTableLengthFt,
    eventCategoryNames,
    layoutCapacity,
    handleLayoutRoomsChange,
    handleAddRoom,
    handleRenameRoom,
    handleDeleteRoom,
    handleBaselineTableLengthChange,
  } = useSpatialLayoutState({ event, existingLayout })

  const handleReloadFromServer = useCallback(() => {
    clearMultiRoomDraft(eventId)
    setLayoutGeneration((n) => n + 1)
    toast.message('Reloaded layout from server — merge overlays cleared from cache.')
  }, [eventId])

  const handleSaveDraft = useCallback(async () => {
    if (hasOverlap) {
      toast.error('Resolve layout overlaps before saving')
      return
    }
    setSavingDraft(true)
    try {
      const saveFn = saveLayoutRef.current
      if (!saveFn) {
        toast.error('Layout editor is still loading — try again in a moment.')
        return
      }
      const saved = await saveFn()
      if (saved) {
        toast.success('Layout draft saved')
      }
    } finally {
      setSavingDraft(false)
    }
  }, [hasOverlap])

  const handleSave = useCallback(async () => {
    if (hasOverlap) {
      toast.error('Resolve layout overlaps before saving')
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
        const publishBlock = await checkCoordinatorPublishGate()
        if (publishBlock) {
          toast.error(publishBlock)
          return
        }

        const verifyRes = await fetch('/api/coordinator/venues/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            latitude: event.latitude,
            longitude: event.longitude,
            address: event.address,
            locationName: event.location_name,
            pinDropped: true,
            placeTypes: event.venue_place_types?.length ? event.venue_place_types : undefined,
            persist: true,
          }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyRes.ok || !verifyData.verified) {
          toast.error(
            verifyData.reason ??
              'Venue must be verified before deploying the market.'
          )
          return
        }

        const { error } = await supabase
          .from('events')
          .update({ status: 'published' })
          .eq('id', eventId)
        if (error) {
          toast.error(`Deploy failed — ${error.message}`)
          return
        }
        await revalidateMarketsCacheClient()
        toast.success('Layout saved and market deployed')
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

  return (
    <FloorPlanViewportLayoutProvider>
      <DesktopScreenRequiredOverlay exitHref={`/coordinator/events/${eventId}`} />
      <SpatialLayoutEditorBody
        eventId={eventId}
        eventName={eventName}
        isDraft={isDraft}
        layoutGeneration={layoutGeneration}
        rooms={rooms}
        activeRoomId={activeRoomId}
        baselineTableLengthFt={baselineTableLengthFt}
        eventCategoryNames={eventCategoryNames}
        layoutCapacity={layoutCapacity}
        applications={applications}
        hasOverlap={hasOverlap}
        placedCount={placedCount}
        saving={saving}
        savingDraft={savingDraft}
        saveLayoutRef={saveLayoutRef}
        event={event}
        onLayoutRoomsChange={handleLayoutRoomsChange}
        onAddRoom={handleAddRoom}
        onRenameRoom={handleRenameRoom}
        onDeleteRoom={handleDeleteRoom}
        onBaselineTableLengthChange={handleBaselineTableLengthChange}
        onOverlapChange={setHasOverlap}
        onPlacedCountChange={setPlacedCount}
        onSave={handleSave}
        onSaveDraft={handleSaveDraft}
        onReloadFromServer={handleReloadFromServer}
      />
    </FloorPlanViewportLayoutProvider>
  )
}

function SpatialLayoutEditorBody({
  eventId,
  eventName,
  isDraft,
  layoutGeneration,
  rooms,
  activeRoomId,
  baselineTableLengthFt,
  eventCategoryNames,
  layoutCapacity,
  applications,
  hasOverlap,
  placedCount,
  saving,
  savingDraft,
  saveLayoutRef,
  event,
  onLayoutRoomsChange,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  onBaselineTableLengthChange,
  onOverlapChange,
  onPlacedCountChange,
  onSave,
  onSaveDraft,
  onReloadFromServer,
}: {
  eventId: string
  eventName: string
  isDraft: boolean
  layoutGeneration: number
  rooms: ReturnType<typeof useSpatialLayoutState>['rooms']
  activeRoomId: string
  baselineTableLengthFt: ReturnType<typeof useSpatialLayoutState>['baselineTableLengthFt']
  eventCategoryNames: string[]
  layoutCapacity: number
  applications: SpatialLayoutEditorProps['applications']
  hasOverlap: boolean
  placedCount: number
  saving: boolean
  savingDraft: boolean
  saveLayoutRef: React.MutableRefObject<(() => Promise<boolean>) | null>
  event: Event
  onLayoutRoomsChange: ReturnType<typeof useSpatialLayoutState>['handleLayoutRoomsChange']
  onAddRoom: ReturnType<typeof useSpatialLayoutState>['handleAddRoom']
  onRenameRoom: ReturnType<typeof useSpatialLayoutState>['handleRenameRoom']
  onDeleteRoom: ReturnType<typeof useSpatialLayoutState>['handleDeleteRoom']
  onBaselineTableLengthChange: ReturnType<
    typeof useSpatialLayoutState
  >['handleBaselineTableLengthChange']
  onOverlapChange: (hasOverlap: boolean) => void
  onPlacedCountChange: (count: number) => void
  onSave: () => void | Promise<void>
  onSaveDraft: () => void | Promise<void>
  onReloadFromServer: () => void
}) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()

  if (showDesktopRequired) {
    return (
      <div
        className="flex h-full min-h-[40vh] items-center justify-center"
        aria-hidden
      />
    )
  }

  return (
    <SpatialLayoutShell
      toolbar={
        <SpatialLayoutToolbar
          eventId={eventId}
          eventName={eventName}
          placedCount={placedCount}
          layoutCapacity={layoutCapacity}
          hasOverlap={hasOverlap}
          isDraft={isDraft}
          saving={saving}
          savingDraft={savingDraft}
          onSave={onSave}
          onSaveDraft={onSaveDraft}
          saveLabel={isDraft ? 'Save & deploy' : 'Save layout'}
          onReloadFromServer={onReloadFromServer}
        />
      }
    >
      <FloorPlanV2
        key={layoutGeneration}
        eventId={eventId}
        designerExitHref={
          isDraft
            ? `/coordinator/events/${eventId}/setup?step=3`
            : `/coordinator/events/${eventId}`
        }
        designerExitLabel={isDraft ? 'Back to Event Setup' : 'Event overview'}
        designerExitEventStatus={event.status}
        designerExitEventName={eventName}
        layoutRooms={rooms}
        layoutActiveRoomId={activeRoomId}
        onLayoutRoomsChange={onLayoutRoomsChange}
        saveLayoutRef={saveLayoutRef}
        eventCategoryNames={eventCategoryNames}
        onAddRoom={onAddRoom}
        onRenameRoom={onRenameRoom}
        onDeleteRoom={onDeleteRoom}
        baselineTableLengthFt={baselineTableLengthFt}
        onBaselineTableLengthChange={onBaselineTableLengthChange}
        layoutCapacity={layoutCapacity}
        applications={applications}
        onOverlapChange={onOverlapChange}
        onPlacedCountChange={onPlacedCountChange}
        onSaveMarket={onSave}
        onSaveDraft={onSaveDraft}
        saveMarketDisabled={hasOverlap || saving || savingDraft}
        saveMarketLoading={saving}
        saveDraftDisabled={hasOverlap || saving || savingDraft}
        saveDraftLoading={savingDraft}
        chrome="default"
        preferServerLayout
        debugGeometry={false}
        className="h-full min-h-0"
      />
    </SpatialLayoutShell>
  )
}
