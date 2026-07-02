'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FloorPlanV2WizardQa } from '@/src/qa_review/components/coordinator/floor-plan-v2/floor-plan-v2_wizard_qa'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import { createClient } from '@/lib/supabase/client'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import type { BoothLayout, Event } from '@/types/database'
import { SpatialLayoutShell } from '@/components/coordinator/spatial-layout/spatial-layout-shell'
import { SpatialLayoutToolbar } from '@/components/coordinator/spatial-layout/spatial-layout-toolbar'
import { useSpatialLayoutState } from '@/components/coordinator/spatial-layout/use-spatial-layout-state'

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
  const saveLayoutRef = useRef<(() => Promise<boolean>) | null>(null)

  const [hasOverlap, setHasOverlap] = useState(false)
  const [placedCount, setPlacedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
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
  const { showDesktopRequired } = useFloorPlanViewportLayout()

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
    <>
      <DesktopScreenRequiredOverlay
        eventId={eventId}
        onSaveDraft={handleSaveDraft}
        saveDraftLoading={savingDraft}
      />
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
            getLayoutSnapshot={() => null}
            onApplySavedLayout={() => {}}
          />
        }
      >
        {showDesktopRequired ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center p-6 text-center" aria-hidden />
        ) : (
          <FloorPlanV2WizardQa
            eventId={eventId}
            existingLayout={existingLayout}
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
            onSaveMarket={handleSave}
            onSaveDraft={handleSaveDraft}
            saveMarketDisabled={hasOverlap || saving || savingDraft}
            saveMarketLoading={saving}
            saveDraftDisabled={hasOverlap || saving || savingDraft}
            saveDraftLoading={savingDraft}
            chrome="default"
            preferServerLayout
            debugGeometry={false}
            className="h-full min-h-0"
          />
        )}
      </SpatialLayoutShell>
    </>
  )
}
