'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { BoothLayout, Event } from '@/types/database'
import { SpatialLayoutShell } from '@/components/coordinator/spatial-layout/spatial-layout-shell'
import { SpatialLayoutToolbar } from '@/components/coordinator/spatial-layout/spatial-layout-toolbar'

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

/**
 * Standalone layout route — empty shell while floor-plan QA is reset.
 * Toolbar keeps event back-navigation; canvas area is intentionally blank.
 */
export function SpatialLayoutEditor({
  eventId,
  event,
}: SpatialLayoutEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      toast.message('Layout editor is being rebuilt — nothing to save yet.')
      if (event.status === 'draft') {
        router.push(`/coordinator/events/${eventId}`)
      }
    } finally {
      setSaving(false)
    }
  }, [event.status, eventId, router])

  const eventName = event.name?.trim() ?? 'Untitled event'
  const isDraft = event.status === 'draft'

  return (
    <SpatialLayoutShell
      toolbar={
        <SpatialLayoutToolbar
          eventId={eventId}
          eventName={eventName}
          placedCount={0}
          layoutCapacity={0}
          hasOverlap={false}
          isDraft={isDraft}
          saving={saving}
          onSave={handleSave}
          saveLabel={isDraft ? 'Save & deploy' : 'Save layout'}
        />
      }
    >
      <div
        className="min-h-0 flex-1 bg-canvas"
        aria-label="Floor plan canvas"
        data-layout-canvas-empty
      />
    </SpatialLayoutShell>
  )
}
