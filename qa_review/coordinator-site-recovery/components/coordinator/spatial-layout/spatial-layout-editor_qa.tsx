'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FloorPlanV2 } from '@/components/coordinator/floor-plan-v2/floor-plan-v2'
import { createClient } from '@/lib/supabase/client'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import type { BoothLayout, Event } from '@/types/database'
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
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const saveLayoutRef = useRef<(() => Promise<boolean>) | null>(null)

  const [hasOverlap, setHasOverlap] = useState(false)
  const [placedCount, setPlacedCount] = useState(0)
  const [saving, setSaving] = useState(false)
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
      <DesktopScreenRequiredOverlay eventId={eventId} />
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
            onSave={handleSave}
            saveLabel={isDraft ? 'Save & deploy' : 'Save layout'}
          />
        }
      >
        {showDesktopRequired ? (
          <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Floor plan layout and matrix are not optimized for small screens. Use a tablet in
              landscape or a desktop viewport to continue editing.
            </p>
          </div>
        ) : (
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
            onSaveMarket={handleSave}
            saveMarketDisabled={hasOverlap || saving}
            saveMarketLoading={saving}
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
