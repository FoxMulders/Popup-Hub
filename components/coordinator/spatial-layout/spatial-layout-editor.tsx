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
import { SpatialLayoutShell } from './spatial-layout-shell'
import { SpatialLayoutToolbar } from './spatial-layout-toolbar'
import { useSpatialLayoutState } from './use-spatial-layout-state'

const showTestSuiteButton =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_ALLOW_TEST_SUITE === 'true'

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
  const [testSuiteRunning, setTestSuiteRunning] = useState(false)
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

  const maxBoothCapacity = useMemo(() => {
    const limits = (
      event as Event & {
        category_limits?: Array<{ max_slots?: number | null }>
      }
    ).category_limits
    return (limits ?? []).reduce((sum, row) => sum + Math.max(0, row.max_slots ?? 0), 0)
  }, [event])

  const handlePopulateTestSuite = useCallback(async () => {
    if (testSuiteRunning) return
    setTestSuiteRunning(true)
    try {
      const response = await fetch(`/api/coordinator/events/${eventId}/seed-test-suite`, {
        method: 'POST',
      })
      const body = (await response.json()) as {
        error?: string
        applicationCount?: number
        tableSlots?: number
      }
      if (!response.ok) {
        toast.error(body.error ?? 'Could not populate test suite')
        return
      }
      toast.success(
        `Test suite ready: ${body.applicationCount ?? 0} approved & paid vendors (${body.tableSlots ?? 0} tables)`
      )
      router.refresh()
    } finally {
      setTestSuiteRunning(false)
    }
  }, [eventId, router, testSuiteRunning])

  return (
    <SpatialLayoutShell
      toolbar={
        <SpatialLayoutToolbar
          eventId={eventId}
          eventName={eventName}
          placedCount={placedCount}
          layoutCapacity={layoutCapacity}
          maxBoothCapacity={maxBoothCapacity}
          hasOverlap={hasOverlap}
          isDraft={isDraft}
          saving={saving}
          savingDraft={savingDraft}
          onSave={handleSave}
          onSaveDraft={handleSaveDraft}
          saveLabel={isDraft ? 'Save & deploy' : 'Save layout'}
          onReloadFromServer={handleReloadFromServer}
          showTestSuiteButton={showTestSuiteButton}
          testSuiteRunning={testSuiteRunning}
          onPopulateTestSuite={() => void handlePopulateTestSuite()}
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
    </SpatialLayoutShell>
  )
}
