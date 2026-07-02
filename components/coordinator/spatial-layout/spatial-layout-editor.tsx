'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FloorPlanV2 } from '@/components/coordinator/floor-plan-v2/floor-plan-v2'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import { createClient } from '@/lib/supabase/client'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import { checkCoordinatorPublishGate } from '@/lib/coordinator/publish-gate-client'
import { setupWizardStepHref } from '@/lib/wizard/setup-step-url'
import { clearMultiRoomDraft } from '@/components/coordinator/floor-plan-v2/state/local-draft'
import type { BoothLayout, Event, LayoutRoom } from '@/types/database'
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
  return (
    <FloorPlanViewportLayoutProvider>
      <DesktopScreenRequiredOverlay eventId={eventId} />
      <SpatialLayoutEditorInner
        eventId={eventId}
        event={event}
        existingLayout={existingLayout}
        applications={applications}
      />
    </FloorPlanViewportLayoutProvider>
  )
}

function SpatialLayoutEditorInner({
  eventId,
  event,
  existingLayout,
  applications = [],
}: SpatialLayoutEditorProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const saveLayoutRef = useRef<(() => Promise<boolean>) | null>(null)
  const layoutSnapshotRef = useRef<
    (() => { rooms: LayoutRoom[]; activeRoomId: string } | null) | null
  >(null)

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

  const handleApplySavedLayout = useCallback(
    (rooms: LayoutRoom[], activeRoomId: string) => {
      clearMultiRoomDraft(eventId)
      handleLayoutRoomsChange(rooms, activeRoomId)
      setLayoutGeneration((n) => n + 1)
    },
    [eventId, handleLayoutRoomsChange]
  )

  const getLayoutSnapshot = useCallback(() => {
    return layoutSnapshotRef.current?.() ?? null
  }, [])

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
  }, [
    event.address,
    event.latitude,
    event.location_name,
    event.longitude,
    event.status,
    eventId,
    hasOverlap,
    router,
    supabase,
  ])

  const eventName = event.name?.trim() ?? 'Untitled event'
  const isDraft = event.status === 'draft'

  return (
    <SpatialLayoutShell
      toolbar={
        <SpatialLayoutToolbar
          eventId={eventId}
          eventName={eventName}
          coordinatorId={event.coordinator_id}
          locationName={event.location_name}
          address={event.address}
          placedCount={placedCount}
          layoutCapacity={layoutCapacity}
          hasOverlap={hasOverlap}
          isDraft={isDraft}
          saving={saving}
          savingDraft={savingDraft}
          onSave={handleSave}
          onSaveDraft={handleSaveDraft}
          saveLabel={isDraft ? 'Save & deploy' : 'Save layout'}
          onReloadFromServer={handleReloadFromServer}
          getLayoutSnapshot={getLayoutSnapshot}
          onApplySavedLayout={handleApplySavedLayout}
        />
      }
    >
      {showDesktopRequired ? (
        <div className="flex h-full min-h-[40vh] items-center justify-center p-6" aria-hidden />
      ) : (
        <FloorPlanV2
          key={layoutGeneration}
          eventId={eventId}
          designerExitHref={
            isDraft ? setupWizardStepHref(eventId, 3) : `/coordinator/events/${eventId}`
          }
          designerExitLabel={isDraft ? 'Back to Event Setup' : 'Event overview'}
          designerExitEventStatus={event.status}
          designerExitEventName={eventName}
          layoutRooms={rooms}
          layoutActiveRoomId={activeRoomId}
          onLayoutRoomsChange={handleLayoutRoomsChange}
          saveLayoutRef={saveLayoutRef}
          layoutSnapshotRef={layoutSnapshotRef}
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
          onSaveMarket={handleSave}
          onSaveDraft={handleSaveDraft}
          saveMarketDisabled={hasOverlap || saving || savingDraft}
          saveMarketLoading={saving}
          saveDraftDisabled={hasOverlap || saving || savingDraft}
          saveDraftLoading={savingDraft}
          chrome="spatial"
          preferServerLayout
          debugGeometry={false}
          className="h-full min-h-0"
        />
      )}
    </SpatialLayoutShell>
  )
}
